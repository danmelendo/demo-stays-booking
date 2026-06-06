
-- Enums
create type room_status as enum ('available', 'occupied', 'cleaning', 'out_of_service');
create type reservation_status as enum ('confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
create type jacuzzi_option as enum ('none', 'optional', 'always');
create type dynamic_rule_type as enum ('occupancy', 'date');
create type extra_category as enum ('decoration', 'drinks', 'hookah', 'accessories', 'services');

-- Rate groups
create table rate_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Rooms
create table rooms (
  id uuid primary key default gen_random_uuid(),
  building text not null,
  name text not null,
  jacuzzi jacuzzi_option not null default 'optional',
  capacity integer not null default 2,
  status room_status not null default 'available',
  rate_group_id uuid references rate_groups(id) on delete set null,
  description text,
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (building, name)
);

-- Hourly rates
create table rate_hourly (
  id uuid primary key default gen_random_uuid(),
  rate_group_id uuid not null references rate_groups(id) on delete cascade,
  duration_min integer not null,
  price_with_jacuzzi numeric(10,2),
  price_without_jacuzzi numeric(10,2),
  unique (rate_group_id, duration_min)
);

-- Overnight rates (sun-wed only)
create table rate_overnight (
  id uuid primary key default gen_random_uuid(),
  rate_group_id uuid not null references rate_groups(id) on delete cascade,
  checkout_time time not null,
  price numeric(10,2) not null,
  unique (rate_group_id, checkout_time)
);

-- Third person surcharge (global)
create table rate_third_person (
  id uuid primary key default gen_random_uuid(),
  duration_min integer not null unique,
  surcharge numeric(10,2) not null
);

-- Dynamic pricing rules
create table dynamic_rules (
  id uuid primary key default gen_random_uuid(),
  type dynamic_rule_type not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  multiplier numeric(5,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Extras catalog
create table extras (
  id uuid primary key default gen_random_uuid(),
  category extra_category not null,
  name text not null,
  price numeric(10,2) not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Gift thresholds
create table gift_thresholds (
  id uuid primary key default gen_random_uuid(),
  min_extras_total numeric(10,2) not null unique,
  gift_extra_id uuid not null references extras(id) on delete cascade,
  active boolean not null default true
);

-- Customers
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);
create index customers_phone_idx on customers (phone);

-- Reservations
create table reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete restrict,
  customer_id uuid references customers(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  with_jacuzzi boolean not null default false,
  people integer not null default 2,
  is_overnight boolean not null default false,
  base_price numeric(10,2) not null default 0,
  third_person_surcharge numeric(10,2) not null default 0,
  dynamic_surcharge numeric(10,2) not null default 0,
  dynamic_reason text,
  extras_total numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  paid_amount numeric(10,2) not null default 0,
  status reservation_status not null default 'confirmed',
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index reservations_room_time_idx on reservations (room_id, start_at, end_at);
create index reservations_start_idx on reservations (start_at);

-- 15 minute gap enforcement via trigger
create or replace function check_reservation_gap()
returns trigger language plpgsql as $$
begin
  if new.status in ('cancelled', 'no_show') then
    return new;
  end if;
  if exists (
    select 1 from reservations r
    where r.room_id = new.room_id
      and r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and r.status not in ('cancelled', 'no_show')
      and tstzrange(r.start_at - interval '15 minutes', r.end_at + interval '15 minutes', '[)')
          && tstzrange(new.start_at, new.end_at, '[)')
  ) then
    raise exception 'Conflicto de reserva: debe haber al menos 15 minutos entre reservas en la misma habitacion';
  end if;
  return new;
end;
$$;
create trigger reservations_gap_check
  before insert or update on reservations
  for each row execute function check_reservation_gap();

-- Reservation extras
create table reservation_extras (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  extra_id uuid not null references extras(id) on delete restrict,
  qty integer not null default 1,
  unit_price numeric(10,2) not null,
  is_gift boolean not null default false,
  created_at timestamptz not null default now()
);
create index reservation_extras_reservation_idx on reservation_extras (reservation_id);

-- Audit log
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  entity_id uuid,
  action text not null,
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb,
  at timestamptz not null default now()
);

-- updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger reservations_updated_at before update on reservations
  for each row execute function set_updated_at();

-- RLS: only authenticated users (reception staff)
alter table rate_groups enable row level security;
alter table rooms enable row level security;
alter table rate_hourly enable row level security;
alter table rate_overnight enable row level security;
alter table rate_third_person enable row level security;
alter table dynamic_rules enable row level security;
alter table extras enable row level security;
alter table gift_thresholds enable row level security;
alter table customers enable row level security;
alter table reservations enable row level security;
alter table reservation_extras enable row level security;
alter table audit_log enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['rate_groups','rooms','rate_hourly','rate_overnight','rate_third_person','dynamic_rules','extras','gift_thresholds','customers','reservations','reservation_extras','audit_log'])
  loop
    execute format('create policy "auth_all_select" on %I for select to authenticated using (true);', t);
    execute format('create policy "auth_all_insert" on %I for insert to authenticated with check (true);', t);
    execute format('create policy "auth_all_update" on %I for update to authenticated using (true) with check (true);', t);
    execute format('create policy "auth_all_delete" on %I for delete to authenticated using (true);', t);
  end loop;
end $$;
