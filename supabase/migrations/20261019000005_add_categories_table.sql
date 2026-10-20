-- =============================================================================
-- Migration 00005 — Shared category list
-- 2026-10-19
-- The category list used to live only in the admin browser's localStorage, so
-- the client site could never show it and it was not shared between browsers.
-- This table makes the list a single source of truth for the admin dashboard
-- and the public site.
-- Forward-only and idempotent — safe to re-run.
-- =============================================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE CHECK (value ~ '^[a-z0-9_]+$'),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 60),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 3. Public read — the client site builds its filter bar from this list.
DO $$ BEGIN
  CREATE POLICY "Public read categories" ON public.categories
    FOR SELECT TO anon, authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Admin full access.
DO $$ BEGIN
  CREATE POLICY "Admin full categories" ON public.categories
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Permissive write access mirrors the existing portfolio_items policies:
-- the studio has no Supabase Auth account yet, so the admin portal writes
-- with the publishable key. Drop these three once admin auth is enabled.
DO $$ BEGIN
  CREATE POLICY "Allow anon insert categories" ON public.categories
    FOR INSERT TO anon, authenticated WITH CHECK (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow anon update categories" ON public.categories
    FOR UPDATE TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow anon delete categories" ON public.categories
    FOR DELETE TO anon, authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Seed the built-in categories.
INSERT INTO public.categories (value, label, sort_order) VALUES
  ('ads', 'Ad Creatives', 1),
  ('posters', 'Poster Design', 2),
  ('social_media', 'Social Media Design', 3)
ON CONFLICT (value) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
