-- Painel de pedidos do admin (admin/orders.html).
-- Aplicar DEPOIS de 20261013000000_security_hardening.sql (usa public.is_admin()).
--
-- O que muda:
--  1. Admin passa a LER todos os pedidos (customer_orders) — antes só o dono do pedido lia.
--  2. Admin pode ATUALIZAR pedidos, mas um gatilho só deixa mudar `status` e `note`:
--     itens, total, pagamento e dados do cliente continuam protegidos contra edição.
--  3. Só aceita os status que o painel usa.
-- Cliente comum continua vendo apenas os próprios pedidos e sem poder atualizar nada.

begin;

do $$
begin
  if to_regclass('public.customer_orders') is null then
    raise notice 'customer_orders não existe: rode supabase-orders-setup.sql primeiro.';
    return;
  end if;

  drop policy if exists "customer_orders_select_admin" on public.customer_orders;
  create policy "customer_orders_select_admin"
  on public.customer_orders for select to authenticated
  using (public.is_admin());

  drop policy if exists "customer_orders_update_admin" on public.customer_orders;
  create policy "customer_orders_update_admin"
  on public.customer_orders for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
end $$;

create or replace function public.customer_orders_admin_update_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- service_role (conectores/servidor) não passa por aqui: só vale para o painel.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.order_number is distinct from old.order_number
     or new.customer_id is distinct from old.customer_id
     or new.customer_email is distinct from old.customer_email
     or new.customer_name is distinct from old.customer_name
     or new.customer_phone is distinct from old.customer_phone
     or new.items is distinct from old.items
     or new.payment is distinct from old.payment
     or new.total is distinct from old.total
     or new.source is distinct from old.source
     or new.created_at is distinct from old.created_at then
    raise exception 'Só status e observação do pedido podem ser alterados.' using errcode = '42501';
  end if;

  if new.status not in ('pending', 'preparing', 'delivering', 'delivered', 'cancelled', 'processed', 'error') then
    raise exception 'Status de pedido inválido: %', new.status using errcode = '22023';
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.customer_orders') is not null then
    drop trigger if exists trg_customer_orders_admin_guard on public.customer_orders;
    create trigger trg_customer_orders_admin_guard
    before update on public.customer_orders
    for each row execute function public.customer_orders_admin_update_guard();
  end if;
end $$;

commit;
