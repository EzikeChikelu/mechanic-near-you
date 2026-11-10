-- Restrict booking creation and enforce legal status transitions.
drop policy if exists "Customers can create service requests" on public.service_requests;
create policy "Customers can request available mechanics" on public.service_requests
for insert to authenticated with check (
 customer_id=auth.uid()
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='customer')
 and mechanic_id is not null
 and exists(select 1 from public.mechanic_profiles mp join public.mechanic_locations ml on ml.mechanic_id=mp.user_id
  where mp.user_id=mechanic_id and mp.is_online=true and mp.verification_status='verified'
  and ml.updated_at>now()-interval '5 minutes')
);
drop policy if exists "Participants can update service requests" on public.service_requests;
create or replace function public.respond_to_service_request(p_request_id uuid,p_action text)
returns public.request_status language plpgsql security definer set search_path=public as $$
declare r public.service_requests%rowtype; n public.request_status;
begin
 select * into r from public.service_requests where id=p_request_id for update;
 if not found then raise exception 'Service request not found'; end if;
 if auth.uid()=r.mechanic_id then
  if p_action='accept' and r.status='pending' then n='accepted';
  elsif p_action='decline' and r.status='pending' then n='declined';
  elsif p_action='en_route' and r.status='accepted' then n='en_route';
  elsif p_action='in_progress' and r.status='en_route' then n='in_progress';
  elsif p_action='complete' and r.status='in_progress' then n='completed';
  else raise exception 'Action is not allowed for this request'; end if;
 elsif auth.uid()=r.customer_id and p_action='cancel' and r.status in ('pending','accepted') then n='cancelled';
 else raise exception 'You are not allowed to perform this action'; end if;
 update public.service_requests set status=n,updated_at=now() where id=p_request_id;
 return n;
end $$;
revoke all on function public.respond_to_service_request(uuid,text) from public;
grant execute on function public.respond_to_service_request(uuid,text) to authenticated;
