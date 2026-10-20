-- =============================================================================
-- Migration 00006 — Portfolio offer tag
-- 2026-10-19
-- The admin form captures an associated offer or deal, but the value was only
-- kept in the browser. This column persists it so the client site can show it.
-- Forward-only and idempotent — safe to re-run.
-- =============================================================================

ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS offer_tag TEXT;
