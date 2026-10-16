-- =====================================================================
-- Box das Rações — limites para a tabela site_events (estatísticas do site)
-- Aplicar DEPOIS de 20261013000000_security_hardening.sql. Idempotente.
--
-- Problema: qualquer visitante (anônimo) pode inserir em site_events, sem limite de
-- tamanho nem de quantidade: dá para encher o banco com lixo e gerar custo.
-- O que esta migração faz:
--  1. CHECKs de tamanho/formato nas colunas (NOT VALID: só valem para linhas novas,
--     então dados antigos nunca impedem a aplicação).
--  2. Política de insert: actor_user_id só pode ser nulo ou o próprio usuário.
--  3. Trigger de limite de frequência: máx. 60 eventos/min por session_id e
--     3000 eventos/min no total (visitantes anon/authenticated; service_role fica livre).
--     O limite total protege o banco; em um ataque, estatísticas legítimas daquele minuto se perdem
--     (o site já ignora falhas ao registrar evento: js/analytics.js).
--  4. is_current_user_admin() (usada nos relatórios) passa a delegar para is_admin(),
--     que exige e-mail confirmado e não depende de lista duplicada.
-- =====================================================================

begin;

-- 1) Limites de formato e tamanho -------------------------------------
alter table public.site_events drop constraint if exists site_events_event_type_chk;
alter table public.site_events add constraint site_events_event_type_chk
  check (event_type ~ '^[a-z0-9_:.-]{1,40}$') not valid;

alter table public.site_events drop constraint if exists site_events_page_path_chk;
alter table public.site_events add constraint site_events_page_path_chk
  check (page_path is null or char_length(page_path) <= 300) not valid;

alter table public.site_events drop constraint if exists site_events_session_id_chk;
alter table public.site_events add constraint site_events_session_id_chk
  check (session_id is null or char_length(session_id) between 1 and 80) not valid;

alter table public.site_events drop constraint if exists site_events_payment_chk;
alter table public.site_events add constraint site_events_payment_chk
  check (payment is null or char_length(payment) <= 40) not valid;

alter table public.site_events drop constraint if exists site_events_numbers_chk;
alter table public.site_events add constraint site_events_numbers_chk
  check ((product_id is null or product_id > 0)
     and (order_number is null or order_number > 0)
     and (total is null or (total >= 0 and total < 10000000))) not valid;

alter table public.site_events drop constraint if exists site_events_meta_chk;
alter table public.site_events add constraint site_events_meta_chk
  check (meta is null or (jsonb_typeof(meta) = 'object' and octet_length(meta::text) <= 2000)) not valid;

-- 2) Política de insert mais estrita ------------------------------------
drop policy if exists "site_events_insert_anon_auth" on public.site_events;
create policy "site_events_insert_anon_auth"
on public.site_events
for insert
to anon, authenticated
with check (actor_user_id is null or actor_user_id = auth.uid());

-- 3) Limite de frequência ----------------------------------------------
-- SECURITY DEFINER: precisa CONTAR as linhas existentes, e visitantes não têm permissão de leitura (RLS).
-- Quem está chamando é identificado pelo "role" da conexão (anon/authenticated), que o
-- SECURITY DEFINER não altera.
create or replace function public.site_events_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_session int;
  n_total int;
begin
  -- service_role / SQL Editor (importações, manutenção) não são limitados.
  if coalesce(current_setting('role', true), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.session_id is not null then
    select count(*) into n_session from (
      select 1 from public.site_events
      where session_id = new.session_id and created_at > now() - interval '1 minute'
      limit 61
    ) s;
    if n_session >= 60 then
      raise exception 'Muitos eventos nesta sessão' using errcode = '54000';
    end if;
  end if;

  select count(*) into n_total from (
    select 1 from public.site_events
    where created_at > now() - interval '1 minute'
    limit 3001
  ) t;
  if n_total >= 3000 then
    raise exception 'Muitos eventos no momento' using errcode = '54000';
  end if;

  return new;
end;
$$;

revoke all on function public.site_events_rate_limit() from public;

drop trigger if exists trg_site_events_rate_limit on public.site_events;
create trigger trg_site_events_rate_limit
before insert on public.site_events
for each row execute function public.site_events_rate_limit();

-- 4) Relatórios: uma única definição de "admin" --------------------------
-- (create or replace mantém as funções de relatório que já usam is_current_user_admin)
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin();
$$;

commit;
