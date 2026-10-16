-- Teste da migração 20261015000000_site_events_limits.sql (banco de TESTE, não produção).
-- Requer: migração 20261013000000 aplicada, roles anon/authenticated e auth.uid()/auth.jwt().
\set ON_ERROR_STOP 0
\set QUIET on

delete from public.site_events;
delete from public.admin_users where email like '%@teste.local';
delete from auth.users where id::text like '00000000-0000-0000-0000-0000000000%';
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'cliente1@teste.local', now()),
  ('00000000-0000-0000-0000-0000000000c2', 'cliente2@teste.local', now()),
  ('00000000-0000-0000-0000-0000000000a1', 'admin@teste.local', now()),
  ('00000000-0000-0000-0000-0000000000a2', 'admin2@teste.local', null);
insert into public.admin_users (email) values ('admin@teste.local'), ('admin2@teste.local');

create temp table results(name text, ok boolean);

create function pg_temp.run_as(uid text, cmd text) returns text language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims',
    case when uid is null then '{"role":"anon"}' else json_build_object('sub', uid, 'role', 'authenticated')::text end, false);
  execute case when uid is null then 'set role anon' else 'set role authenticated' end;
  execute cmd;
  get diagnostics n = row_count;
  execute 'reset role';
  return 'OK:' || n;
exception when others then
  execute 'reset role';
  return 'ERR:' || sqlerrm;
end $$;

create function pg_temp.t(n text, ok boolean) returns void language sql as $$ insert into results values (n, coalesce(ok, false)) $$;
create function pg_temp.err(r text) returns boolean language sql as $$ select left(r, 3) = 'ERR' $$;

-- Eventos legítimos (os mesmos que o site envia)
select pg_temp.t('anônimo registra page_view normal',
  pg_temp.run_as(null, $$insert into public.site_events(event_type,page_path,session_id,meta) values ('page_view','/index.html','s_abc','{"title":"Box das Rações"}')$$) = 'OK:1');
select pg_temp.t('registra product_view com product_id',
  pg_temp.run_as(null, $$insert into public.site_events(event_type,page_path,product_id,session_id) values ('product_view','/product.html',101,'s_abc')$$) = 'OK:1');
select pg_temp.t('cliente logado registra checkout_started com total',
  pg_temp.run_as('00000000-0000-0000-0000-0000000000c1', $$insert into public.site_events(event_type,total,payment,session_id,actor_user_id) values ('checkout_started',99.90,'PIX','s_c1','00000000-0000-0000-0000-0000000000c1')$$) = 'OK:1');

-- Limites de formato/tamanho
select pg_temp.t('recusa event_type gigante', pg_temp.err(pg_temp.run_as(null, format($$insert into public.site_events(event_type) values (%L)$$, repeat('a', 500)))));
select pg_temp.t('recusa event_type com caracteres estranhos', pg_temp.err(pg_temp.run_as(null, $$insert into public.site_events(event_type) values ('<script>')$$)));
select pg_temp.t('recusa event_type vazio', pg_temp.err(pg_temp.run_as(null, $$insert into public.site_events(event_type) values ('')$$)));
select pg_temp.t('recusa page_path com 5000 caracteres', pg_temp.err(pg_temp.run_as(null, format($$insert into public.site_events(event_type,page_path) values ('page_view',%L)$$, repeat('x', 5000)))));
select pg_temp.t('recusa session_id gigante', pg_temp.err(pg_temp.run_as(null, format($$insert into public.site_events(event_type,session_id) values ('page_view',%L)$$, repeat('s', 500)))));
select pg_temp.t('recusa meta com mais de 2000 bytes', pg_temp.err(pg_temp.run_as(null, format($$insert into public.site_events(event_type,meta) values ('page_view', jsonb_build_object('x', %L))$$, repeat('m', 3000)))));
select pg_temp.t('recusa meta que não é objeto', pg_temp.err(pg_temp.run_as(null, $$insert into public.site_events(event_type,meta) values ('page_view','[1,2]')$$)));
select pg_temp.t('recusa total negativo', pg_temp.err(pg_temp.run_as(null, $$insert into public.site_events(event_type,total) values ('page_view',-5)$$)));
select pg_temp.t('recusa product_id <= 0', pg_temp.err(pg_temp.run_as(null, $$insert into public.site_events(event_type,product_id) values ('product_view',0)$$)));

-- Identidade
select pg_temp.t('cliente NÃO registra evento em nome de outro usuário',
  pg_temp.err(pg_temp.run_as('00000000-0000-0000-0000-0000000000c1', $$insert into public.site_events(event_type,actor_user_id) values ('page_view','00000000-0000-0000-0000-0000000000c2')$$)));
select pg_temp.t('anônimo NÃO usa actor_user_id',
  pg_temp.err(pg_temp.run_as(null, $$insert into public.site_events(event_type,actor_user_id) values ('page_view','00000000-0000-0000-0000-0000000000c2')$$)));

-- Leitura/edição continuam fechadas para visitantes
select pg_temp.t('anônimo NÃO lê eventos (0 linhas visíveis)', pg_temp.run_as(null, $$select 1 from public.site_events$$) = 'OK:0');
select pg_temp.t('anônimo NÃO apaga eventos (0 linhas)', pg_temp.run_as(null, $$delete from public.site_events$$) = 'OK:0');
select pg_temp.t('anônimo NÃO altera eventos (0 linhas)', pg_temp.run_as(null, $$update public.site_events set event_type = 'x'$$) = 'OK:0');

-- Limite por sessão: 60/min
insert into public.site_events(event_type, session_id) select 'page_view', 's_flood' from generate_series(1, 60);   -- como superusuário: sem limite
select pg_temp.t('service_role/SQL Editor não é limitado (inseriu 60)', (select count(*) = 60 from public.site_events where session_id = 's_flood'));
select pg_temp.t('sessão com 60 eventos no último minuto: o 61º é recusado',
  pg_temp.err(pg_temp.run_as(null, $$insert into public.site_events(event_type,session_id) values ('page_view','s_flood')$$)));
select pg_temp.t('outra sessão continua podendo registrar',
  pg_temp.run_as(null, $$insert into public.site_events(event_type,session_id) values ('page_view','s_outra')$$) = 'OK:1');

-- Limite total: 3000/min
insert into public.site_events(event_type, session_id) select 'page_view', 's_massa_' || (g % 100) from generate_series(1, 3000) g;
select pg_temp.t('com 3000+ eventos no minuto, até uma sessão nova é recusada',
  pg_temp.err(pg_temp.run_as(null, $$insert into public.site_events(event_type,session_id) values ('page_view','s_nova')$$)));
update public.site_events set created_at = now() - interval '5 minutes';
select pg_temp.t('passado o minuto, volta a aceitar',
  pg_temp.run_as(null, $$insert into public.site_events(event_type,session_id) values ('page_view','s_nova')$$) = 'OK:1');

-- is_current_user_admin() agora é a mesma regra de is_admin()
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"admin@teste.local","role":"authenticated"}', false);
set role authenticated;
select pg_temp.t('admin confirmado: is_current_user_admin() = true', public.is_current_user_admin());
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","email":"admin2@teste.local","role":"authenticated"}', false);
set role authenticated;
select pg_temp.t('admin com e-mail NÃO confirmado: is_current_user_admin() = false', not public.is_current_user_admin());
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","email":"cliente1@teste.local","role":"authenticated"}', false);
set role authenticated;
select pg_temp.t('cliente comum: is_current_user_admin() = false', not public.is_current_user_admin());
reset role;

\echo ---------- RESULTADO ----------
select case when ok then 'PASS' else 'FAIL' end as status, name from results order by ok, name;
select count(*) filter (where ok) as passaram, count(*) filter (where not ok) as falharam from results;

delete from public.site_events;
delete from public.admin_users where email like '%@teste.local';
delete from auth.users where id::text like '00000000-0000-0000-0000-0000000000%';
