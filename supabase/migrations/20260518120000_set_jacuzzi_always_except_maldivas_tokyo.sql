-- Set jacuzzi = 'always' for all rooms except Maldivas and Tokyo (which have no jacuzzi).
-- Only Maldivas and Tokyo keep jacuzzi = 'none'; all other rooms go from 'optional' -> 'always'.
-- Idempotent: safe to run multiple times.

begin;

-- All rooms -> always (con jacuzzi)
update rooms
set jacuzzi = 'always'
where lower(name) not in ('maldivas', 'tokyo');

-- Maldivas and Tokyo explicitly -> none (sin jacuzzi)
update rooms
set jacuzzi = 'none'
where lower(name) in ('maldivas', 'tokyo');

commit;
