-- Ensure specific rooms use the intended rate groups, and ensure overnight price (10:00 checkout) is defined.
-- Targets:
-- - Sur · Maldivas  -> rate group "Maldivas (sin jacuzzi)"
-- - Norte · Hollywood  -> rate group "Hollywood"
-- Idempotent: safe to run multiple times.

begin;

-- 1) Force the correct rate_group_id for the specific rooms (do not rely on NULL-only assignment)
update rooms r
set rate_group_id = (select id from rate_groups where name = 'Maldivas (sin jacuzzi)')
where lower(r.building) = 'sur'
  and lower(r.name) = 'maldivas';

update rooms r
set rate_group_id = (select id from rate_groups where name = 'Hollywood')
where lower(r.building) = 'norte'
  and lower(r.name) = 'hollywood';

-- 2) Ensure overnight (10:00) is set to 110€ for those rate groups
with
  g as (
    select id, name
    from rate_groups
    where name in ('Hollywood', 'Maldivas (sin jacuzzi)')
  ),
  overnight(rate_group_name, checkout_time, price) as (
    values
      ('Hollywood', '10:00:00'::time, 110),
      ('Maldivas (sin jacuzzi)', '10:00:00'::time, 110)
  )
insert into rate_overnight (rate_group_id, checkout_time, price)
select g.id, o.checkout_time, o.price
from overnight o
join g on g.name = o.rate_group_name
on conflict (rate_group_id, checkout_time)
do update set price = excluded.price;

commit;

