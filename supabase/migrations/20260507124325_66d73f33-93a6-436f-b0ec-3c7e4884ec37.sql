-- Roles enum + table
create type public.app_role as enum ('admin', 'reception', 'customer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users see own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Auto-assign 'reception' role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'reception')
    on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Manual override on reservations (admin-only client-side gate)
alter table public.reservations add column manual_override boolean not null default false;

-- Update gap trigger to skip when manual_override is true
create or replace function public.check_reservation_gap()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('cancelled', 'no_show') then
    return new;
  end if;
  if new.manual_override then
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

-- Public read access (rooms, extras, rate_groups, rate_hourly, rate_overnight, rate_third_person, dynamic_rules, gift_thresholds)
create policy "public read rooms" on public.rooms for select to anon using (active = true);
create policy "public read extras" on public.extras for select to anon using (active = true);
create policy "public read rate_groups" on public.rate_groups for select to anon using (true);
create policy "public read rate_hourly" on public.rate_hourly for select to anon using (true);
create policy "public read rate_overnight" on public.rate_overnight for select to anon using (true);
create policy "public read rate_third_person" on public.rate_third_person for select to anon using (true);
create policy "public read dynamic_rules" on public.dynamic_rules for select to anon using (active = true);
create policy "public read gift_thresholds" on public.gift_thresholds for select to anon using (active = true);

-- Public insert for guest bookings (customers + reservations + reservation_extras)
create policy "public insert customers" on public.customers for insert to anon with check (true);
create policy "public insert reservations" on public.reservations for insert to anon with check (manual_override = false and status = 'confirmed');
create policy "public insert reservation_extras" on public.reservation_extras for insert to anon with check (is_gift = false or is_gift = true);
