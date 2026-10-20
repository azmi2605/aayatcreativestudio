-- =============================================================================
-- Migration 00007 — Lock down the permissive portal write policies
-- 2026-10-19
-- The admin portal originally wrote with the publishable (anon) key because no
-- Supabase Auth account existed. That left every content table writable by
-- anyone who loaded the site, which is not acceptable once the portal has a
-- real account.
--
-- The portal now signs in with Supabase Auth and the database checks
-- private.admin_users through is_admin(). These policies are no longer needed
-- and are dropped here.
--
-- Forward-only and idempotent — safe to re-run.
-- =============================================================================

-- 1. Content tables: the "Admin full ..." policies already cover the portal.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow anon insert categories" ON public.categories;
  DROP POLICY IF EXISTS "Allow anon update categories" ON public.categories;
  DROP POLICY IF EXISTS "Allow anon delete categories" ON public.categories;
  DROP POLICY IF EXISTS "Allow anon insert portfolio" ON public.portfolio_items;
  DROP POLICY IF EXISTS "Allow anon update portfolio" ON public.portfolio_items;
  DROP POLICY IF EXISTS "Allow anon delete portfolio" ON public.portfolio_items;
  DROP POLICY IF EXISTS "Allow anon insert portfolio images" ON public.portfolio_images;
  DROP POLICY IF EXISTS "Allow anon update site_settings" ON public.site_settings;
END $$;

-- 2. Storage: uploads are admin-only through is_admin() now.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow anon upload storage" ON storage.objects;
  DROP POLICY IF EXISTS "Allow anon delete storage" ON storage.objects;
END $$;

-- 3. The admin policies must exist before the portal is usable. Re-create
--    them if a previous environment was left without them.
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
  CREATE POLICY "Admin full site_settings" ON public.site_settings
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin upload portfolio images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'portfolio' AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin update portfolio images" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'portfolio' AND public.is_admin())
    WITH CHECK (bucket_id = 'portfolio' AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin delete portfolio images" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'portfolio' AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. The public read of published content stays open — that is the client site.
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
  CREATE POLICY "Public read categories" ON public.categories
    FOR SELECT TO anon, authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read site_settings" ON public.site_settings
    FOR SELECT TO anon, authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read portfolio images" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'portfolio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
