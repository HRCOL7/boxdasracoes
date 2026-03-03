-- Customer auth/profile + ERP queue setup for site registration flow
-- Run in Supabase SQL Editor

begin;

create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  document text,
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customer_erp_queue (
  id bigint generated always as identity primary key,
  customer_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  document text,
  address text,
  status text not null default 'pending',
  source text not null default 'site_signup',
  last_error text,
  processed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists customer_erp_queue_status_idx on public.customer_erp_queue(status, created_at);

create or replace function public.set_customer_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_customer_profiles_updated_at on public.customer_profiles;
create trigger trg_customer_profiles_updated_at
before update on public.customer_profiles
for each row execute function public.set_customer_profiles_updated_at();

alter table public.customer_profiles enable row level security;
alter table public.customer_erp_queue enable row level security;

-- customer_profiles: owner can read/write own profile
drop policy if exists "customer_profiles_select_own" on public.customer_profiles;
create policy "customer_profiles_select_own"
on public.customer_profiles
for select
using (auth.uid() = id);

drop policy if exists "customer_profiles_insert_own" on public.customer_profiles;
create policy "customer_profiles_insert_own"
on public.customer_profiles
for insert
with check (auth.uid() = id);

drop policy if exists "customer_profiles_update_own" on public.customer_profiles;
create policy "customer_profiles_update_own"
on public.customer_profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- queue: authenticated users can insert their own signup payload
drop policy if exists "customer_queue_insert_authenticated" on public.customer_erp_queue;
create policy "customer_queue_insert_authenticated"
on public.customer_erp_queue
for insert
to authenticated
with check (true);

-- queue read/update only for service role or backend process
drop policy if exists "customer_queue_no_public_read" on public.customer_erp_queue;
create policy "customer_queue_no_public_read"
on public.customer_erp_queue
for select
to authenticated
using (false);

commit;
