-- Add promo and availability fields to products table
-- Run in Supabase SQL Editor.

alter table if exists public.products
  add column if not exists is_promo boolean not null default false,
  add column if not exists promo_price numeric(12,2),
  add column if not exists is_unavailable boolean not null default false;

create index if not exists idx_products_is_promo on public.products(is_promo);
create index if not exists idx_products_is_unavailable on public.products(is_unavailable);
