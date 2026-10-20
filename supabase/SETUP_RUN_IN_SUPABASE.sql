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
  category TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
  alt_text TEXT CHECK (length(trim(alt_text)) BETWEEN 1 AND 300),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT nextval('public.portfolio_sort_seq'),
  first_published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_items ALTER COLUMN category TYPE TEXT USING category::text;

-- The offer/tag badge shown on a design, on both the portal and the client site.
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS offer_tag TEXT;

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
  services TEXT[] DEFAULT '{}',
  project_details TEXT NOT NULL CHECK (length(trim(project_details)) BETWEEN 20 AND 1000),
  budget_range TEXT CHECK (length(trim(budget_range)) <= 60),
  reference_link TEXT CHECK (length(trim(reference_link)) <= 500 AND (reference_link IS NULL OR reference_link ~ '^https?://')),
  timeline TEXT CHECK (length(trim(timeline)) <= 100),
  status public.enquiry_status NOT NULL DEFAULT 'new',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS services TEXT[];

-- 9. Categories (shared admin <-> client list)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE CHECK (value ~ '^[a-z0-9_]+$'),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 60),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keeps categories.updated_at accurate when a label changes.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS categories_updated_at ON public.categories;
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. Private admin_users table
CREATE TABLE IF NOT EXISTS private.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Services (shared admin <-> client list for the Capabilities section)
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL CHECK (length(trim(category_name)) BETWEEN 1 AND 100),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS services_updated_at ON public.services;
CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS for services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read services" ON public.services
    FOR SELECT TO anon, authenticated USING (is_active = TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin full services" ON public.services
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed services
INSERT INTO public.services (category_name, description, sort_order, is_active, items) VALUES
  ('Ad Creatives',
   'Performance-driven digital ads engineered to capture attention in feeds, enhance click-through rates, and scale your brand identity.',
   1, TRUE,
   '[{"label": "Product ad creatives", "is_active": true},
     {"label": "Simple UGC-style product videos", "is_active": true},
     {"label": "Advanced product videos", "is_active": true}]'::jsonb),
  ('Poster Design',
   'Striking typography and editorial layouts designed for cultural events, commercial promotions, and premium print installations.',
   2, TRUE,
   '[{"label": "Basic promotional posters", "is_active": true},
     {"label": "Premium product advertisements", "is_active": true},
     {"label": "Poster bundles", "is_active": true}]'::jsonb),
  ('Social Media Visuals',
   'Distinctive, unified brand aesthetics that transform profiles into immersive brand experiences with memorable visual systems.',
   3, TRUE,
   '[{"label": "Single social media posts", "is_active": true},
     {"label": "Multi-post sets (3 or 5 posts)", "is_active": true},
     {"label": "Consistent brand-style layouts", "is_active": true}]'::jsonb),
  ('Instagram Stories & Reels',
   'Short-form vertical designs and edits built for scroll-stopping reach and engagement.',
   4, TRUE,
   '[{"label": "Instagram story designs", "is_active": true},
     {"label": "Simple reel editing", "is_active": true}]'::jsonb),
  ('Logo & Branding',
   'Distinctive mark-making and identity systems that anchor a brand across every touchpoint.',
   5, TRUE,
   '[{"label": "Basic logo design", "is_active": true},
     {"label": "Custom logo design", "is_active": true},
     {"label": "Logo with brand color palette", "is_active": true},
     {"label": "Mini brand kit", "is_active": true}]'::jsonb),
  ('Other Creative Designs',
   'One-off print and collateral pieces for campaigns, events, and everyday brand use.',
   6, TRUE,
   '[{"label": "Flyers", "is_active": true},
     {"label": "Invitations", "is_active": true},
     {"label": "Menus", "is_active": true},
     {"label": "Banners", "is_active": true},
     {"label": "Business cards", "is_active": true}]'::jsonb)
ON CONFLICT (category_name) DO UPDATE SET
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  items = EXCLUDED.items,
  updated_at = now();

-- 12. Private rate_limits table
CREATE TABLE IF NOT EXISTS private.rate_limits (
  caller_hash TEXT NOT NULL,
  bucket_window TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (caller_hash, bucket_window)
);

-- 11. is_admin() Security Definer Function
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

-- 12. Enable Row Level Security
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 13. RLS Policies — Public reads
DO $$ BEGIN
  CREATE POLICY "Public read site_settings" ON public.site_settings
    FOR SELECT TO anon, authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read categories" ON public.categories
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

-- 14. RLS Policies — Admin full access
DO $$ BEGIN
  CREATE POLICY "Admin full site_settings" ON public.site_settings
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin full categories" ON public.categories
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

-- 15. RLS Policies — public writes for enquiries only
-- The contact form posts to the submit-enquiry edge function, which inserts
-- with the service role. The policy below covers a direct insert as well.
DO $$ BEGIN
  CREATE POLICY "Public insert enquiries" ON public.enquiries
    FOR INSERT TO anon, authenticated
    WITH CHECK (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The portal signs in with Supabase Auth and writes through the
-- "Admin full ..." policies above, which check is_admin(). No anonymous
-- write policy exists on the content tables.

-- 16. Seed site_settings singleton row
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

-- 17. Seed the built-in category list
INSERT INTO public.categories (value, label, sort_order) VALUES
  ('ads', 'Ad Creatives', 1),
  ('posters', 'Poster Design', 2),
  ('social_media', 'Social Media Design', 3)
ON CONFLICT (value) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 18. Storage bucket for portfolio images
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

-- 19. Storage RLS policies
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
