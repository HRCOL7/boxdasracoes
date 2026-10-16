-- =====================================================================
-- Box das Rações — endurecimento de segurança (RLS + total do pedido)
-- Aplicar UMA vez no Supabase: SQL Editor > New query > colar > Run.
-- É idempotente: pode rodar de novo sem quebrar.
--
-- O que corrige:
--  1. Fonte única de admins (tabela admin_users + função is_admin()),
--     exigindo e-mail CONFIRMADO. Antes, a lista de e-mails estava
--     repetida em vários arquivos e não exigia confirmação.
--  2. products: remove qualquer política antiga que deixava QUALQUER
--     usuário logado alterar produtos ("Authenticated write").
--  3. erp_price_alerts: antes qualquer cliente logado lia/alterava.
--  4. customer_erp_queue: só o próprio usuário insere o próprio cadastro.
--  5. customer_orders: o SERVIDOR recalcula preço e total a partir da
--     tabela products. O valor enviado pelo navegador deixa de valer.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Admins: fonte única
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Mantém os mesmos administradores que já existiam nos outros scripts.
insert into public.admin_users (email) values
  ('hicarodev@outlook.com'),
  ('boxdasracoes@hotmail.com'),
  ('derlaajuse@gmail.com')
on conflict (email) do nothing;

drop policy if exists "admin_users_select_none" on public.admin_users;
create policy "admin_users_select_none"
on public.admin_users for select to authenticated using (false);

-- SECURITY DEFINER: lê admin_users e auth.users mesmo com RLS fechado.
-- search_path vazio evita ataque por schema falso.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users a
    join auth.users u on lower(u.email) = lower(a.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) products: só admin escreve; todos leem
-- ---------------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "Authenticated write" on public.products;
drop policy if exists "Public write (temporary)" on public.products;
drop policy if exists "Admin write" on public.products;
drop policy if exists "Public read" on public.products;

create policy "Public read"
on public.products for select
using (true);

create policy "Admin write"
on public.products for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 3) erp_price_alerts: apenas admin (e service_role, que ignora RLS)
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.erp_price_alerts') is not null then
    drop policy if exists "erp_price_alerts_select_authenticated" on public.erp_price_alerts;
    drop policy if exists "erp_price_alerts_update_authenticated" on public.erp_price_alerts;
    drop policy if exists "erp_price_alerts_select_admin" on public.erp_price_alerts;
    drop policy if exists "erp_price_alerts_update_admin" on public.erp_price_alerts;

    create policy "erp_price_alerts_select_admin"
    on public.erp_price_alerts for select to authenticated
    using (public.is_admin());

    create policy "erp_price_alerts_update_admin"
    on public.erp_price_alerts for update to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4) customer_erp_queue: cada usuário só enfileira o PRÓPRIO cadastro
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.customer_erp_queue') is not null then
    drop policy if exists "customer_queue_insert_authenticated" on public.customer_erp_queue;
    create policy "customer_queue_insert_authenticated"
    on public.customer_erp_queue for insert to authenticated
    with check (
      customer_id = auth.uid()
      and status = 'pending'
      and source = 'site_signup'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5) customer_orders: preço e total calculados no servidor
-- ---------------------------------------------------------------------

-- Conversões seguras: texto inválido vira NULL em vez de derrubar o pedido.
create or replace function public.safe_numeric(v text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(btrim(v), '')::numeric;
exception when others then
  return null;
end;
$$;

-- Mesma regra do site (normalizeWeightKey em cart.js): "10,1 KG" == "10.1kg"
create or replace function public.normalize_weight_key(w text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(regexp_replace(lower(coalesce(w, '')), '\s+', '', 'g'), ',', '.');
$$;

-- Mesma regra de preço do site (getEffectiveUnitPrice em cart.js):
--   base = preço da variante (ou do produto)
--   se is_promo: promo_price do produto (>0) tem prioridade;
--                senão promo_variants[peso]; senão base.
create or replace function public.product_unit_price(p public.products, v_index int)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  base numeric;
  weight text;
  pv record;
begin
  if jsonb_typeof(p.variants) = 'array'
     and v_index >= 0
     and jsonb_array_length(p.variants) > v_index then
    base := coalesce(public.safe_numeric(p.variants -> v_index ->> 'price'), 0);
    weight := p.variants -> v_index ->> 'weight';
  else
    base := coalesce(p.price, 0);
    weight := null;
  end if;

  if not coalesce(p.is_promo, false) then
    return base;
  end if;

  if p.promo_price is not null and p.promo_price > 0 then
    return p.promo_price;
  end if;

  if weight is not null and jsonb_typeof(p.promo_variants) = 'object' then
    for pv in select key, value from jsonb_each_text(p.promo_variants) loop
      if public.normalize_weight_key(pv.key) = public.normalize_weight_key(weight)
         and coalesce(public.safe_numeric(pv.value), 0) > 0 then
        return public.safe_numeric(pv.value);
      end if;
    end loop;
  end if;

  return base;
end;
$$;

-- Trigger BEFORE INSERT: substitui preços e total pelos valores do banco.
-- Roda como o próprio usuário (SECURITY INVOKER); products tem leitura pública.
create or replace function public.customer_orders_enforce_server_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  new_items jsonb := '[]'::jsonb;
  prod public.products%rowtype;
  pid bigint;
  qty int;
  vidx int;
  unit numeric;
  server_total numeric := 0;
  client_total numeric := new.total;
  v jsonb;
begin
  -- Sem usuário logado (service_role / SQL Editor): importação administrativa.
  if uid is null then
    return new;
  end if;

  if jsonb_typeof(new.items) <> 'array'
     or jsonb_array_length(new.items) = 0
     or jsonb_array_length(new.items) > 100 then
    raise exception 'Pedido inválido: lista de itens ausente ou grande demais'
      using errcode = '22023';
  end if;

  for item in select * from jsonb_array_elements(new.items) loop
    pid  := public.safe_numeric(item ->> 'productId')::bigint;
    qty  := public.safe_numeric(item ->> 'qty')::int;
    vidx := coalesce(public.safe_numeric(item ->> 'variantIndex')::int, 0);

    if pid is null or qty is null or qty < 1 or qty > 99 then
      raise exception 'Pedido inválido: item com produto ou quantidade incorretos'
        using errcode = '22023';
    end if;

    select * into prod from public.products where id = pid;
    if not found then
      raise exception 'Produto % não encontrado', pid using errcode = '22023';
    end if;
    if coalesce(prod.is_unavailable, false) then
      raise exception 'Produto "%" indisponível', prod.name using errcode = '22023';
    end if;

    if jsonb_typeof(prod.variants) = 'array' and jsonb_array_length(prod.variants) > vidx and vidx >= 0 then
      v := prod.variants -> vidx;
      if lower(coalesce(v ->> 'is_unavailable', 'false')) in ('true', 't', '1') then
        raise exception 'Variante de "%" indisponível', prod.name using errcode = '22023';
      end if;
    end if;

    unit := public.product_unit_price(prod, vidx);
    if unit is null or unit <= 0 then
      raise exception 'Produto "%" sem preço válido', prod.name using errcode = '22023';
    end if;

    server_total := server_total + (unit * qty);
    new_items := new_items || jsonb_build_array(
      item || jsonb_build_object('price', unit, 'qty', qty, 'price_verified', true)
    );
  end loop;

  new.items := new_items;
  new.total := round(server_total, 2);

  -- Campos de identidade e estado nunca vêm do navegador.
  new.customer_id := uid;
  new.customer_email := coalesce(auth.jwt() ->> 'email', new.customer_email);
  new.status := 'pending';
  if new.source not in ('site_checkout', 'site_checkout_pending_payment') then
    new.source := 'site_checkout';
  end if;

  -- Registra tentativa de adulteração para o operador ver no ERP.
  if client_total is not null and abs(client_total - new.total) > 0.01 then
    new.note := coalesce(new.note, '')
      || E'\n[AVISO] Total recalculado no servidor: R$ ' || to_char(new.total, 'FM999990.00')
      || ' (navegador enviou R$ ' || to_char(client_total, 'FM999990.00') || ')';
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.customer_orders') is not null then
    drop trigger if exists trg_customer_orders_server_totals on public.customer_orders;
    create trigger trg_customer_orders_server_totals
    before insert on public.customer_orders
    for each row execute function public.customer_orders_enforce_server_totals();

    drop policy if exists "customer_orders_insert_authenticated" on public.customer_orders;
    create policy "customer_orders_insert_authenticated"
    on public.customer_orders for insert to authenticated
    with check (customer_id = auth.uid());
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------
-- CONFERÊNCIA (rode depois, separado): deve listar só as políticas novas
--   select tablename, policyname, cmd, roles
--   from pg_policies
--   where tablename in ('products','customer_orders','customer_erp_queue','erp_price_alerts')
--   order by 1, 2;
--
-- IMPORTANTE no painel do Supabase:
--   Authentication > Providers > Email > "Confirm email" = LIGADO.
--   (is_admin() já exige e-mail confirmado, mas ligar evita contas falsas.)
-- ---------------------------------------------------------------------
