-- ERP price divergence alerts
-- Run in Supabase SQL Editor.

begin;

create table if not exists public.erp_price_alerts (
  id bigint generated always as identity primary key,
  product_id bigint references public.products(id) on delete cascade,
  product_name text,
  product_key text,
  site_price numeric(12,2) not null,
  erp_price numeric(12,2) not null,
  diff_amount numeric(12,2) not null,
  occurrences integer not null default 1,
  status text not null default 'open',
  detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_price_alerts_status_check check (status in ('open','resolved_manual','resolved_auto','ignored'))
);

create index if not exists erp_price_alerts_status_idx on public.erp_price_alerts(status, last_seen_at desc);
create index if not exists erp_price_alerts_product_idx on public.erp_price_alerts(product_id, status, last_seen_at desc);

create or replace function public.set_erp_price_alerts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_erp_price_alerts_updated_at on public.erp_price_alerts;
create trigger trg_erp_price_alerts_updated_at
before update on public.erp_price_alerts
for each row execute function public.set_erp_price_alerts_updated_at();

create or replace function public.set_erp_price_alerts_resolved_by()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('resolved_manual','resolved_auto','ignored') and new.resolved_by is null then
    new.resolved_by := coalesce(auth.jwt() ->> 'email', current_setting('request.jwt.claim.email', true));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_erp_price_alerts_resolved_by on public.erp_price_alerts;
create trigger trg_erp_price_alerts_resolved_by
before update on public.erp_price_alerts
for each row execute function public.set_erp_price_alerts_resolved_by();

alter table public.erp_price_alerts enable row level security;

drop policy if exists "erp_price_alerts_insert_service_role" on public.erp_price_alerts;
create policy "erp_price_alerts_insert_service_role"
on public.erp_price_alerts
for insert
to service_role
with check (true);

drop policy if exists "erp_price_alerts_update_service_role" on public.erp_price_alerts;
create policy "erp_price_alerts_update_service_role"
on public.erp_price_alerts
for update
to service_role
using (true)
with check (true);

drop policy if exists "erp_price_alerts_select_authenticated" on public.erp_price_alerts;
create policy "erp_price_alerts_select_authenticated"
on public.erp_price_alerts
for select
to authenticated
using (true);

drop policy if exists "erp_price_alerts_update_authenticated" on public.erp_price_alerts;
create policy "erp_price_alerts_update_authenticated"
on public.erp_price_alerts
for update
to authenticated
using (true)
with check (true);

grant all on public.erp_price_alerts to service_role;
grant select, update on public.erp_price_alerts to authenticated;
grant usage, select on sequence public.erp_price_alerts_id_seq to service_role, authenticated;

commit;
