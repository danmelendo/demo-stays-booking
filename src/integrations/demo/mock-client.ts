// ─────────────────────────────────────────────────────────────────────────────
// Mock Supabase client — a tiny in-browser stand-in for the Supabase JS client
// used across the app. It re-implements just the slice of the PostgREST query
// builder, Auth, RPC, Edge Functions and Realtime APIs that this project calls,
// backed by the in-memory dataset in ./seed.ts.
//
// The goal is fidelity to how the app *uses* the client (chainable
// .from().select().eq()…, .rpc(), .functions.invoke(), .auth.*, .channel()),
// NOT a faithful Postgres engine. It is only wired in when no real Supabase
// credentials are present (see src/integrations/supabase/client.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { DEMO_USER_ID, loadDb, saveDb, type DemoDb, type Row } from "./seed";

let _db: DemoDb | null = null;
function db(): DemoDb {
  if (!_db) _db = loadDb();
  return _db;
}
function persist() {
  if (_db) saveDb(_db);
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

// ── Filters ─────────────────────────────────────────────────────────────────
type Filter =
  | { t: "eq" | "neq" | "gte" | "lte" | "lt" | "gt"; c: string; v: unknown }
  | { t: "notin"; c: string; list: unknown[] }
  | { t: "or"; conds: Filter[] };

function coerce(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

// Parse a PostgREST `.or("col.op.val,col.op.val")` expression. Values may contain
// dots (ISO timestamps), so split each clause on its first two dots only.
function parseOr(expr: string): Filter[] {
  return expr.split(",").map((clause) => {
    const firstDot = clause.indexOf(".");
    const secondDot = clause.indexOf(".", firstDot + 1);
    const col = clause.slice(0, firstDot);
    const op = clause.slice(firstDot + 1, secondDot);
    const val = coerce(clause.slice(secondDot + 1));
    return { t: op as "eq" | "gte", c: col, v: val } as Filter;
  });
}

function matches(row: Row, f: Filter): boolean {
  switch (f.t) {
    case "eq": return row[f.c] === f.v;
    case "neq": return row[f.c] !== f.v;
    case "gte": return row[f.c] >= (f.v as never);
    case "lte": return row[f.c] <= (f.v as never);
    case "lt": return row[f.c] < (f.v as never);
    case "gt": return row[f.c] > (f.v as never);
    case "notin": return !f.list.includes(row[f.c]);
    case "or": return f.conds.some((c) => matches(row, c));
  }
}

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return rows.filter((r) => filters.every((f) => matches(r, f)));
}

// ── Embedded relation resolution ──────────────────────────────────────────────
// Attaches related rows when a select string references them, e.g.
//   reservations.select("*, rooms(...), customers(...), reservation_extras(...extras(...))")
//   rooms.select("*, rate_groups(name)")
function resolveEmbeds(table: string, row: Row, select: string): Row {
  const out = clone(row);
  const has = (rel: string) => new RegExp(`(^|[\\s,(])${rel}\\s*\\(`).test(select);

  if (table === "rooms" && has("rate_groups")) {
    out.rate_groups = db().rate_groups.find((g) => g.id === row.rate_group_id) ?? null;
  }

  if (table === "reservations") {
    if (has("rooms")) out.rooms = clone(db().rooms.find((x) => x.id === row.room_id) ?? null);
    if (has("customers")) out.customers = clone(db().customers.find((x) => x.id === row.customer_id) ?? null);
    if (has("reservation_extras")) {
      out.reservation_extras = db()
        .reservation_extras.filter((re) => re.reservation_id === row.id)
        .map((re) => {
          const item = clone(re);
          if (/extras\s*\(/.test(select)) {
            item.extras = clone(db().extras.find((x) => x.id === re.extra_id) ?? null);
          }
          return item;
        });
    }
  }

  return out;
}

// ── Cleaning-buffer conflict check ───────────────────────────────────────────
// Mirrors the Postgres `check_reservation_gap` trigger: a reservation occupies
// its room for [start_at, end_at + cleaning_minutes). A new/edited reservation
// conflicts with an existing *blocking* reservation when those windows overlap.
// Cancelled/no-show/rejected never block, and `manual_override` (admin) skips
// the check entirely — exactly like the real database trigger.
function occupiedWindow(r: Row): [number, number] {
  const start = new Date(r.start_at as string).getTime();
  const end = new Date(r.end_at as string).getTime();
  const cleaning = Math.max(0, Number(r.cleaning_minutes ?? 15)) * 60_000;
  return [start, end + cleaning];
}

function checkReservationGap(candidate: Row): string | null {
  const status = candidate.status as string;
  if (status === "cancelled" || status === "no_show" || status === "rejected") return null;
  if (candidate.manual_override) return null; // admin override skips the gap
  const [aStart, aEnd] = occupiedWindow(candidate);
  const sixtyMinAgo = Date.now() - 60 * 60_000;
  for (const r of db().reservations ?? []) {
    if (r.id === candidate.id) continue;
    if (r.room_id !== candidate.room_id) continue;
    const blocking =
      r.status === "confirmed" || r.status === "in_progress" || r.status === "completed" ||
      (r.status === "pending" && new Date(r.created_at as string).getTime() > sixtyMinAgo);
    if (!blocking) continue;
    const [bStart, bEnd] = occupiedWindow(r);
    if (aStart < bEnd && bStart < aEnd) {
      const mins = Math.max(15, Number(candidate.cleaning_minutes ?? 15));
      return `Conflicto de reserva: la habitación necesita al menos ${mins} minutos de limpieza entre reservas`;
    }
  }
  return null;
}

// ── Query builder ──────────────────────────────────────────────────────────────
type Result = { data: unknown; error: unknown; count: number | null };

class QueryBuilder implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private filters: Filter[] = [];
  private orders: { c: string; asc: boolean }[] = [];
  private select_ = "*";
  private limit_: number | null = null;
  private count_: string | null = null;
  private head_ = false;
  private single_: "one" | "maybe" | null = null;
  private payload: unknown = null;

  constructor(private table: string) {}

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    if (cols) this.select_ = cols;
    if (opts?.count) this.count_ = opts.count;
    if (opts?.head) this.head_ = true;
    return this;
  }
  insert(payload: unknown) { this.op = "insert"; this.payload = payload; return this; }
  update(payload: unknown) { this.op = "update"; this.payload = payload; return this; }
  delete() { this.op = "delete"; return this; }
  upsert(payload: unknown) { this.op = "insert"; this.payload = payload; return this; }

  eq(c: string, v: unknown) { this.filters.push({ t: "eq", c, v }); return this; }
  neq(c: string, v: unknown) { this.filters.push({ t: "neq", c, v }); return this; }
  gte(c: string, v: unknown) { this.filters.push({ t: "gte", c, v }); return this; }
  lte(c: string, v: unknown) { this.filters.push({ t: "lte", c, v }); return this; }
  lt(c: string, v: unknown) { this.filters.push({ t: "lt", c, v }); return this; }
  gt(c: string, v: unknown) { this.filters.push({ t: "gt", c, v }); return this; }
  not(c: string, op: string, v: string) {
    if (op === "in") {
      const list = v.replace(/^\(|\)$/g, "").split(",").map((s) => coerce(s.trim()));
      this.filters.push({ t: "notin", c, list });
    }
    return this;
  }
  or(expr: string) { this.filters.push({ t: "or", conds: parseOr(expr) }); return this; }
  order(c: string, opts?: { ascending?: boolean }) { this.orders.push({ c, asc: opts?.ascending ?? true }); return this; }
  limit(n: number) { this.limit_ = n; return this; }
  range() { return this; }
  single() { this.single_ = "one"; return this; }
  maybeSingle() { this.single_ = "maybe"; return this; }

  private withDefaults(record: Row): Row {
    const now = new Date().toISOString();
    const r: Row = { created_at: now, ...record };
    if (r.id == null) r.id = uid(this.table);
    if (this.table === "reservations") {
      r.updated_at = now;
      if (r.cleaning_minutes == null) r.cleaning_minutes = 15;
      if (r.status == null) r.status = "confirmed"; // mirrors the DB column default
    }
    return r;
  }

  private run(): Result {
    const table = this.table;
    const store = db()[table] ?? (db()[table] = []);

    if (this.op === "insert") {
      const arr = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = (arr as Row[]).map((p) => this.withDefaults(p));
      if (table === "reservations") {
        for (const row of inserted) {
          const gap = checkReservationGap(row);
          if (gap) return { data: null, error: { message: gap }, count: null };
        }
      }
      store.push(...inserted);
      persist();
      if (table === "reservations") inserted.forEach((row) => emitChange(table, row));
      const projected = inserted.map((r) => resolveEmbeds(table, r, this.select_));
      const data = this.single_ ? (projected[0] ?? null) : projected;
      return { data, error: null, count: projected.length };
    }

    if (this.op === "update") {
      const targets = applyFilters(store, this.filters);
      const patch = this.payload as Row;
      if (table === "reservations") {
        for (const row of targets) {
          const gap = checkReservationGap({ ...row, ...patch });
          if (gap) return { data: null, error: { message: gap }, count: null };
        }
      }
      for (const row of targets) {
        Object.assign(row, patch);
        if (table === "reservations") row.updated_at = new Date().toISOString();
      }
      persist();
      const projected = targets.map((r) => resolveEmbeds(table, r, this.select_));
      const data = this.single_ ? (projected[0] ?? null) : projected;
      return { data, error: null, count: projected.length };
    }

    if (this.op === "delete") {
      const keep: Row[] = [];
      const removed: Row[] = [];
      for (const row of store) (applyFilters([row], this.filters).length ? removed : keep).push(row);
      db()[table] = keep;
      persist();
      return { data: removed, error: null, count: removed.length };
    }

    // select
    let rows = applyFilters(store, this.filters);
    for (const o of [...this.orders].reverse()) {
      rows = rows.slice().sort((a, b) => {
        const av = a[o.c];
        const bv = b[o.c];
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return o.asc ? cmp : -cmp;
      });
    }
    const count = this.count_ ? rows.length : null;
    if (this.limit_ != null) rows = rows.slice(0, this.limit_);
    if (this.head_) return { data: null, error: null, count };

    const projected = rows.map((r) => resolveEmbeds(table, r, this.select_));
    if (this.single_ === "one") {
      if (projected.length !== 1) {
        return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned" }, count };
      }
      return { data: projected[0], error: null, count };
    }
    if (this.single_ === "maybe") {
      return { data: projected[0] ?? null, error: null, count };
    }
    return { data: projected, error: null, count };
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    let result: Result;
    try {
      result = this.run();
    } catch (error) {
      result = { data: null, error, count: null };
    }
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

// ── Realtime (postgres_changes) ─────────────────────────────────────────────────
type ChannelSub = { event: string; filter: { event?: string; table?: string }; cb: (payload: Row) => void };
interface MockChannel {
  _subs: ChannelSub[];
  on: (event: string, filter: { event?: string; table?: string }, cb: (payload: Row) => void) => MockChannel;
  subscribe: (cb?: (status: string) => void) => MockChannel;
}
const channels: MockChannel[] = [];

function emitChange(table: string, row: Row) {
  const payload = { new: clone(row), old: {}, eventType: "INSERT", commit_timestamp: new Date().toISOString() };
  for (const ch of channels) {
    for (const sub of ch._subs) {
      if (sub.filter?.table === table && (sub.filter.event === "INSERT" || sub.filter.event === "*")) {
        try { sub.cb(payload); } catch { /* ignore subscriber errors */ }
      }
    }
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────
const AUTH_KEY = "demo-stays-session";
type Listener = (event: string, session: Row | null) => void;
const authListeners: Listener[] = [];

function makeSession(email: string): Row {
  return {
    access_token: "demo-access-token",
    refresh_token: "demo-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: DEMO_USER_ID,
      email,
      role: "authenticated",
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

function readSession(): Row | null {
  if (typeof window === "undefined") return makeSession("admin@demostays.example");
  const raw = window.localStorage.getItem(AUTH_KEY);
  if (raw === null) {
    // First visit: start signed in as the demo admin so the panel is reachable.
    const s = makeSession("admin@demostays.example");
    window.localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    return s;
  }
  if (raw === "") return null; // explicitly signed out
  try { return JSON.parse(raw) as Row; } catch { return null; }
}

function writeSession(session: Row | null) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(AUTH_KEY, session ? JSON.stringify(session) : "");
  }
  const event = session ? "SIGNED_IN" : "SIGNED_OUT";
  authListeners.forEach((cb) => cb(event, session));
}

const auth = {
  onAuthStateChange(cb: Listener) {
    authListeners.push(cb);
    return {
      data: {
        subscription: {
          id: uid("sub"),
          callback: cb,
          unsubscribe() {
            const i = authListeners.indexOf(cb);
            if (i >= 0) authListeners.splice(i, 1);
          },
        },
      },
    };
  },
  async getSession() {
    return { data: { session: readSession() }, error: null };
  },
  async getUser() {
    const s = readSession();
    return { data: { user: s?.user ?? null }, error: null };
  },
  async getClaims() {
    return { data: { claims: { sub: DEMO_USER_ID } }, error: null };
  },
  async signInWithPassword({ email }: { email: string; password: string }) {
    const session = makeSession(email || "admin@demostays.example");
    writeSession(session);
    return { data: { session, user: session.user }, error: null };
  },
  async signUp({ email }: { email: string; password: string }) {
    const session = makeSession(email || "admin@demostays.example");
    writeSession(session);
    return { data: { session, user: session.user }, error: null };
  },
  async signOut() {
    writeSession(null);
    return { error: null };
  },
};

// ── RPC ─────────────────────────────────────────────────────────────────────
async function rpc(fn: string, args: Record<string, unknown> = {}): Promise<{ data: unknown; error: unknown }> {
  if (fn === "find_or_create_customer") {
    const email = (args.p_email as string | undefined)?.toLowerCase();
    let customer = email
      ? db().customers.find((c) => typeof c.email === "string" && c.email.toLowerCase() === email)
      : undefined;
    if (!customer) {
      customer = {
        id: uid("cust"),
        name: (args.p_name as string) ?? null,
        email: (args.p_email as string) ?? null,
        phone: (args.p_phone as string) ?? null,
        no_contact: !!args.p_no_contact,
        notes: null,
        created_at: new Date().toISOString(),
      };
      db().customers.push(customer);
      persist();
    }
    return { data: customer.id, error: null };
  }

  if (fn === "extend_cleaning_and_shift") {
    // Extend a reservation's cleaning time and push the following reservations
    // in the same room forward so they only start once cleaning has finished.
    // Returns how many subsequent reservations were rescheduled. Mirrors the
    // SECURITY DEFINER Postgres function (applies shifts directly, bypassing the
    // gap trigger to avoid transient overlaps).
    const a = db().reservations.find((r) => r.id === args.p_reservation_id);
    if (!a) return { data: null, error: { message: "Reserva no encontrada" } };
    const newClean = Math.max(15, Number(args.p_cleaning_minutes ?? 15));

    const subsequent = db()
      .reservations.filter(
        (r) =>
          r.room_id === a.room_id &&
          r.id !== a.id &&
          new Date(r.start_at as string).getTime() >= new Date(a.start_at as string).getTime() &&
          ["confirmed", "in_progress", "completed", "pending"].includes(r.status as string),
      )
      .sort((x, y) => new Date(x.start_at as string).getTime() - new Date(y.start_at as string).getTime());

    let reqTime = new Date(a.end_at as string).getTime() + newClean * 60_000;
    let moved = 0;
    for (const r of subsequent) {
      if (new Date(r.start_at as string).getTime() >= reqTime) break; // gap absorbs the delay
      const dur = new Date(r.end_at as string).getTime() - new Date(r.start_at as string).getTime();
      const now = new Date().toISOString();
      r.start_at = new Date(reqTime).toISOString();
      r.end_at = new Date(reqTime + dur).toISOString();
      r.updated_at = now;
      reqTime = reqTime + dur + Math.max(0, Number(r.cleaning_minutes ?? 15)) * 60_000;
      moved += 1;
    }

    a.cleaning_minutes = newClean;
    a.updated_at = new Date().toISOString();
    persist();
    return { data: moved, error: null };
  }

  return { data: null, error: null };
}

// ── Edge Functions ─────────────────────────────────────────────────────────────
const functions = {
  async invoke(name: string, options?: { body?: Record<string, unknown> }) {
    const body = options?.body ?? {};
    if (name === "create-redsys-payment") {
      // Simulate the REDSYS_BYPASS path: mark the deposit as paid directly and
      // return a redirect to the confirmation screen (no real TPV in the demo).
      const reservationId = body.reservation_id as string | undefined;
      const res = db().reservations.find((r) => r.id === reservationId);
      const order = `DEMO-${Date.now().toString(36)}`;
      if (res) {
        res.deposit_paid = true;
        res.status = "confirmed";
        res.redsys_order = order;
        res.paid_amount = res.deposit_amount ?? Math.round(Number(res.total) * 0.3 * 100) / 100;
        res.updated_at = new Date().toISOString();
        persist();
      }
      return { data: { bypass: true, redirectUrl: `/reservar-ok?order=${order}` }, error: null };
    }
    if (name === "send-reservation-confirmation") {
      return { data: { ok: true, demo: true }, error: null };
    }
    return { data: null, error: null };
  },
};

// ── Client ─────────────────────────────────────────────────────────────────────
export function createMockClient() {
  return {
    from(table: string) {
      return new QueryBuilder(table);
    },
    rpc,
    functions,
    auth,
    channel(_name: string): MockChannel {
      const ch: MockChannel = {
        _subs: [],
        on(_event, filter, cb) {
          this._subs.push({ event: _event, filter, cb });
          return this;
        },
        subscribe(cb) {
          cb?.("SUBSCRIBED");
          return this;
        },
      };
      channels.push(ch);
      return ch;
    },
    removeChannel(ch: MockChannel) {
      const i = channels.indexOf(ch);
      if (i >= 0) channels.splice(i, 1);
      return Promise.resolve("ok");
    },
  };
}

export type MockClient = ReturnType<typeof createMockClient>;
