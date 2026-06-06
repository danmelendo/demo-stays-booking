-- Add "Grey" room to the Central building, mirroring Grey rooms in other buildings.
-- Idempotent: ON CONFLICT (building, name) DO NOTHING.

begin;

insert into rooms (building, name, jacuzzi, capacity, rate_group_id, active)
select
  'central',
  'Grey',
  'always'::jacuzzi_option,
  2,
  (select id from rate_groups where name = 'Grey'),
  true
on conflict (building, name) do nothing;

-- Safety: if the row already existed without a rate group, attach it now.
update rooms
set rate_group_id = (select id from rate_groups where name = 'Grey')
where lower(building) = 'central'
  and lower(name) = 'grey'
  and rate_group_id is null;

commit;
