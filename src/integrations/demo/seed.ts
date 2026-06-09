// ─────────────────────────────────────────────────────────────────────────────
// Demo seed data — in-memory dataset that replaces the Supabase backend so the
// app can be run and explored WITHOUT any server, credentials or migrations.
//
// The data mirrors the real Postgres schema (see src/integrations/supabase/types.ts)
// but uses plain string ids and anonymised, example values. It is loaded into
// memory and persisted to localStorage so changes (new bookings, edited rates,
// status changes…) survive a page reload. Use resetDemoDb() to wipe it.
// ─────────────────────────────────────────────────────────────────────────────

export type Row = Record<string, any>;
export type DemoDb = Record<string, Row[]>;

const STORAGE_KEY = "demo-stays-db";
const STORAGE_VERSION = 6; // bump to force a reseed when the shape changes

export const DEMO_USER_ID = "demo-user-admin";

// ── Rate groups ──────────────────────────────────────────────────────────────
const RATE_GROUPS = [
  { id: "rg-grey", name: "Tarifa Signature" },
  { id: "rg-ruta66", name: "Tarifa Superior" },
  { id: "rg-music", name: "Tarifa Clásica" },
  { id: "rg-dubai", name: "Tarifa Clásica Plus" },
  { id: "rg-hollywood", name: "Tarifa Esencial" },
  { id: "rg-maldivas", name: "Tarifa Sin Jacuzzi" },
  { id: "rg-tokyo", name: "Tarifa Sin Jacuzzi Lite" },
];

// ── Hourly rates [duration_min, with_jacuzzi, without_jacuzzi] ────────────────
const HOURLY: Record<string, [number, number | null, number | null][]> = {
  "rg-grey": [
    [60, 53, 48], [90, 68, 58], [120, 78, 68], [150, 92, 72], [180, 102, 88],
    [210, 108, 93], [240, 113, 98], [270, 118, 102], [300, 132, 108], [330, 138, 112], [360, 148, 128],
  ],
  "rg-ruta66": [
    [60, 48, 43], [90, 58, 52], [120, 68, 58], [150, 72, 62], [180, 92, 78],
    [210, 98, 83], [240, 102, 88], [270, 108, 92], [300, 122, 98], [330, 128, 102], [360, 138, 118],
  ],
  "rg-music": [
    [60, 43, 38], [90, 52, 48], [120, 62, 52], [150, 68, 58], [180, 88, 72],
    [210, 92, 78], [240, 98, 82], [270, 102, 88], [300, 118, 92], [330, 122, 98], [360, 132, 122],
  ],
  "rg-dubai": [
    [60, 45, 40], [90, 55, 50], [120, 65, 55], [150, 70, 60], [180, 90, 75],
    [210, 95, 80], [240, 100, 85], [270, 105, 90], [300, 120, 95], [330, 125, 100], [360, 135, 125],
  ],
  "rg-hollywood": [
    [60, 43, 35], [90, 52, 40], [120, 62, 45], [150, 68, 50], [180, 88, 55],
    [210, 92, 60], [240, 98, 65], [270, 102, 70], [300, 118, 75], [330, 122, 80], [360, 132, 85],
  ],
  "rg-maldivas": [
    [60, null, 38], [90, null, 43], [120, null, 48], [150, null, 53], [180, null, 58],
    [210, null, 63], [240, null, 68], [270, null, 73], [300, null, 78], [330, null, 83], [360, null, 88],
  ],
  "rg-tokyo": [
    [60, null, 35], [90, null, 40], [120, null, 45], [150, null, 50], [180, null, 55],
    [210, null, 60], [240, null, 65], [270, null, 70], [300, null, 75], [330, null, 80], [360, null, 85],
  ],
};

// ── Overnight rates (only groups that offer noche completa) ───────────────────
const OVERNIGHT: Record<string, [string, number][]> = {
  "rg-grey": [["10:00:00", 120], ["11:00:00", 130], ["12:00:00", 140]],
  "rg-ruta66": [["10:00:00", 120], ["11:00:00", 130], ["12:00:00", 140]],
  "rg-music": [["10:00:00", 110], ["11:00:00", 120], ["12:00:00", 130]],
  "rg-dubai": [["10:00:00", 110], ["11:00:00", 120], ["12:00:00", 130]],
};

// ── Nightly rates (traditional-hotel mode) [price, weekend_price Fri/Sat] ──────
// Used by the public portal's "Hotel tradicional" booking mode: full nights
// with check-in 15:00 / check-out 12:00, priced per night.
const NIGHTLY: Record<string, [number, number]> = {
  "rg-grey": [135, 165],
  "rg-ruta66": [120, 145],
  "rg-music": [105, 128],
  "rg-dubai": [110, 132],
  "rg-hollywood": [95, 115],
  "rg-maldivas": [85, 102],
  "rg-tokyo": [75, 90],
};

// ── Third person surcharge (global, per extra person and time slot) ───────────
const THIRD: [number, number][] = [
  [60, 15], [90, 25], [120, 30], [150, 40], [180, 45],
  [210, 55], [240, 60], [270, 70], [300, 75], [330, 85], [360, 90],
];

// ── Rooms ─────────────────────────────────────────────────────────────────────
// [building, name, rate_group_id, jacuzzi, capacity]
const ROOM_DEFS: [string, string, string, "always" | "none", number][] = [
  ["Central", "Aurora", "rg-grey", "always", 2],
  ["Central", "Coral", "rg-music", "always", 2],
  ["Central", "Jade", "rg-music", "always", 2],
  ["Central", "Ambar", "rg-music", "always", 2],
  ["Central", "Zen", "rg-tokyo", "none", 2],
  ["Norte", "Skyline", "rg-music", "always", 2],
  ["Norte", "Pizarra", "rg-grey", "always", 2],
  ["Norte", "Estelar", "rg-hollywood", "always", 4],
  ["Norte", "Ritmo", "rg-music", "always", 2],
  ["Norte", "Nomada", "rg-ruta66", "always", 2],
  ["Sur", "Oasis", "rg-dubai", "always", 2],
  ["Sur", "Onyx", "rg-grey", "always", 2],
  ["Sur", "Laguna", "rg-maldivas", "none", 2],
  ["Sur", "Metropolis", "rg-dubai", "always", 4],
  ["Sur", "Eden", "rg-dubai", "always", 2],
];

// ── Extras ─────────────────────────────────────────────────────────────────────
const EXTRAS = [
  { id: "ex-deco-especial", category: "decoration", name: "Decoración Especial", price: 20, description: "Pétalos, velas LED y globos de bienvenida.", sort_order: 1 },
  { id: "ex-deco-plus", category: "decoration", name: "Decoración Plus", price: 30, description: "Incluye frase personalizada en la cama y en la pantalla.", sort_order: 2 },
  { id: "ex-deco-premium", category: "decoration", name: "Decoración Premium", price: 50, description: "Montaje premium con frases personalizadas.", sort_order: 3 },
  { id: "ex-deco-deluxe", category: "decoration", name: "Decoración Premium Deluxe", price: 145, description: "Montaje de lujo con frases personalizadas y detalles especiales.", sort_order: 4 },
  { id: "ex-cava", category: "drinks", name: "Cava Juvé & Camps", price: 25, description: null, sort_order: 5 },
  { id: "ex-moet", category: "drinks", name: "Botella Moët & Chandon", price: 60, description: null, sort_order: 6 },
  { id: "ex-vino", category: "drinks", name: "Botella de vino", price: 18, description: null, sort_order: 7 },
  { id: "ex-cachimba", category: "hookah", name: "Cachimba", price: 20, description: null, sort_order: 8 },
  { id: "ex-petalos", category: "accessories", name: "Pétalos de rosa extra", price: 10, description: null, sort_order: 9 },
  { id: "ex-globos", category: "accessories", name: "Pack de globos", price: 15, description: null, sort_order: 10 },
  { id: "ex-servicio", category: "services", name: "Servicio personalizado", price: 0, description: "Precio fijado por recepción.", sort_order: 11 },
];

// ── Customers ──────────────────────────────────────────────────────────────────
const CUSTOMERS = [
  { id: "cust-1", name: "Laura Gómez", phone: "+34 600 111 222", email: "laura@example.com", no_contact: false, notes: null },
  { id: "cust-2", name: "Carlos Ruiz", phone: "+34 600 333 444", email: "carlos@example.com", no_contact: false, notes: null },
  { id: "cust-3", name: "María López", phone: "+34 600 555 666", email: "maria@example.com", no_contact: false, notes: "Cliente habitual." },
  { id: "cust-4", name: "Pareja Aniversario", phone: null, email: "pareja@example.com", no_contact: true, notes: "Prefiere no recibir contacto." },
  { id: "cust-5", name: "David Sanz", phone: "+34 600 777 888", email: "david@example.com", no_contact: false, notes: null },
];

function iso(d: Date) {
  return d.toISOString();
}

function at(base: Date, dayOffset: number, hour: number, minute = 0) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Reservations are generated relative to "now" so the Today/Calendar views are
// always populated whenever the demo is first opened.
function buildReservations(now: Date) {
  const soon = new Date(now.getTime() + 30 * 60_000); // within the "next 1h" stat
  const soonEnd = new Date(soon.getTime() + 2 * 60 * 60_000);

  const defs: Array<{
    id: string; room_id: string; customer_id: string | null;
    start: Date; end: Date; status: string; total: number; base: number;
    role: string; overnight?: boolean; people?: number; deposit_paid?: boolean; cleaning?: number;
    extras?: { extra_id: string; qty: number; unit_price: number; is_gift?: boolean; bed_message?: string | null; screen_message?: string | null }[];
  }> = [
    {
      id: "res-1", room_id: "room-central-aurora", customer_id: "cust-1",
      start: at(now, 0, 14, 0), end: at(now, 0, 16, 0), status: "completed",
      total: 78, base: 78, role: "reception", deposit_paid: true,
    },
    {
      id: "res-2", room_id: "room-norte-ritmo", customer_id: "cust-2",
      start: at(now, 0, 20, 30), end: at(now, 0, 22, 30), status: "in_progress",
      total: 87, base: 62, role: "public", deposit_paid: true, cleaning: 30,
      extras: [{ extra_id: "ex-cava", qty: 1, unit_price: 25 }],
    },
    {
      id: "res-3", room_id: "room-sur-oasis", customer_id: "cust-3",
      start: soon, end: soonEnd, status: "confirmed",
      total: 95, base: 65, role: "public", deposit_paid: true,
      extras: [{ extra_id: "ex-deco-plus", qty: 1, unit_price: 30, bed_message: "Te amo", screen_message: "Feliz aniversario" }],
    },
    {
      id: "res-4", room_id: "room-sur-metropolis", customer_id: "cust-5",
      start: at(now, 0, 23, 0), end: at(now, 1, 1, 0), status: "confirmed",
      total: 65, base: 65, role: "admin", deposit_paid: true,
    },
    {
      id: "res-5", room_id: "room-central-aurora", customer_id: "cust-4",
      start: at(now, 1, 22, 0), end: at(now, 2, 10, 0), status: "confirmed",
      total: 120, base: 120, role: "public", overnight: true, deposit_paid: true,
    },
    {
      id: "res-6", room_id: "room-norte-estelar", customer_id: "cust-1",
      start: at(now, -1, 19, 0), end: at(now, -1, 22, 0), status: "completed",
      total: 88, base: 88, role: "reception", deposit_paid: true,
    },
    {
      id: "res-7", room_id: "room-sur-eden", customer_id: "cust-3",
      start: at(now, -2, 21, 0), end: at(now, -2, 23, 0), status: "completed",
      total: 110, base: 65, role: "public", deposit_paid: true,
      extras: [
        { extra_id: "ex-deco-premium", qty: 1, unit_price: 50, bed_message: "Para ti", screen_message: "Feliz cumpleaños mi amor" },
        { extra_id: "ex-cava", qty: 1, unit_price: 0, is_gift: true },
      ],
    },
    {
      id: "res-8", room_id: "room-central-coral", customer_id: null,
      start: at(now, 0, 22, 0), end: at(now, 1, 0, 0), status: "pending",
      total: 62, base: 62, role: "public", deposit_paid: false,
    },
  ];

  const reservations: Row[] = [];
  const reservationExtras: Row[] = [];

  for (const d of defs) {
    reservations.push({
      id: d.id,
      room_id: d.room_id,
      customer_id: d.customer_id,
      start_at: iso(d.start),
      end_at: iso(d.end),
      with_jacuzzi: true,
      people: d.people ?? 2,
      is_overnight: !!d.overnight,
      cleaning_minutes: d.cleaning ?? 15,
      base_price: d.base,
      third_person_surcharge: 0,
      dynamic_surcharge: 0,
      dynamic_reason: null,
      extras_total: (d.extras ?? []).reduce((s, e) => s + (e.is_gift ? 0 : e.qty * e.unit_price), 0),
      total: d.total,
      deposit_amount: Math.round(d.total * 0.3 * 100) / 100,
      deposit_paid: d.deposit_paid ?? false,
      paid_amount: d.deposit_paid ? Math.round(d.total * 0.3 * 100) / 100 : 0,
      status: d.status,
      internal_notes: null,
      manual_override: d.role === "admin",
      created_by: null,
      created_by_role: d.role,
      redsys_order: d.deposit_paid ? `DEMO-${d.id}` : null,
      created_at: iso(d.start),
      updated_at: iso(d.start),
    });
    for (const [i, e] of (d.extras ?? []).entries()) {
      reservationExtras.push({
        id: `${d.id}-ex-${i}`,
        reservation_id: d.id,
        extra_id: e.extra_id,
        qty: e.qty,
        unit_price: e.unit_price,
        is_gift: e.is_gift ?? false,
        bed_message: e.bed_message ?? null,
        screen_message: e.screen_message ?? null,
        created_at: iso(d.start),
      });
    }
  }

  return { reservations, reservationExtras };
}

export function buildSeedDb(): DemoDb {
  const now = new Date();
  const nowIso = iso(now);

  const rate_groups = RATE_GROUPS.map((g) => ({ ...g, created_at: nowIso }));

  const rate_hourly: Row[] = [];
  for (const [groupId, rows] of Object.entries(HOURLY)) {
    for (const [duration, withJ, withoutJ] of rows) {
      rate_hourly.push({
        id: `rh-${groupId}-${duration}`,
        rate_group_id: groupId,
        duration_min: duration,
        price_with_jacuzzi: withJ,
        price_without_jacuzzi: withoutJ,
      });
    }
  }

  const rate_overnight: Row[] = [];
  for (const [groupId, rows] of Object.entries(OVERNIGHT)) {
    for (const [checkout, price] of rows) {
      rate_overnight.push({
        id: `ro-${groupId}-${checkout}`,
        rate_group_id: groupId,
        checkout_time: checkout,
        price,
      });
    }
  }

  const rate_nightly: Row[] = Object.entries(NIGHTLY).map(([groupId, [price, weekend]]) => ({
    id: `rn-${groupId}`,
    rate_group_id: groupId,
    price,
    weekend_price: weekend,
  }));

  const rate_third_person: Row[] = THIRD.map(([duration, surcharge]) => ({
    id: `rt-${duration}`,
    duration_min: duration,
    surcharge,
  }));

  const rooms: Row[] = ROOM_DEFS.map(([building, name, groupId, jacuzzi, capacity], i) => {
    const slug = `${building}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: `room-${slug}`,
      building,
      name,
      jacuzzi,
      capacity,
      status: "available",
      rate_group_id: groupId,
      description: null,
      image_url: null,
      has_tv: true,
      has_swing: name === "Estelar" || name === "Oasis",
      active: true,
      sort_order: i,
      created_at: nowIso,
    };
  });

  const extras: Row[] = EXTRAS.map((e) => ({ ...e, active: true, image_url: null, created_at: nowIso }));

  const gift_thresholds: Row[] = [
    { id: "gt-1", min_extras_total: 80, gift_extra_id: "ex-cava", active: true },
  ];

  const dynamic_rules: Row[] = [
    { id: "dr-occ", type: "occupancy", name: "Alta ocupación", config: { threshold: 70 }, multiplier: 15, active: false, created_at: nowIso },
    { id: "dr-sanvalentin", type: "date", name: "San Valentín", config: { from: "2027-02-13", to: "2027-02-14" }, multiplier: 20, active: false, created_at: nowIso },
  ];

  const customers: Row[] = CUSTOMERS.map((c) => ({ ...c, created_at: nowIso }));

  const { reservations, reservationExtras } = buildReservations(now);

  const user_roles: Row[] = [
    { id: "ur-1", user_id: DEMO_USER_ID, role: "admin", created_at: nowIso },
  ];

  return {
    rate_groups,
    rate_hourly,
    rate_overnight,
    rate_nightly,
    rate_third_person,
    rooms,
    extras,
    gift_thresholds,
    dynamic_rules,
    customers,
    reservations,
    reservation_extras: reservationExtras,
    user_roles,
    audit_log: [],
  };
}

// ── Persistence ────────────────────────────────────────────────────────────────
function canPersist() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadDb(): DemoDb {
  if (!canPersist()) return buildSeedDb();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === STORAGE_VERSION && parsed.db) {
        return parsed.db as DemoDb;
      }
    }
  } catch {
    /* fall through to reseed */
  }
  const fresh = buildSeedDb();
  saveDb(fresh);
  return fresh;
}

export function saveDb(db: DemoDb) {
  if (!canPersist()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, db }));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function resetDemoDb() {
  if (canPersist()) window.localStorage.removeItem(STORAGE_KEY);
}
