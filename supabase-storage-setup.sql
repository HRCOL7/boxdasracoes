-- Supabase Storage and policies for `product-media` bucket
-- Run this in Supabase SQL Editor (Project -> SQL Editor).
-- Note: create the bucket via the Storage UI first (Storage -> New bucket -> name: product-media)

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public reads (if you make the bucket public in the UI)
CREATE POLICY IF NOT EXISTS public_select_storage_objects
  ON storage.objects
  FOR SELECT
  USING ( true );

-- Allow authenticated users to INSERT (upload) objects
CREATE POLICY IF NOT EXISTS authenticated_insert_storage_objects
  ON storage.objects
  FOR INSERT
  WITH CHECK ( auth.role() = 'authenticated' );

-- Allow authenticated users to UPDATE objects (optional)
CREATE POLICY IF NOT EXISTS authenticated_update_storage_objects
  ON storage.objects
  FOR UPDATE
  USING ( auth.role() = 'authenticated' )
  WITH CHECK ( auth.role() = 'authenticated' );

-- Allow authenticated users to DELETE objects (optional)
CREATE POLICY IF NOT EXISTS authenticated_delete_storage_objects
  ON storage.objects
  FOR DELETE
  USING ( auth.role() = 'authenticated' );

-- Optional: If you want to restrict uploads so that users can only upload
-- to a path that includes their user id, you can use a policy like:
-- WITH CHECK ( auth.role() = 'authenticated' AND ( bucket_id = 'product-media' AND substring(name from 1 for char_length(auth.uid())) = auth.uid() ) )

-- Notes:
-- 1) Supabase Storage's public/private behavior is primarily controlled
--    by the bucket setting (Public toggle). The policies above make
--    sure authenticated users can upload/delete when required.
-- 2) If you keep the bucket private, your frontend should authenticate
--    the admin user (recommended) and use authenticated uploads. For
--    serving files publicly you can either make the bucket public or
--    generate signed URLs from a server/service role.
-- 3) Do NOT expose your service_role key on the frontend.
