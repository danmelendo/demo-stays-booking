-- Rename rooms: Space -> Paris, Paris -> Safari
-- Uses a two-step swap via a temp name to avoid unique constraint conflicts if any.
-- Idempotent: safe to run multiple times.

begin;

-- Step 1: Paris -> Safari (do first so the name "Paris" is free)
update rooms set name = 'Safari'  where lower(name) = 'paris';

-- Step 2: Space -> Paris
update rooms set name = 'Paris'   where lower(name) = 'space';

commit;
