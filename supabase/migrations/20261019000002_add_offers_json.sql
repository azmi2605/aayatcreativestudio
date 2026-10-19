-- Migration 00002: Add offers_json column to site_settings
-- Allows admin to persist promotional offers to Supabase (synced to client site)

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS offers_json JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seed: initialize with the default offer if no offers exist yet
UPDATE public.site_settings
SET offers_json = '[
  {
    "id": "offer-1",
    "title": "New Brand Launch Starter Package",
    "code": "IMPACT25",
    "discount": "20% OFF on 3+ Ad Creatives",
    "expiry": "Limited Slots This Month",
    "active": true
  }
]'::jsonb
WHERE is_singleton = TRUE
  AND offers_json = '[]'::jsonb;

-- Also seed the site_settings row if it doesn't exist yet
INSERT INTO public.site_settings (is_singleton, tagline, instagram_handle, contact_email, about_text, offers_json)
VALUES (
  TRUE,
  'High-impact design for forward-thinking brands',
  'aayatcreativestudio',
  'aayatcreativestudio@gmail.com',
  'Aayat Creative Studio crafts distinct visual narratives that turn ordinary products into premium, high-impact brands. Founded by a passionate designer, the studio specialises in ad creatives, poster design, and social media visuals.',
  '[{"id":"offer-1","title":"New Brand Launch Starter Package","code":"IMPACT25","discount":"20% OFF on 3+ Ad Creatives","expiry":"Limited Slots This Month","active":true}]'::jsonb
)
ON CONFLICT (is_singleton) DO NOTHING;
