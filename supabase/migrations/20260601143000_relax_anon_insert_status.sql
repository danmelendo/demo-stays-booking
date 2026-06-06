-- Allow anon bookings to be inserted as either 'pending' (new frontend, which
-- only confirms after a successful Redsys payment) or 'confirmed' (older
-- deployed frontend that did not set a status). This avoids breaking live
-- bookings during the window where the DB is updated but the new build is not
-- yet deployed. It can be tightened to status = 'pending' once every deployed
-- frontend sends the pending status.
DROP POLICY IF EXISTS "public insert reservations" ON public.reservations;
CREATE POLICY "public insert reservations" ON public.reservations
  FOR INSERT TO anon
  WITH CHECK (manual_override = false AND status IN ('pending', 'confirmed') AND deposit_paid = false);
