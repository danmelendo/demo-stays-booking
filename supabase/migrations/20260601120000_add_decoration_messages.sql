-- Decoration extras (Plus 30€, Premium 50€, Premium Deluxe 145€) let the
-- customer choose two phrases that staff set up in the room:
--   bed_message    -> phrase laid out on the bed with petals (max 2 words)
--   screen_message -> phrase on the glass / LED screen (max 10 words)
-- Word limits are enforced in the booking UI; the columns are free text.
alter table reservation_extras
  add column if not exists bed_message text,
  add column if not exists screen_message text;
