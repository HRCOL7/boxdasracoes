-- Unified setup: shared site settings + analytics/reports
-- Run this once in Supabase SQL Editor.

-- =========================================================
-- 1) Shared site settings (banners, brands, categories)
-- =========================================================
create table if not exists public.site_settings (
  id integer primary key default 1,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint site_settings_single_row check (id = 1)
);

alter table public.site_settings enable row level security;

drop policy if exists "site_settings_select_public" on public.site_settings;
create policy "site_settings_select_public"
  on public.site_settings for select
  using (true);

drop policy if exists "site_settings_insert_authenticated" on public.site_settings;
create policy "site_settings_insert_authenticated"
  on public.site_settings for insert
  to authenticated
  with check (true);

drop policy if exists "site_settings_update_authenticated" on public.site_settings;
create policy "site_settings_update_authenticated"
  on public.site_settings for update
  to authenticated
  using (true)
  with check (true);

insert into public.site_settings (id, payload)
values (
  1,
  jsonb_build_object(
    'banners', jsonb_build_array('img/banner1.jpg','img/banner2.jpg','img/banner3.jpg'),
    'brands', jsonb_build_array(
      jsonb_build_object('name','MarcaA','image',''),
      jsonb_build_object('name','MarcaB','image',''),
      jsonb_build_object('name','MarcaC','image','')
    ),
    'categories', jsonb_build_array(
      jsonb_build_object('title','CÃES','subs', jsonb_build_array('Ração Seca','Ração Úmida','Brinquedos','Acessórios','Higiene & Limpeza')),
      jsonb_build_object('title','GATOS','subs', jsonb_build_array('Ração Seca','Ração Úmida','Brinquedos','Acessórios','Higiene & Limpeza')),
      jsonb_build_object('title','OUTROS','subs', jsonb_build_array('Peixes','Aves','Roedores')),
      jsonb_build_object('title','MEDICAMENTOS','subs', jsonb_build_array('Antibióticos','Antifúngicos','Anti-inflamatórios','Analgésicos','Suplementos e Vitaminas','Dermatológicos','Antiparasitários')),
      jsonb_build_object('title','PROMOÇÕES','subs', jsonb_build_array())
    ),
    'whatsappIncludeCustomerData', true
  )
)
on conflict (id) do nothing;

-- =========================================================
-- 2) Reports / analytics backend
-- =========================================================
create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.admin_users(email)
values
  ('hicarodev@outlook.com'),
  ('boxdasracoes@hotmail.com'),
  ('derlaajuse@gmail.com')
on conflict (email) do nothing;

create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  page_path text,
  product_id bigint,
  order_number bigint,
  total numeric(12,2),
  payment text,
  session_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists site_events_created_idx on public.site_events(created_at desc);
create index if not exists site_events_type_created_idx on public.site_events(event_type, created_at desc);
create index if not exists site_events_session_idx on public.site_events(session_id, created_at desc);
create index if not exists site_events_order_idx on public.site_events(order_number);

alter table public.site_events enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "site_events_insert_anon_auth" on public.site_events;
create policy "site_events_insert_anon_auth"
on public.site_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "admin_users_select_none" on public.admin_users;
create policy "admin_users_select_none"
on public.admin_users
for select
to authenticated
using (false);

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.admin_users a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.admin_reports_timeseries(
  p_granularity text default 'day',
  p_start timestamptz default null,
  p_end timestamptz default null
)
returns table(
  bucket timestamptz,
  sessions bigint,
  page_views bigint,
  product_views bigint,
  checkout_started bigint,
  whatsapp_opened bigint,
  stock_whatsapp_opened bigint,
  preorders bigint,
  preorder_total numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_granularity text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_current_user_admin() then
    raise exception 'Acesso negado ao relatorio';
  end if;

  v_granularity := case when p_granularity in ('day','week','month') then p_granularity else 'day' end;
  v_end := coalesce(p_end, now());
  v_start := coalesce(p_start,
    case
      when v_granularity = 'month' then date_trunc('month', now()) - interval '12 months'
      when v_granularity = 'week' then date_trunc('week', now()) - interval '12 weeks'
      else date_trunc('day', now()) - interval '30 days'
    end
  );

  return query
  with base as (
    select *
    from public.site_events e
    where e.created_at >= v_start
      and e.created_at <= v_end
  )
  select
    date_trunc(v_granularity, b.created_at) as bucket,
    count(distinct case when b.event_type in ('page_view','product_view','checkout_started','whatsapp_opened') then b.session_id end)::bigint as sessions,
    count(*) filter (where b.event_type = 'page_view')::bigint as page_views,
    count(*) filter (where b.event_type = 'product_view')::bigint as product_views,
    count(*) filter (where b.event_type = 'checkout_started')::bigint as checkout_started,
    count(*) filter (where b.event_type = 'whatsapp_opened')::bigint as whatsapp_opened,
    count(*) filter (where b.event_type = 'stock_whatsapp_opened')::bigint as stock_whatsapp_opened,
    count(*) filter (where b.event_type = 'preorder_created')::bigint as preorders,
    coalesce(sum(case when b.event_type = 'preorder_created' then b.total else 0 end), 0)::numeric as preorder_total
  from base b
  group by 1
  order by 1 asc;
end;
$$;

grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.admin_reports_timeseries(text, timestamptz, timestamptz) to authenticated;

grant insert on public.site_events to anon, authenticated;
grant usage, select on sequence public.site_events_id_seq to anon, authenticated;

grant all on public.admin_users to service_role;
grant all on public.site_events to service_role;
