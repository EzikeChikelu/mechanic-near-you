-- Mechanic Near You: initial PostgreSQL/PostGIS schema
-- Apply in the Supabase SQL Editor. Review policies before production launch.

create extension if not exists postgis with schema extensions;

create type public.account_role as enum ('customer', 'mechanic');
create type public.request_status as enum ('pending', 'accepted', 'declined', 'en_route', 'in_progress', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.account_role not null,
  full_name text not null default '',
  phone text,
  avatar_url text,
  state text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mechanic_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  business_name text,
  bio text,
  years_experience integer not null default 0 check (years_experience >= 0),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  is_online boolean not null default false,
  service_radius_km integer not null default 15 check (service_radius_km between 1 and 100),
  average_rating numeric(2,1) not null default 0,
  completed_jobs integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.mechanic_services (
  id bigint generated always as identity primary key,
  mechanic_id uuid not null references public.mechanic_profiles(user_id) on delete cascade,
  service_name text not null,
  unique (mechanic_id, service_name)
);

create table public.mechanic_locations (
  mechanic_id uuid primary key references public.mechanic_profiles(user_id) on delete cascade,
  location extensions.geography(point, 4326) not null,
  accuracy_m numeric,
  heading numeric,
  updated_at timestamptz not null default now()
);

create index mechanic_locations_geog_idx
  on public.mechanic_locations using gist (location);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  mechanic_id uuid references public.mechanic_profiles(user_id),
  issue_title text not null,
  issue_description text,
  vehicle_details text,
  status public.request_status not null default 'pending',
  pickup_location extensions.geography(point, 4326),
  pickup_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_request_created_idx on public.messages(request_id, created_at);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests(id),
  customer_id uuid not null references public.profiles(id),
  mechanic_id uuid not null references public.mechanic_profiles(user_id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.mechanic_profiles enable row level security;
alter table public.mechanic_services enable row level security;
alter table public.mechanic_locations enable row level security;
alter table public.service_requests enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;

-- Profiles: users can read basic profiles and update only their own record.
create policy "Authenticated users can view profiles"
  on public.profiles for select to authenticated using (true);
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Mechanic public listing data; sensitive live coordinates remain private.
create policy "Authenticated users can view mechanic cards"
  on public.mechanic_profiles for select to authenticated using (true);
create policy "Mechanics manage their own profile"
  on public.mechanic_profiles for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Authenticated users can view mechanic services"
  on public.mechanic_services for select to authenticated using (true);
create policy "Mechanics manage their services"
  on public.mechanic_services for all to authenticated
  using (auth.uid() = mechanic_id) with check (auth.uid() = mechanic_id);
create policy "Mechanics manage their own live location"
  on public.mechanic_locations for all to authenticated
  using (auth.uid() = mechanic_id) with check (auth.uid() = mechanic_id);

-- Only the customer who created a request and its assigned mechanic can read it.
create policy "Participants can view service requests"
  on public.service_requests for select to authenticated
  using (auth.uid() = customer_id or auth.uid() = mechanic_id);
create policy "Customers can create service requests"
  on public.service_requests for insert to authenticated
  with check (auth.uid() = customer_id);
create policy "Participants can update service requests"
  on public.service_requests for update to authenticated
  using (auth.uid() = customer_id or auth.uid() = mechanic_id)
  with check (auth.uid() = customer_id or auth.uid() = mechanic_id);

create policy "Request participants can read messages"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.service_requests r
    where r.id = request_id and (r.customer_id = auth.uid() or r.mechanic_id = auth.uid())
  ));
create policy "Request participants can send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid() and exists (
      select 1 from public.service_requests r
      where r.id = request_id and (r.customer_id = auth.uid() or r.mechanic_id = auth.uid())
    )
  );

create policy "Users can read reviews"
  on public.reviews for select to authenticated using (true);
create policy "Customers can review completed jobs"
  on public.reviews for insert to authenticated
  with check (
    customer_id = auth.uid() and exists (
      select 1 from public.service_requests r
      where r.id = request_id and r.customer_id = auth.uid()
        and r.mechanic_id = mechanic_id and r.status = 'completed'
    )
  );

-- Returns only verified mechanics who explicitly opted in and whose GPS is fresh.
-- Coordinates are not returned to clients; only rounded distance is exposed.
create or replace function public.find_nearby_mechanics(
  customer_lat double precision,
  customer_lon double precision,
  radius_m integer default 10000
)
returns table (
  mechanic_id uuid,
  display_name text,
  phone text,
  business_name text,
  distance_m integer,
  average_rating numeric,
  completed_jobs integer,
  services text[]
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    mp.user_id,
    coalesce(nullif(mp.business_name, ''), p.full_name),
    p.phone,
    mp.business_name,
    round(extensions.st_distance(
      ml.location,
      extensions.st_setsrid(extensions.st_makepoint(customer_lon, customer_lat), 4326)::extensions.geography
    ))::integer,
    mp.average_rating,
    mp.completed_jobs,
    coalesce(array_agg(ms.service_name) filter (where ms.service_name is not null), '{}')
  from public.mechanic_profiles mp
  join public.profiles p on p.id = mp.user_id
  join public.mechanic_locations ml on ml.mechanic_id = mp.user_id
  left join public.mechanic_services ms on ms.mechanic_id = mp.user_id
  where auth.uid() is not null
    and mp.is_online = true
    and mp.verification_status = 'verified'
    and ml.updated_at > now() - interval '5 minutes'
    and extensions.st_dwithin(
      ml.location,
      extensions.st_setsrid(extensions.st_makepoint(customer_lon, customer_lat), 4326)::extensions.geography,
      least(greatest(radius_m, 500), 50000)
    )
  group by mp.user_id, p.full_name, p.phone, mp.business_name, ml.location,
    mp.average_rating, mp.completed_jobs
  order by 5 asc;
$$;

revoke all on function public.find_nearby_mechanics(double precision, double precision, integer) from public;
grant execute on function public.find_nearby_mechanics(double precision, double precision, integer) to authenticated;
