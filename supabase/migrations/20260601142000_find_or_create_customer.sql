-- Deduplicate customers created from the public booking flow.
--
-- The public page (reservar.tsx) runs as the anon role, which has no SELECT on
-- customers, so it used to always INSERT a brand-new customer row — producing
-- exact duplicates whenever the same person booked (or during testing).
--
-- This SECURITY DEFINER function does a find-or-create by email (the admin
-- dialog already dedupes by phone/email), returning the canonical customer id.
create or replace function public.find_or_create_customer(
  p_name text,
  p_email text,
  p_phone text default null,
  p_no_contact boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_email is not null and btrim(p_email) <> '' then
    select id into v_id
      from customers
     where lower(email) = lower(btrim(p_email))
     order by created_at asc
     limit 1;
  end if;

  if v_id is not null then
    update customers set
      name       = coalesce(nullif(btrim(p_name), ''), name),
      phone      = coalesce(nullif(btrim(p_phone), ''), phone),
      no_contact = coalesce(p_no_contact, no_contact)
     where id = v_id;
    return v_id;
  end if;

  insert into customers (name, email, phone, no_contact)
  values (
    nullif(btrim(p_name), ''),
    nullif(btrim(p_email), ''),
    nullif(btrim(p_phone), ''),
    coalesce(p_no_contact, false)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.find_or_create_customer(text, text, text, boolean) to anon, authenticated;
