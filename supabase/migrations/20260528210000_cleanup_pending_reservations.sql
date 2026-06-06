-- Allow anon to read reservations (needed for availability check query).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reservations' AND policyname = 'public read reservations'
  ) THEN
    CREATE POLICY "public read reservations" ON public.reservations
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Allow anon to delete their own unpaid reservations (cleanup after failed/abandoned payment).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reservations' AND policyname = 'public delete pending reservations'
  ) THEN
    CREATE POLICY "public delete pending reservations" ON public.reservations
      FOR DELETE TO anon USING (deposit_paid = false);
  END IF;
END $$;

-- Allow anon to delete extras linked to unpaid reservations.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reservation_extras' AND policyname = 'public delete pending reservation_extras'
  ) THEN
    CREATE POLICY "public delete pending reservation_extras" ON public.reservation_extras
      FOR DELETE TO anon USING (
        EXISTS (
          SELECT 1 FROM public.reservations r
          WHERE r.id = reservation_extras.reservation_id
            AND r.deposit_paid = false
        )
      );
  END IF;
END $$;

-- Update gap trigger to ignore stale unpaid reservations (older than 60 minutes).
-- This prevents abandoned payment attempts from permanently blocking time slots.
CREATE OR REPLACE FUNCTION public.check_reservation_gap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.status IN ('cancelled', 'no_show') THEN
    RETURN new;
  END IF;
  IF new.manual_override THEN
    RETURN new;
  END IF;
  IF EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.room_id = new.room_id
      AND r.id <> COALESCE(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND r.status NOT IN ('cancelled', 'no_show')
      AND (r.deposit_paid = true OR r.created_at > now() - interval '60 minutes')
      AND tstzrange(r.start_at - interval '15 minutes', r.end_at + interval '15 minutes', '[)')
          && tstzrange(new.start_at, new.end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Conflicto de reserva: debe haber al menos 15 minutos entre reservas en la misma habitacion';
  END IF;
  RETURN new;
END;
$$;
