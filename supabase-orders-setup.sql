-- Pré-vendas do site para uso operacional no ERP Support
-- Numeração sequencial sincronizável com o ERP (ex.: 129951)

begin;

create sequence if not exists public.customer_order_number_seq
  as bigint
  start with 129951
  increment by 1
  minvalue 1;

create table if not exists public.customer_orders (
  id bigint generated always as identity primary key,
  order_number bigint not null default nextval('public.customer_order_number_seq') unique,
  customer_id uuid references auth.users(id) on delete set null,
  customer_email text,
  customer_name text,
  customer_phone text,
  items jsonb not null,
  payment text,
  total numeric(12,2) not null default 0,
  note text,
  status text not null default 'pending',
  source text not null default 'site_checkout',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  -- Se tabela já existia com coluna gerada, converte para default com sequence
  begin
    execute 'alter table public.customer_orders alter column order_number drop expression';
  exception
    when others then
      null;
  end;

  begin
    execute 'alter table public.customer_orders alter column order_number set default nextval(''public.customer_order_number_seq'')';
  exception
    when others then
      null;
  end;
end $$;

create index if not exists customer_orders_created_idx on public.customer_orders(created_at desc);
create index if not exists customer_orders_status_idx on public.customer_orders(status, created_at);
create index if not exists customer_orders_customer_idx on public.customer_orders(customer_id, created_at desc);
create unique index if not exists customer_orders_order_number_uidx on public.customer_orders(order_number);

-- Ajusta sequence para no mínimo o maior número já existente
select setval(
  'public.customer_order_number_seq',
  greatest(coalesce((select max(order_number) from public.customer_orders), 129950), 129950),
  true
);

create or replace function public.set_customer_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_customer_orders_updated_at on public.customer_orders;
create trigger trg_customer_orders_updated_at
before update on public.customer_orders
for each row execute function public.set_customer_orders_updated_at();

alter table public.customer_orders enable row level security;

drop policy if exists "customer_orders_insert_authenticated" on public.customer_orders;
create policy "customer_orders_insert_authenticated"
on public.customer_orders
for insert
to authenticated
with check (true);

drop policy if exists "customer_orders_select_own" on public.customer_orders;
create policy "customer_orders_select_own"
on public.customer_orders
for select
to authenticated
using (auth.uid() = customer_id);

create or replace function public.ensure_customer_order_number_min(min_value bigint)
returns bigint
language plpgsql
security definer
as $$
declare
  current_last bigint;
begin
  if min_value is null then
    return null;
  end if;

  select last_value into current_last from public.customer_order_number_seq;

  if current_last < min_value then
    perform setval('public.customer_order_number_seq', min_value, true);
    return min_value;
  end if;

  return current_last;
end;
$$;

grant execute on function public.ensure_customer_order_number_min(bigint) to service_role;

commit;
