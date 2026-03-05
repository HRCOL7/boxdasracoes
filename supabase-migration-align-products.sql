-- Align existing Supabase public.products schema with BOXDASRACOES admin payload
-- Safe migration path:
-- 1) Preserves existing UUID IDs in legacy_uuid
-- 2) Converts runtime PK to BIGINT (compatible with Date.now() IDs used by admin)
-- 3) Adds missing columns expected by frontend/admin
-- 4) Keeps/creates indexes and RLS policies

begin;

-- Ensure table exists
create table if not exists public.products (
  id bigint primary key,
  name text not null
);

-- ===== 1) ID migration (uuid -> bigint) when needed =====
do $$
declare
  id_data_type text;
  pk_name text;
begin
  select c.data_type
    into id_data_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'products'
    and c.column_name = 'id';

  -- If current id is uuid, convert safely to bigint while preserving old values
  if id_data_type = 'uuid' then
    -- Preserve old UUID
    alter table public.products add column if not exists legacy_uuid uuid;
    update public.products set legacy_uuid = id where legacy_uuid is null;

    -- Temporary bigint id column
    alter table public.products add column if not exists id_new bigint;

    -- Sequence for deterministic IDs for migrated rows
    create sequence if not exists public.products_id_seq;

    -- Fill only missing values
    update public.products
       set id_new = nextval('public.products_id_seq')
     where id_new is null;

    -- Drop old PK on id (if any)
    select tc.constraint_name
      into pk_name
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.table_name = 'products'
      and tc.constraint_type = 'PRIMARY KEY';

    if pk_name is not null then
      execute format('alter table public.products drop constraint %I', pk_name);
    end if;

    -- Remove old id and promote id_new to id
    alter table public.products drop column id;
    alter table public.products rename column id_new to id;
    alter table public.products add primary key (id);

    -- Keep sequence in sync for future inserts (if app ever omits id)
    perform setval('public.products_id_seq', greatest(coalesce((select max(id) from public.products), 0), 1));
    alter table public.products alter column id set default nextval('public.products_id_seq');

  elsif id_data_type = 'bigint' then
    -- Keep bigint schema and ensure optional sequence/default exists
    create sequence if not exists public.products_id_seq;
    perform setval('public.products_id_seq', greatest(coalesce((select max(id) from public.products), 0), 1));
    alter table public.products alter column id set default nextval('public.products_id_seq');
  end if;
end $$;

-- ===== 2) Add columns expected by admin/frontend =====
alter table public.products add column if not exists description text;
alter table public.products add column if not exists "group" text;
alter table public.products add column if not exists subgroup text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists garantia_raw text;
alter table public.products add column if not exists garantia text;
alter table public.products add column if not exists variants jsonb;
alter table public.products add column if not exists variant text;
alter table public.products add column if not exists price numeric(12,2);
alter table public.products add column if not exists images jsonb;
alter table public.products add column if not exists image text;
alter table public.products add column if not exists image_illustrative boolean default false;
alter table public.products add column if not exists video text;
alter table public.products add column if not exists internal text;
alter table public.products add column if not exists created_at timestamptz default now();
alter table public.products add column if not exists updated_at timestamptz default now();
alter table public.products add column if not exists owner_id uuid;

-- Keep name required by app
alter table public.products alter column name set not null;

-- ===== 3) Indexes =====
create index if not exists products_group_idx on public.products ("group");
create index if not exists products_name_idx
  on public.products using gin (to_tsvector('simple', coalesce(name, '')));

-- ===== 4) updated_at trigger =====
create or replace function public.set_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_products_updated_at();

-- ===== 5) RLS and policies =====
alter table public.products enable row level security;

-- Public read
drop policy if exists "Public read" on public.products;
create policy "Public read"
on public.products
for select
using (true);

-- Admin write only (recommended)
-- IMPORTANT: update the email list below to your real admin users.
drop policy if exists "Authenticated write" on public.products;
drop policy if exists "Admin write" on public.products;
create policy "Admin write"
on public.products
for all
using (
  auth.role() = 'authenticated'
  and lower(coalesce(auth.jwt() ->> 'email', '')) in ('hicarodev@outlook.com')
)
with check (
  auth.role() = 'authenticated'
  and lower(coalesce(auth.jwt() ->> 'email', '')) in ('hicarodev@outlook.com')
);

-- Optional: if you need temporary open writes from browser without auth, uncomment below.
-- WARNING: insecure for production.
-- create policy if not exists "Public write (temporary)"
-- on public.products
-- for all
-- using (true)
-- with check (true);

-- ===== 6) Realtime publication =====
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
exception
  when undefined_object then
    create publication supabase_realtime for table public.products;
end $$;

commit;
