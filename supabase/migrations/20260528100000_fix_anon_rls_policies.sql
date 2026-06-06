-- Fix: ensure anon RLS policies exist for the public booking flow.
-- These may be missing if migrations from 20260507124325 were not applied to production.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'public insert customers'
  ) THEN
    CREATE POLICY "public insert customers" ON public.customers FOR INSERT TO anon WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reservations' AND policyname = 'public insert reservations'
  ) THEN
    CREATE POLICY "public insert reservations" ON public.reservations FOR INSERT TO anon WITH CHECK (manual_override = false AND status = 'confirmed');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reservation_extras' AND policyname = 'public insert reservation_extras'
  ) THEN
    CREATE POLICY "public insert reservation_extras" ON public.reservation_extras FOR INSERT TO anon WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'public read rooms'
  ) THEN
    CREATE POLICY "public read rooms" ON public.rooms FOR SELECT TO anon USING (active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'extras' AND policyname = 'public read extras'
  ) THEN
    CREATE POLICY "public read extras" ON public.extras FOR SELECT TO anon USING (active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rate_groups' AND policyname = 'public read rate_groups'
  ) THEN
    CREATE POLICY "public read rate_groups" ON public.rate_groups FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rate_hourly' AND policyname = 'public read rate_hourly'
  ) THEN
    CREATE POLICY "public read rate_hourly" ON public.rate_hourly FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rate_overnight' AND policyname = 'public read rate_overnight'
  ) THEN
    CREATE POLICY "public read rate_overnight" ON public.rate_overnight FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rate_third_person' AND policyname = 'public read rate_third_person'
  ) THEN
    CREATE POLICY "public read rate_third_person" ON public.rate_third_person FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dynamic_rules' AND policyname = 'public read dynamic_rules'
  ) THEN
    CREATE POLICY "public read dynamic_rules" ON public.dynamic_rules FOR SELECT TO anon USING (active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gift_thresholds' AND policyname = 'public read gift_thresholds'
  ) THEN
    CREATE POLICY "public read gift_thresholds" ON public.gift_thresholds FOR SELECT TO anon USING (active = true);
  END IF;
END $$;
