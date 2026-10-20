-- =============================================================================
-- Migration 00008 — Keep public.categories.updated_at accurate
-- 2026-10-19
-- The categories table has an updated_at column, but no trigger maintained it.
-- The shared category list is the client site's filter bar, so a stale
-- timestamp would misreport when a label was last changed.
--
-- Idempotent — safe to re-run.
-- =============================================================================

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
