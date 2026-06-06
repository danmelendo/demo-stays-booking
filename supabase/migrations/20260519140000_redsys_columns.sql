-- Replace Stripe references with Redsys and add paid_amount column.

begin;

ALTER TABLE public.reservations
  RENAME COLUMN stripe_session_id TO redsys_order;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS paid_amount numeric(10,2);

commit;
