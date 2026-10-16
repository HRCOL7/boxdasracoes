-- Teste de segurança da migração 20261013000000_security_hardening.sql
-- Rodar em um banco de TESTE local (não em produção): cria usuários e produtos falsos.
-- Requer que existam os roles anon/authenticated e as funções auth.uid()/auth.jwt()
-- (no Supabase real elas já existem).
\set ON_ERROR_STOP 0
\set QUIET on

delete from public.customer_orders;
delete from public.customer_erp_queue;
delete from public.erp_price_alerts where product_key = 'k';
delete from public.products where id in (9001, 9002, 9003);
delete from auth.users where email like '%@teste.local' or id::text like '00000000-0000-0000-0000-0000000000%';

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'cliente1@teste.local', now()),
  ('00000000-0000-0000-0000-0000000000c2', 'cliente2@teste.local', now()),
  ('00000000-0000-0000-0000-0000000000a1', 'derlaajuse@gmail.com',  now()),
  ('00000000-0000-0000-0000-0000000000f1', 'boxdasracoes@hotmail.com', null); -- admin NÃO confirmado

insert into public.products (id, name, price, variants, is_promo, promo_price, promo_variants, is_unavailable) values
  (9001, 'Racao teste', 0,
   '[{"weight":"15kg","price":200},{"weight":"1 kg","price":20},{"weight":"3kg","price":50,"is_unavailable":true}]',
   false, null, '{}', false),
  (9002, 'Promo teste', 15, null, true, 9.90, '{}', false),
  (9003, 'Indisponivel', 10, null, false, null, '{}', true);

insert into public.erp_price_alerts (product_key, product_name, site_price, erp_price, diff_amount)
values ('k', 'n', 2, 1, 1);

create temp table results(name text, ok boolean);

-- Executa um comando como um usuário (ou anônimo) e devolve 'OK:<linhas>' ou 'ERR:<mensagem>'.
create function pg_temp.run_as(uid text, mail text, cmd text) returns text language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims',
    case when uid is null then '{"role":"anon"}'
         else json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text end, false);
  execute case when uid is null then 'set role anon' else 'set role authenticated' end;
  execute cmd;
  get diagnostics n = row_count;
  execute 'reset role';
  return 'OK:' || n;
exception when others then
  execute 'reset role';
  return 'ERR:' || sqlerrm;
end $$;

-- Executa uma consulta que devolve 1 valor como um usuário.
create function pg_temp.val_as(uid text, mail text, q text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
    case when uid is null then '{"role":"anon"}'
         else json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text end, false);
  execute case when uid is null then 'set role anon' else 'set role authenticated' end;
  execute q into v;
  execute 'reset role';
  return v;
exception when others then
  execute 'reset role';
  return 'ERR:' || sqlerrm;
end $$;

create function pg_temp.t(n text, ok boolean) returns void language sql as
$$ insert into results values (n, coalesce(ok, false)) $$;

\set C1 '''00000000-0000-0000-0000-0000000000c1'''
\set C2 '''00000000-0000-0000-0000-0000000000c2'''
\set A1 '''00000000-0000-0000-0000-0000000000a1'''
\set F1 '''00000000-0000-0000-0000-0000000000f1'''

-- 1) Cliente tenta pagar R$ 0,01 por 2 x 15kg (preço real 200), se passando por outro
select pg_temp.run_as(:C1, 'cliente1@teste.local', $$
  insert into public.customer_orders (customer_id, items, total, payment, status, source)
  values ('00000000-0000-0000-0000-0000000000c2',
          '[{"productId":9001,"variantIndex":0,"qty":2,"price":0.01}]', 0.01, 'PIX', 'paid', 'hack')$$) as r \gset
select pg_temp.t('pedido com preço adulterado é ACEITO mas corrigido (' || :'r' || ')', :'r' = 'OK:1');
select pg_temp.t('total recalculado no servidor (2 x 200 = 400.00)', (select total = 400.00 from public.customer_orders order by id desc limit 1));
select pg_temp.t('preço do item substituído pelo do banco', (select (items->0->>'price')::numeric = 200 from public.customer_orders order by id desc limit 1));
select pg_temp.t('customer_id forçado para o usuário logado (não o enviado)', (select customer_id = '00000000-0000-0000-0000-0000000000c1' from public.customer_orders order by id desc limit 1));
select pg_temp.t('status e source não vêm do navegador', (select status = 'pending' and source = 'site_checkout' from public.customer_orders order by id desc limit 1));
select pg_temp.t('nota registra a tentativa de adulteração', (select note like '%AVISO%' from public.customer_orders order by id desc limit 1));

-- 2) Pedido honesto: variante "1 kg" (20) x3 + promo (9.90) x1 = 69.90, sem aviso
select pg_temp.run_as(:C1, 'cliente1@teste.local', $$
  insert into public.customer_orders (customer_id, items, total, payment)
  values ('00000000-0000-0000-0000-0000000000c1',
          '[{"productId":9001,"variantIndex":1,"qty":3,"price":20},{"productId":9002,"variantIndex":0,"qty":1,"price":9.9}]', 69.90, 'PIX')$$) as r \gset
select pg_temp.t('pedido honesto: aceito, total 69.90 e sem aviso (' || :'r' || ')',
  :'r' = 'OK:1' and (select total = 69.90 and coalesce(note,'') not like '%AVISO%' from public.customer_orders order by id desc limit 1));

-- 3) Entradas inválidas são recusadas
select pg_temp.t('recusa produto indisponível',   left(pg_temp.run_as(:C1,'cliente1@teste.local', $$insert into public.customer_orders(customer_id,items,total) values ('00000000-0000-0000-0000-0000000000c1','[{"productId":9003,"qty":1}]',1)$$),3) = 'ERR');
select pg_temp.t('recusa variante indisponível',  left(pg_temp.run_as(:C1,'cliente1@teste.local', $$insert into public.customer_orders(customer_id,items,total) values ('00000000-0000-0000-0000-0000000000c1','[{"productId":9001,"variantIndex":2,"qty":1}]',1)$$),3) = 'ERR');
select pg_temp.t('recusa produto inexistente',    left(pg_temp.run_as(:C1,'cliente1@teste.local', $$insert into public.customer_orders(customer_id,items,total) values ('00000000-0000-0000-0000-0000000000c1','[{"productId":424242,"qty":1}]',1)$$),3) = 'ERR');
select pg_temp.t('recusa quantidade 0',           left(pg_temp.run_as(:C1,'cliente1@teste.local', $$insert into public.customer_orders(customer_id,items,total) values ('00000000-0000-0000-0000-0000000000c1','[{"productId":9001,"qty":0}]',1)$$),3) = 'ERR');
select pg_temp.t('recusa quantidade 1000',        left(pg_temp.run_as(:C1,'cliente1@teste.local', $$insert into public.customer_orders(customer_id,items,total) values ('00000000-0000-0000-0000-0000000000c1','[{"productId":9001,"qty":1000}]',1)$$),3) = 'ERR');
select pg_temp.t('recusa lista de itens vazia',   left(pg_temp.run_as(:C1,'cliente1@teste.local', $$insert into public.customer_orders(customer_id,items,total) values ('00000000-0000-0000-0000-0000000000c1','[]',1)$$),3) = 'ERR');
select pg_temp.t('recusa itens que não são lista', left(pg_temp.run_as(:C1,'cliente1@teste.local', $$insert into public.customer_orders(customer_id,items,total) values ('00000000-0000-0000-0000-0000000000c1','{"a":1}',1)$$),3) = 'ERR');
select pg_temp.t('visitante anônimo NÃO cria pedido', left(pg_temp.run_as(null, null, $$insert into public.customer_orders(items,total) values ('[{"productId":9001,"qty":1}]',1)$$),3) = 'ERR');

-- 4) products: cliente comum não escreve; admin confirmado escreve; falso admin não
select pg_temp.t('cliente comum NÃO altera produtos',
  pg_temp.run_as(:C1,'cliente1@teste.local', $$update public.products set price = 1 where id = 9002$$) in ('OK:0') or left(pg_temp.run_as(:C1,'cliente1@teste.local', $$update public.products set price = 1 where id = 9002$$),3)='ERR');
select pg_temp.t('cliente comum NÃO insere produtos', left(pg_temp.run_as(:C1,'cliente1@teste.local', $$insert into public.products(id,name) values (9099,'x')$$),3) = 'ERR');
select pg_temp.t('admin com e-mail confirmado altera produtos', pg_temp.run_as(:A1,'derlaajuse@gmail.com', $$update public.products set price = 16 where id = 9002$$) = 'OK:1');
select pg_temp.t('e-mail de admin NÃO confirmado não altera produtos', pg_temp.run_as(:F1,'boxdasracoes@hotmail.com', $$update public.products set price = 1 where id = 9002$$) = 'OK:0');
select pg_temp.t('preço do produto 9002 continuou 16 (só o admin mexeu)', (select price = 16 from public.products where id = 9002));
select pg_temp.t('visitante anônimo lê produtos', pg_temp.val_as(null, null, $$select count(*)::text from public.products where id = 9001$$) = '1');

-- 5) erp_price_alerts fechado para cliente
select pg_temp.t('cliente NÃO lê alertas de preço do ERP', pg_temp.val_as(:C1,'cliente1@teste.local', $$select count(*)::text from public.erp_price_alerts$$) = '0');
select pg_temp.t('cliente NÃO altera alertas de preço', pg_temp.run_as(:C1,'cliente1@teste.local', $$update public.erp_price_alerts set status = 'ignored'$$) = 'OK:0');
select pg_temp.t('admin lê alertas de preço do ERP', pg_temp.val_as(:A1,'derlaajuse@gmail.com', $$select count(*)::text from public.erp_price_alerts$$) = '1');

-- 6) fila do ERP: só o próprio cadastro
select pg_temp.t('fila: aceita o próprio cadastro', pg_temp.run_as(:C1,'cliente1@teste.local', $$insert into public.customer_erp_queue(customer_id,full_name,email,status,source) values ('00000000-0000-0000-0000-0000000000c1','X','x@teste.local','pending','site_signup')$$) = 'OK:1');
select pg_temp.t('fila: recusa cadastro em nome de outro', left(pg_temp.run_as(:C1,'cliente1@teste.local', $$insert into public.customer_erp_queue(customer_id,full_name,email,status,source) values ('00000000-0000-0000-0000-0000000000c2','X','x@teste.local','pending','site_signup')$$),3) = 'ERR');

-- 7) pedidos: cada cliente só enxerga os próprios
select pg_temp.t('cliente 1 vê os próprios pedidos (2)', pg_temp.val_as(:C1,'cliente1@teste.local', $$select count(*)::text from public.customer_orders$$) = '2');
select pg_temp.t('cliente 2 não vê pedidos do cliente 1', pg_temp.val_as(:C2,'cliente2@teste.local', $$select count(*)::text from public.customer_orders$$) = '0');

\echo ---------- RESULTADO ----------
select case when ok then 'PASS' else 'FAIL' end as status, name from results order by ok, name;
select count(*) filter (where ok) as passaram, count(*) filter (where not ok) as falharam from results;

delete from public.customer_orders;
delete from public.customer_erp_queue;
delete from public.erp_price_alerts where product_key = 'k';
delete from public.products where id in (9001, 9002, 9003);
delete from auth.users where id::text like '00000000-0000-0000-0000-0000000000%';
