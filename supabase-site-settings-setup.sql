-- Site settings shared across devices (banners, brands, categories)
-- Run this once in Supabase SQL Editor.

create table if not exists public.site_settings (
  id integer primary key default 1,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint site_settings_single_row check (id = 1)
);

alter table public.site_settings enable row level security;

-- Public site can read settings (needed for storefront visitors)
drop policy if exists "site_settings_select_public" on public.site_settings;
create policy "site_settings_select_public"
  on public.site_settings for select
  using (true);

-- Only authenticated users can write settings (admin panel should sign in)
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

-- Seed single row if it does not exist yet
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
