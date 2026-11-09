-- Tighten profile visibility: do not expose every user's phone number to all signed-in users.
drop policy if exists "Authenticated users can view profiles" on public.profiles;

create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Request participants can view each other's profiles"
  on public.profiles for select to authenticated
  using (exists (
    select 1 from public.service_requests r
    where (r.customer_id = auth.uid() and r.mechanic_id = profiles.id)
       or (r.mechanic_id = auth.uid() and r.customer_id = profiles.id)
  ));
