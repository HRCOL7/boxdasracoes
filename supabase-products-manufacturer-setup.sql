-- Add manufacturer field to products table
-- Run in Supabase SQL Editor.

alter table if exists public.products
  add column if not exists manufacturer text;
