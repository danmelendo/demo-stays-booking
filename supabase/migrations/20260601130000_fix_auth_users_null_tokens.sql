-- Fix login error "Database error querying schema".
--
-- The staff users created in 20260528220000_create_staff_users.sql were
-- inserted directly into auth.users and only set confirmation_token and
-- recovery_token to ''. The remaining GoTrue token/string columns were left
-- NULL. Modern GoTrue (Supabase Auth) scans these columns into Go strings,
-- and a NULL value makes the query fail, so every login attempt returns
-- "Database error querying schema".
--
-- Backfill any NULLs with empty strings. Idempotent and safe to re-run; on a
-- fresh deploy it runs right after the staff users are created.
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where confirmation_token is null
   or recovery_token is null
   or email_change is null
   or email_change_token_new is null
   or email_change_token_current is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;
