-- Supabase setup for `products` table and realtime
-- Run these in Supabase SQL Editor (Project -> SQL Editor)

-- 1) Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  description text,
  "group" text,
  subgroup text,
  brand text,
  garantia_raw text,
  garantia text,
  variants jsonb,
  variant text,
  price numeric(12,2),
  images jsonb,
  image text,
  image_illustrative boolean DEFAULT false,
  video text,
  internal text,
  created_at timestamptz DEFAULT now()
);

-- 2) Indexes (optional but helpful)
CREATE INDEX IF NOT EXISTS products_name_idx ON public.products USING gin (to_tsvector('simple', coalesce(name, '')));
CREATE INDEX IF NOT EXISTS products_group_idx ON public.products ("group");

-- 3) Enable Row Level Security and create policies
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Allow public read (SELECT) for everyone (anon) — adjust if you want more restrictions
CREATE POLICY IF NOT EXISTS "Public read" ON public.products
  FOR SELECT
  USING ( true );

-- Allow authenticated users to insert/update/delete (recommended)
CREATE POLICY IF NOT EXISTS "Authenticated write" ON public.products
  FOR ALL
  USING ( auth.role() = 'authenticated' )
  WITH CHECK ( auth.role() = 'authenticated' );

-- 4) Create publication for realtime (so Realtime can stream changes)
-- You may need to enable Realtime/Replication in Project Settings first.
CREATE PUBLICATION IF NOT EXISTS supabase_realtime FOR TABLE public.products;

-- 5) Notes:
-- - Use Supabase Storage (create a bucket e.g. `product-media`) for images/videos.
--   In the Supabase dashboard > Storage > Create bucket. You can make it public (easier)
--   or keep it private and upload via signed URLs/server.
-- - To allow admin uploads from the admin UI, prefer authenticating the admin (Supabase Auth)
--   and keep the storage bucket public for serving images. If you want client uploads while
--   preventing anonymous writes, keep the bucket private and require authenticated users.
