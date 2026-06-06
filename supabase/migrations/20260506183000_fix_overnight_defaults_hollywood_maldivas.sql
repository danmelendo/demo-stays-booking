-- Fix overnight rates defaulting to 0 for some rate groups.
-- Ensures Hollywood and Maldivas (sin jacuzzi) have an overnight base price of 110 at 10:00 checkout.
-- Idempotent: safe to run multiple times.

begin;

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

