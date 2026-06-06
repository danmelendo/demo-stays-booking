-- Public bookings are created as 'pending' and only become 'confirmed' once the
-- Redsys payment succeeds; a failed/refused payment marks them 'rejected'.

-- Anon may only INSERT pending, unpaid, non-override reservations.
DROP POLICY IF EXISTS "public insert reservations" ON public.reservations;
CREATE POLICY "public insert reservations" ON public.reservations
  FOR INSERT TO anon
  WITH CHECK (manual_override = false AND status = 'pending' AND deposit_paid = false);

-- Anon may transition their own unpaid reservation to 'rejected' (failed payment).
-- The WITH CHECK prevents using this to self-confirm or mark as paid.
DROP POLICY IF EXISTS "public reject pending reservations" ON public.reservations;
CREATE POLICY "public reject pending reservations" ON public.reservations
  FOR UPDATE TO anon
  USING (deposit_paid = false)
  WITH CHECK (deposit_paid = false AND status = 'rejected');

-- Rejected reservations must never block a time slot (same as cancelled/no_show).
CREATE OR REPLACE FUNCTION public.check_reservation_gap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.status IN ('cancelled', 'no_show', 'rejected') THEN
    RETURN new;
  END IF;
  IF new.manual_override THEN
    RETURN new;
  END IF;
  IF EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.room_id = new.room_id
      AND r.id <> COALESCE(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND r.status NOT IN ('cancelled', 'no_show', 'rejected')
      AND (r.deposit_paid = true OR r.created_at > now() - interval '60 minutes')
      AND tstzrange(r.start_at - interval '15 minutes', r.end_at + interval '15 minutes', '[)')
          && tstzrange(new.start_at, new.end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Conflicto de reserva: debe haber al menos 15 minutos entre reservas en la misma habitacion';
  END IF;
  RETURN new;
END;
$$;
