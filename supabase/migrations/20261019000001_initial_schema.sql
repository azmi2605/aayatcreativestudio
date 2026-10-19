-- Migration 00001: Initial Database Schema for Aayat Creative Studio
-- Follows DATABASE.md and ARCHITECTURE.md specifications

-- 1. Create Private Schema (DATABASE amendment A1)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public, anon, authenticated;

-- 2. Enums
CREATE TYPE public.portfolio_category AS ENUM ('ads', 'posters', 'social_media');
CREATE TYPE public.enquiry_status AS ENUM ('new', 'contacted', 'closed');
CREATE TYPE public.creative_service AS ENUM ('ad_creatives', 'poster_design', 'social_media_design', 'other');

-- 3. Sequences for Sort Orders
CREATE SEQUENCE IF NOT EXISTS public.portfolio_sort_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.testimonial_sort_seq START WITH 1;

-- 4. Site Settings (Singleton table)
CREATE TABLE public.site_settings (
  is_singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (is_singleton = TRUE),
  tagline TEXT NOT NULL DEFAULT 'High-impact design for forward-thinking brands',
  instagram_handle TEXT NOT NULL DEFAULT 'aayatcreativestudio',
  contact_email TEXT NOT NULL DEFAULT 'aayatcreativestudio@gmail.com',
  whatsapp_number TEXT,
  about_text TEXT NOT NULL DEFAULT 'Aayat Creative Studio crafts distinct visual narratives.',
  about_photo_path TEXT,
  about_photo_alt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Portfolio Items
CREATE TABLE public.portfolio_items (
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
CREATE TABLE public.portfolio_images (
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
CREATE TABLE public.testimonials (
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
CREATE TABLE public.enquiries (
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

-- 9. Private Internal Tables
CREATE TABLE private.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE private.rate_limits (
  caller_hash TEXT NOT NULL,
  bucket_window TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (caller_hash, bucket_window)
);

-- 10. Security Definer Functions
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

-- 11. Row Level Security Policies
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- Public reads
CREATE POLICY "Public read site_settings" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "Public read published portfolio" ON public.portfolio_items
  FOR SELECT TO anon, authenticated USING (published = TRUE);

CREATE POLICY "Public read published portfolio images" ON public.portfolio_images
  FOR SELECT TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM public.portfolio_items
      WHERE public.portfolio_items.id = public.portfolio_images.portfolio_item_id
      AND public.portfolio_items.published = TRUE
    )
  );

CREATE POLICY "Public read published testimonials" ON public.testimonials
  FOR SELECT TO anon, authenticated USING (published = TRUE);

-- Admin full access
CREATE POLICY "Admin full site_settings" ON public.site_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin full portfolio" ON public.portfolio_items
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin full portfolio_images" ON public.portfolio_images
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin full testimonials" ON public.testimonials
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin read enquiries" ON public.enquiries
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admin update enquiry status" ON public.enquiries
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin delete enquiries" ON public.enquiries
  FOR DELETE TO authenticated USING (public.is_admin());
