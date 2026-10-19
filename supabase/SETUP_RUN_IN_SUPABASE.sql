-- =============================================================================
-- Aayat Creative Studio — Full Database Schema
-- Run this in: https://supabase.com/dashboard/project/dkqpjgptckcsxtsxyyuy/sql/new
-- =============================================================================

-- 1. Create Private Schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public, anon, authenticated;

-- 2. Enums
DO $$ BEGIN
  CREATE TYPE public.portfolio_category AS ENUM ('ads', 'posters', 'social_media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.enquiry_status AS ENUM ('new', 'contacted', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.creative_service AS ENUM ('ad_creatives', 'poster_design', 'social_media_design', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Sequences
CREATE SEQUENCE IF NOT EXISTS public.portfolio_sort_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.testimonial_sort_seq START WITH 1;

-- 4. Site Settings (Singleton)
CREATE TABLE IF NOT EXISTS public.site_settings (
  is_singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (is_singleton = TRUE),
  tagline TEXT NOT NULL DEFAULT 'High-impact design for forward-thinking brands',
  instagram_handle TEXT NOT NULL DEFAULT 'aayatcreativestudio',
  contact_email TEXT NOT NULL DEFAULT 'aayatcreativestudio@gmail.com',
  whatsapp_number TEXT,
  about_text TEXT NOT NULL DEFAULT 'Aayat Creative Studio crafts distinct visual narratives.',
  about_photo_path TEXT,
  about_photo_alt TEXT,
  offers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Portfolio Items
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  client_brand TEXT CHECK (length(trim(client_brand)) BETWEEN 1 AND 100),
  category public.portfolio_category NOT NULL,
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
  alt_text TEXT CHECK (length(trim(alt_text)) BETWEEN 1 AND 300),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT nextval('public.portfolio_sort_seq'),
  first_published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Portfolio Images
CREATE TABLE IF NOT EXISTS public.portfolio_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_item_id UUID NOT NULL REFERENCES public.portfolio_items(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  image_order INTEGER NOT NULL DEFAULT 1 CHECK (image_order >= 1),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_item_image_order UNIQUE (portfolio_item_id, image_order)
);

-- 7. Testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL CHECK (length(trim(client_name)) BETWEEN 1 AND 100),
  brand_name TEXT CHECK (length(trim(brand_name)) BETWEEN 1 AND 100),
  quote TEXT NOT NULL CHECK (length(trim(quote)) BETWEEN 10 AND 600),
  project_tag TEXT CHECK (length(trim(project_tag)) BETWEEN 1 AND 50),
  image_path TEXT,
  image_alt TEXT,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT nextval('public.testimonial_sort_seq'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Enquiries
CREATE TABLE IF NOT EXISTS public.enquiries (
  submission_id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  brand_name TEXT NOT NULL CHECK (length(trim(brand_name)) BETWEEN 1 AND 100),
  email TEXT NOT NULL CHECK (length(trim(email)) <= 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone TEXT CHECK (length(trim(phone)) <= 30),
  service public.creative_service NOT NULL,
  project_details TEXT NOT NULL CHECK (length(trim(project_details)) BETWEEN 20 AND 1000),
  budget_range TEXT CHECK (length(trim(budget_range)) <= 60),
  reference_link TEXT CHECK (length(trim(reference_link)) <= 500 AND (reference_link IS NULL OR reference_link ~ '^https?://')),
  timeline TEXT CHECK (length(trim(timeline)) <= 100),
  status public.enquiry_status NOT NULL DEFAULT 'new',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Private admin_users table
CREATE TABLE IF NOT EXISTS private.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private.rate_limits (
  caller_hash TEXT NOT NULL,
  bucket_window TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (caller_hash, bucket_window)
);

-- 10. is_admin() Security Definer Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, private
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM private.admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;

-- 11. Enable Row Level Security
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- 12. RLS Policies — Public reads
DO $$ BEGIN
  CREATE POLICY "Public read site_settings" ON public.site_settings
    FOR SELECT TO anon, authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read published portfolio" ON public.portfolio_items
    FOR SELECT TO anon, authenticated USING (published = TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read published portfolio images" ON public.portfolio_images
    FOR SELECT TO anon, authenticated USING (
      EXISTS (
        SELECT 1 FROM public.portfolio_items
        WHERE public.portfolio_items.id = public.portfolio_images.portfolio_item_id
        AND public.portfolio_items.published = TRUE
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read published testimonials" ON public.testimonials
    FOR SELECT TO anon, authenticated USING (published = TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 13. RLS Policies — Admin full access
DO $$ BEGIN
  CREATE POLICY "Admin full site_settings" ON public.site_settings
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin full portfolio" ON public.portfolio_items
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin full portfolio_images" ON public.portfolio_images
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin full testimonials" ON public.testimonials
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin read enquiries" ON public.enquiries
    FOR SELECT TO authenticated USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin update enquiry status" ON public.enquiries
    FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin delete enquiries" ON public.enquiries
    FOR DELETE TO authenticated USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 14. Seed site_settings singleton row
INSERT INTO public.site_settings (
  is_singleton, tagline, instagram_handle, contact_email, about_text, offers_json
)
VALUES (
  TRUE,
  'High-impact design for forward-thinking brands',
  'aayatcreativestudio',
  'aayatcreativestudio@gmail.com',
  'Aayat Creative Studio crafts distinct visual narratives that turn ordinary products into premium, high-impact brands. Founded by a passionate designer, the studio specialises in ad creatives, poster design, and social media visuals for ambitious brands.',
  '[{"id":"offer-1","title":"New Brand Launch Starter Package","code":"IMPACT25","discount":"20% OFF on 3+ Ad Creatives","expiry":"Limited Slots This Month","active":true}]'::jsonb
)
ON CONFLICT (is_singleton) DO UPDATE SET
  offers_json = EXCLUDED.offers_json,
  updated_at = now();

-- 15. Storage bucket for portfolio images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio',
  'portfolio',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5242880;

-- 16. Storage RLS policies
DO $$ BEGIN
  CREATE POLICY "Public read portfolio images" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'portfolio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin upload portfolio images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'portfolio' AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin update portfolio images" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'portfolio' AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin delete portfolio images" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'portfolio' AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Done! Verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
