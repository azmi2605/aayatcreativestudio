-- Migration 00003: Add is_active flag to categories for soft-delete support
-- Allows the admin to deactivate a category (soft-delete) so it disappears
-- from the Client Site filter list without orphaning existing portfolio items.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill any existing rows as active.
UPDATE public.categories SET is_active = TRUE WHERE is_active IS NULL;

-- Index for fast active-category lookups on the client read path.
CREATE INDEX IF NOT EXISTS categories_is_active_sort_idx
  ON public.categories (is_active, sort_order);
