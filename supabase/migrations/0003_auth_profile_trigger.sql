create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_role public.account_role;
begin
  chosen_role := case
    when new.raw_user_meta_data ->> 'role' = 'mechanic' then 'mechanic'::public.account_role
    else 'customer'::public.account_role
  end;
  insert into public.profiles (id, role, full_name, phone)
  values (new.id, chosen_role, coalesce(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;
  if chosen_role = 'mechanic' then
    insert into public.mechanic_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
