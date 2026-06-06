
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS has_tv boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_swing boolean NOT NULL DEFAULT false;

ALTER TABLE public.extras
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS no_contact boolean NOT NULL DEFAULT false;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS deposit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS created_by_role text;

-- Realtime para reservas (notificaciones internas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reservations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations';
  END IF;
END $$;

ALTER TABLE public.reservations REPLICA IDENTITY FULL;
