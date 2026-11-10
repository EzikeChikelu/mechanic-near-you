-- Temporary launch rule: a complete mechanic profile is listable.
-- This is NOT identity, document, licence, or background verification.
-- Mechanics must still explicitly go online and share a fresh location.

update public.mechanic_profiles mp
set verification_status = 'verified',
    updated_at = now()
from public.profiles p
where p.id = mp.user_id
  and p.role = 'mechanic'
  and nullif(btrim(p.full_name), '') is not null
  and nullif(btrim(p.phone), '') is not null
  and nullif(btrim(p.state), '') is not null
  and nullif(btrim(p.city), '') is not null
  and exists (
    select 1
    from public.mechanic_services ms
    where ms.mechanic_id = mp.user_id
  );
