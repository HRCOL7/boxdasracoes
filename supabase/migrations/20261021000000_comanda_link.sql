-- Comanda por link: cada pedido ganha um código secreto (public_token) e a página
-- comanda.html consegue mostrar o pedido para quem tem o link, SEM abrir a tabela inteira.
--
-- O que muda:
--  1. Coluna public_token (uuid aleatório, único) em customer_orders.
--  2. Função get_order_comanda(token): devolve só os dados da comanda daquele pedido.
--     O código tem 122 bits aleatórios: não dá para adivinhar nem listar outros pedidos.
-- Pode rodar mais de uma vez sem problema.

begin;

do $$
begin
  if to_regclass('public.customer_orders') is null then
    raise notice 'customer_orders não existe: rode supabase-orders-setup.sql primeiro.';
    return;
  end if;

  alter table public.customer_orders
    add column if not exists public_token uuid not null default gen_random_uuid();

  create unique index if not exists customer_orders_public_token_uidx
    on public.customer_orders(public_token);
end $$;

create or replace function public.get_order_comanda(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'created_at',   o.created_at,
    'status',       o.status,
    'payment',      o.payment,
    'total',        o.total,
    'note',         o.note,
    'customer_name',  o.customer_name,
    'customer_phone', o.customer_phone,
    'items',        o.items
  )
  from public.customer_orders o
  where o.public_token = p_token
  limit 1;
$$;

revoke all on function public.get_order_comanda(uuid) from public;
grant execute on function public.get_order_comanda(uuid) to anon, authenticated;

commit;
