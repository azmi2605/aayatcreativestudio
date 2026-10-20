-- Migration 00004: Add public.services table for dynamic service cards
-- Powers the "Capabilities / Focused Creative Expertise" section on the client site.
-- Admin manages the same table; changes appear on the client site after a refresh.

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

-- Keep updated_at accurate on edits.
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

-- Index for fast active-service lookups on the client read path.
CREATE INDEX IF NOT EXISTS services_is_active_sort_idx
  ON public.services (is_active, sort_order);

-- RLS: enable and define policies.
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read services" ON public.services
    FOR SELECT TO anon, authenticated USING (is_active = TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin full services" ON public.services
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed: 6 service cards with their included service lists.
INSERT INTO public.services (category_name, description, sort_order, is_active, items) VALUES
  ('Ad Creatives',
   'Performance-driven digital ads engineered to capture attention in feeds, enhance click-through rates, and scale your brand identity.',
   1, TRUE,
   '[
     {"label": "Product ad creatives", "is_active": true},
     {"label": "Simple UGC-style product videos", "is_active": true},
     {"label": "Advanced product videos", "is_active": true}
   ]'::jsonb),
  ('Poster Design',
   'Striking typography and editorial layouts designed for cultural events, commercial promotions, and premium print installations.',
   2, TRUE,
   '[
     {"label": "Basic promotional posters", "is_active": true},
     {"label": "Premium product advertisements", "is_active": true},
     {"label": "Poster bundles", "is_active": true}
   ]'::jsonb),
  ('Social Media Visuals',
   'Distinctive, unified brand aesthetics that transform profiles into immersive brand experiences with memorable visual systems.',
   3, TRUE,
   '[
     {"label": "Single social media posts", "is_active": true},
     {"label": "Multi-post sets (3 or 5 posts)", "is_active": true},
     {"label": "Consistent brand-style layouts", "is_active": true}
   ]'::jsonb),
  ('Instagram Stories & Reels',
   'Short-form vertical designs and edits built for scroll-stopping reach and engagement.',
   4, TRUE,
   '[
     {"label": "Instagram story designs", "is_active": true},
     {"label": "Simple reel editing", "is_active": true}
   ]'::jsonb),
  ('Logo & Branding',
   'Distinctive mark-making and identity systems that anchor a brand across every touchpoint.',
   5, TRUE,
   '[
     {"label": "Basic logo design", "is_active": true},
     {"label": "Custom logo design", "is_active": true},
     {"label": "Logo with brand color palette", "is_active": true},
     {"label": "Mini brand kit", "is_active": true}
   ]'::jsonb),
  ('Other Creative Designs',
   'One-off print and collateral pieces for campaigns, events, and everyday brand use.',
   6, TRUE,
   '[
     {"label": "Flyers", "is_active": true},
     {"label": "Invitations", "is_active": true},
     {"label": "Menus", "is_active": true},
     {"label": "Banners", "is_active": true},
     {"label": "Business cards", "is_active": true}
   ]'::jsonb)
ON CONFLICT (category_name) DO UPDATE SET
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  items = EXCLUDED.items,
  updated_at = now();
