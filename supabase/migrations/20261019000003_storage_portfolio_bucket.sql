-- Migration 00003: Create portfolio Storage bucket and policies

-- Create the 'portfolio' storage bucket (public read access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio',
  'portfolio',
  TRUE,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Allow public (anon) to read all objects in portfolio bucket
CREATE POLICY IF NOT EXISTS "Public read portfolio images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'portfolio');

-- Allow authenticated admins to upload images
CREATE POLICY IF NOT EXISTS "Admin upload portfolio images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'portfolio'
    AND public.is_admin()
  );

-- Allow authenticated admins to update images
CREATE POLICY IF NOT EXISTS "Admin update portfolio images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'portfolio' AND public.is_admin());

-- Allow authenticated admins to delete images
CREATE POLICY IF NOT EXISTS "Admin delete portfolio images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'portfolio' AND public.is_admin());
