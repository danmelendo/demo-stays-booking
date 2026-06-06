-- Create initial staff users directly in auth schema.
-- Signups are disabled at the frontend; new users must be added via Supabase Dashboard.

DO $$
DECLARE
  admin_id  uuid;
  admin2_id uuid;
  rec1_id   uuid;
  rec2_id   uuid;
BEGIN

  -- ── Admin ────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@demostays.example') THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_id, 'authenticated', 'authenticated',
      'admin@demostays.example',
      extensions.crypt('demo-admin-password', extensions.gen_salt('bf')),
      NOW(), '{"provider":"email","providers":["email"]}', '{}',
      NOW(), NOW(), '', ''
    );
    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      admin_id::text, admin_id,
      format('{"sub":"%s","email":"admin@demostays.example"}', admin_id)::jsonb,
      'email', NOW(), NOW(), NOW()
    );
    -- trigger handle_new_user auto-inserts 'reception'; add 'admin' on top
    INSERT INTO public.user_roles (user_id, role) VALUES (admin_id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  -- ── Admin2 ───────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin2@demostays.example') THEN
    admin2_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin2_id, 'authenticated', 'authenticated',
      'admin2@demostays.example',
      extensions.crypt('demo-admin-password', extensions.gen_salt('bf')),
      NOW(), '{"provider":"email","providers":["email"]}', '{}',
      NOW(), NOW(), '', ''
    );
    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      admin2_id::text, admin2_id,
      format('{"sub":"%s","email":"admin2@demostays.example"}', admin2_id)::jsonb,
      'email', NOW(), NOW(), NOW()
    );
    INSERT INTO public.user_roles (user_id, role) VALUES (admin2_id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  -- ── RMRecepcion1 ─────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'rmrecepcion1@demostays.example') THEN
    rec1_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      rec1_id, 'authenticated', 'authenticated',
      'rmrecepcion1@demostays.example',
      extensions.crypt('12345', extensions.gen_salt('bf')),
      NOW(), '{"provider":"email","providers":["email"]}', '{}',
      NOW(), NOW(), '', ''
    );
    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      rec1_id::text, rec1_id,
      format('{"sub":"%s","email":"rmrecepcion1@demostays.example"}', rec1_id)::jsonb,
      'email', NOW(), NOW(), NOW()
    );
    -- trigger handle_new_user already inserts 'reception' automatically
  END IF;

  -- ── RMRecepcion2 ─────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'rmrecepcion2@demostays.example') THEN
    rec2_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      rec2_id, 'authenticated', 'authenticated',
      'rmrecepcion2@demostays.example',
      extensions.crypt('12345', extensions.gen_salt('bf')),
      NOW(), '{"provider":"email","providers":["email"]}', '{}',
      NOW(), NOW(), '', ''
    );
    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      rec2_id::text, rec2_id,
      format('{"sub":"%s","email":"rmrecepcion2@demostays.example"}', rec2_id)::jsonb,
      'email', NOW(), NOW(), NOW()
    );
    -- trigger handle_new_user already inserts 'reception' automatically
  END IF;

END $$;
