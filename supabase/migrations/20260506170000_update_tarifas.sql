-- Update hourly/overnight/third-person rates to May 2026 tariff sheet
-- Idempotent: safe to run multiple times.

begin;

-- 1) Ensure rate groups exist
insert into rate_groups (name)
values
  ('Grey'),
  ('Ruta 66'),
  ('Music/Empire/Paris/Space/Ocean'),
  ('Dubai/Tu y Yo/New York'),
  ('Hollywood'),
  ('Maldivas (sin jacuzzi)'),
  ('Tokyo (sin jacuzzi)')
on conflict (name) do nothing;

-- 2) Hourly rates (durations in minutes)
with
  g as (
    select id, name from rate_groups
    where name in (
      'Grey',
      'Ruta 66',
      'Music/Empire/Paris/Space/Ocean',
      'Dubai/Tu y Yo/New York',
      'Hollywood',
      'Maldivas (sin jacuzzi)',
      'Tokyo (sin jacuzzi)'
    )
  ),
  hourly(rate_group_name, duration_min, with_j, without_j) as (
    values
      -- Grey
      ('Grey', 60, 53, 48),
      ('Grey', 90, 68, 58),
      ('Grey', 120, 78, 68),
      ('Grey', 150, 92, 72),
      ('Grey', 180, 102, 88),
      ('Grey', 210, 108, 93),
      ('Grey', 240, 113, 98),
      ('Grey', 270, 118, 102),
      ('Grey', 300, 132, 108),
      ('Grey', 330, 138, 112),
      ('Grey', 360, 148, 128),

      -- Ruta 66
      ('Ruta 66', 60, 48, 43),
      ('Ruta 66', 90, 58, 52),
      ('Ruta 66', 120, 68, 58),
      ('Ruta 66', 150, 72, 62),
      ('Ruta 66', 180, 92, 78),
      ('Ruta 66', 210, 98, 83),
      ('Ruta 66', 240, 102, 88),
      ('Ruta 66', 270, 108, 92),
      ('Ruta 66', 300, 122, 98),
      ('Ruta 66', 330, 128, 102),
      ('Ruta 66', 360, 138, 118),

      -- Music / Empire State / Paris / Space / Ocean
      ('Music/Empire/Paris/Space/Ocean', 60, 43, 38),
      ('Music/Empire/Paris/Space/Ocean', 90, 52, 48),
      ('Music/Empire/Paris/Space/Ocean', 120, 62, 52),
      ('Music/Empire/Paris/Space/Ocean', 150, 68, 58),
      ('Music/Empire/Paris/Space/Ocean', 180, 88, 72),
      ('Music/Empire/Paris/Space/Ocean', 210, 92, 78),
      ('Music/Empire/Paris/Space/Ocean', 240, 98, 82),
      ('Music/Empire/Paris/Space/Ocean', 270, 102, 88),
      ('Music/Empire/Paris/Space/Ocean', 300, 118, 92),
      ('Music/Empire/Paris/Space/Ocean', 330, 122, 98),
      ('Music/Empire/Paris/Space/Ocean', 360, 132, 122),

      -- Dubai / Tu y Yo / New York
      ('Dubai/Tu y Yo/New York', 60, 45, 40),
      ('Dubai/Tu y Yo/New York', 90, 55, 50),
      ('Dubai/Tu y Yo/New York', 120, 65, 55),
      ('Dubai/Tu y Yo/New York', 150, 70, 60),
      ('Dubai/Tu y Yo/New York', 180, 90, 75),
      ('Dubai/Tu y Yo/New York', 210, 95, 80),
      ('Dubai/Tu y Yo/New York', 240, 100, 85),
      ('Dubai/Tu y Yo/New York', 270, 105, 90),
      ('Dubai/Tu y Yo/New York', 300, 120, 95),
      ('Dubai/Tu y Yo/New York', 330, 125, 100),
      ('Dubai/Tu y Yo/New York', 360, 135, 125),

      -- Hollywood
      ('Hollywood', 60, 43, 35),
      ('Hollywood', 90, 52, 40),
      ('Hollywood', 120, 62, 45),
      ('Hollywood', 150, 68, 50),
      ('Hollywood', 180, 88, 55),
      ('Hollywood', 210, 92, 60),
      ('Hollywood', 240, 98, 65),
      ('Hollywood', 270, 102, 70),
      ('Hollywood', 300, 118, 75),
      ('Hollywood', 330, 122, 80),
      ('Hollywood', 360, 132, 85),

      -- Maldivas (sin jacuzzi)
      ('Maldivas (sin jacuzzi)', 60, null, 38),
      ('Maldivas (sin jacuzzi)', 90, null, 43),
      ('Maldivas (sin jacuzzi)', 120, null, 48),
      ('Maldivas (sin jacuzzi)', 150, null, 53),
      ('Maldivas (sin jacuzzi)', 180, null, 58),
      ('Maldivas (sin jacuzzi)', 210, null, 63),
      ('Maldivas (sin jacuzzi)', 240, null, 68),
      ('Maldivas (sin jacuzzi)', 270, null, 73),
      ('Maldivas (sin jacuzzi)', 300, null, 78),
      ('Maldivas (sin jacuzzi)', 330, null, 83),
      ('Maldivas (sin jacuzzi)', 360, null, 88),

      -- Tokyo (sin jacuzzi)
      ('Tokyo (sin jacuzzi)', 60, null, 35),
      ('Tokyo (sin jacuzzi)', 90, null, 40),
      ('Tokyo (sin jacuzzi)', 120, null, 45),
      ('Tokyo (sin jacuzzi)', 150, null, 50),
      ('Tokyo (sin jacuzzi)', 180, null, 55),
      ('Tokyo (sin jacuzzi)', 210, null, 60),
      ('Tokyo (sin jacuzzi)', 240, null, 65),
      ('Tokyo (sin jacuzzi)', 270, null, 70),
      ('Tokyo (sin jacuzzi)', 300, null, 75),
      ('Tokyo (sin jacuzzi)', 330, null, 80),
      ('Tokyo (sin jacuzzi)', 360, null, 85)
  )
insert into rate_hourly (rate_group_id, duration_min, price_with_jacuzzi, price_without_jacuzzi)
select g.id, h.duration_min, h.with_j, h.without_j
from hourly h
join g on g.name = h.rate_group_name
on conflict (rate_group_id, duration_min)
do update set
  price_with_jacuzzi = excluded.price_with_jacuzzi,
  price_without_jacuzzi = excluded.price_without_jacuzzi;

-- 2b) (Optional) Assign rate groups to rooms by room name when missing.
-- This only fills NULL rate_group_id to avoid overwriting manual assignments.
update rooms
set rate_group_id = (select id from rate_groups where name = 'Grey')
where rate_group_id is null and lower(name) = 'grey';

update rooms
set rate_group_id = (select id from rate_groups where name = 'Ruta 66')
where rate_group_id is null and lower(name) in ('ruta 66', 'ruta66');

update rooms
set rate_group_id = (select id from rate_groups where name = 'Music/Empire/Paris/Space/Ocean')
where rate_group_id is null and lower(name) in (
  'music',
  'empire state',
  'empire',
  'parís',
  'paris',
  'space',
  'ocean'
);

update rooms
set rate_group_id = (select id from rate_groups where name = 'Dubai/Tu y Yo/New York')
where rate_group_id is null and lower(name) in (
  'dubái',
  'dubai',
  'tú y yo',
  'tu y yo',
  'new york'
);

update rooms
set rate_group_id = (select id from rate_groups where name = 'Hollywood')
where rate_group_id is null and lower(name) = 'hollywood';

update rooms
set rate_group_id = (select id from rate_groups where name = 'Maldivas (sin jacuzzi)')
where rate_group_id is null and lower(name) = 'maldivas';

update rooms
set rate_group_id = (select id from rate_groups where name = 'Tokyo (sin jacuzzi)')
where rate_group_id is null and lower(name) = 'tokyo';

-- 3) Overnight rates (sun-wed only; app enforces availability)
with
  g as (
    select id, name from rate_groups
    where name in (
      'Grey',
      'Ruta 66',
      'Music/Empire/Paris/Space/Ocean',
      'Dubai/Tu y Yo/New York'
    )
  ),
  overnight(rate_group_name, checkout_time, price) as (
    values
      -- Grey + Ruta 66
      ('Grey', '10:00:00'::time, 120),
      ('Grey', '11:00:00'::time, 130),
      ('Grey', '12:00:00'::time, 140),
      ('Ruta 66', '10:00:00'::time, 120),
      ('Ruta 66', '11:00:00'::time, 130),
      ('Ruta 66', '12:00:00'::time, 140),

      -- Music/Empire/Paris/Space/Ocean + Dubai/Tu y Yo/New York
      ('Music/Empire/Paris/Space/Ocean', '10:00:00'::time, 110),
      ('Music/Empire/Paris/Space/Ocean', '11:00:00'::time, 120),
      ('Music/Empire/Paris/Space/Ocean', '12:00:00'::time, 130),
      ('Dubai/Tu y Yo/New York', '10:00:00'::time, 110),
      ('Dubai/Tu y Yo/New York', '11:00:00'::time, 120),
      ('Dubai/Tu y Yo/New York', '12:00:00'::time, 130)
  )
insert into rate_overnight (rate_group_id, checkout_time, price)
select g.id, o.checkout_time, o.price
from overnight o
join g on g.name = o.rate_group_name
on conflict (rate_group_id, checkout_time)
do update set price = excluded.price;

-- 4) Third person surcharge (global; per extra person)
with third(duration_min, surcharge) as (
  values
    (60, 15),
    (90, 25),
    (120, 30),
    (150, 40),
    (180, 45),
    (210, 55),
    (240, 60),
    (270, 70),
    (300, 75),
    (330, 85),
    (360, 90)
)
insert into rate_third_person (duration_min, surcharge)
select duration_min, surcharge from third
on conflict (duration_min)
do update set surcharge = excluded.surcharge;

commit;
