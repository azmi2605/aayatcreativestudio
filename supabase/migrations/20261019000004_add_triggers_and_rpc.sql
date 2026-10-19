-- Migration 00004: Add triggers, RPC functions, and additional RLS policies
-- Aligns with existing schema (creative_service enum, portfolio_item_id FK, is_singleton PK)
-- Required by API.md sections 6, 7.3, 9.5

-- ----------------------------------------------------------------------------
-- Trigger: set_updated_at() for tables with updated_at column
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER portfolio_items_updated_at BEFORE UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER testimonials_updated_at BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Trigger: generate_slug() on portfolio_items insert
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter INTEGER := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := lower(regexp_replace(NEW.title, '[^a-z0-9]+', '-', 'g'));
    base_slug := trim(both '-' FROM base_slug);
    IF base_slug = '' THEN
      base_slug := 'item';
    END IF;

    candidate := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.portfolio_items WHERE slug = candidate) LOOP
      counter := counter + 1;
      candidate := base_slug || '-' || counter;
    END LOOP;

    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portfolio_items_generate_slug BEFORE INSERT ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.generate_slug();

-- ----------------------------------------------------------------------------
-- Trigger: enforce_slug_immutability() on portfolio_items update
-- Raises slug_immutable error (API.md 9.5)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_slug_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.published AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'slug_immutable: The link for a published item can''t change'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portfolio_items_slug_immutable BEFORE UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_slug_immutability();

-- ----------------------------------------------------------------------------
-- Trigger: validate_publish() on portfolio_items update
-- Raises publish_requires_alt_text / publish_requires_image errors (API.md 9.5)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_publish()
RETURNS TRIGGER AS $$
DECLARE
  image_count INTEGER;
BEGIN
  IF NEW.published AND NOT OLD.published THEN
    IF NEW.alt_text IS NULL OR trim(NEW.alt_text) = '' THEN
      RAISE EXCEPTION 'publish_requires_alt_text: Add alt text before publishing'
        USING ERRCODE = '23514';
    END IF;

    SELECT COUNT(*) INTO image_count
    FROM public.portfolio_images
    WHERE portfolio_item_id = NEW.id;

    IF image_count = 0 THEN
      RAISE EXCEPTION 'publish_requires_image: Add at least one image before publishing'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portfolio_items_validate_publish BEFORE UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_publish();

-- ----------------------------------------------------------------------------
-- Trigger: set_first_published_at() on portfolio_items update
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_first_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.published AND NOT OLD.published THEN
    NEW.first_published_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portfolio_items_first_published_at BEFORE UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.set_first_published_at();

-- ----------------------------------------------------------------------------
-- Trigger: enforce_last_image_required() on portfolio_images delete
-- Raises last_image_required error (API.md 9.5)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_last_image_required()
RETURNS TRIGGER AS $$
DECLARE
  item_published BOOLEAN;
  remaining_images INTEGER;
BEGIN
  SELECT published INTO item_published
  FROM public.portfolio_items
  WHERE id = OLD.portfolio_item_id;

  IF item_published THEN
    SELECT COUNT(*) INTO remaining_images
    FROM public.portfolio_images
    WHERE portfolio_item_id = OLD.portfolio_item_id AND id <> OLD.id;

    IF remaining_images = 0 THEN
      RAISE EXCEPTION 'last_image_required: A published item needs at least one image'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portfolio_images_last_image_required BEFORE DELETE ON public.portfolio_images
  FOR EACH ROW EXECUTE FUNCTION public.enforce_last_image_required();

-- ----------------------------------------------------------------------------
-- RPC: check_rate_limit() for submit-enquiry rate limiting
-- Atomic counter increment-and-check. Returns true if within limit.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_now TIMESTAMPTZ := now();
BEGIN
  INSERT INTO private.rate_limits (caller_hash, bucket_window, request_count, expires_at)
  VALUES (p_key, v_now, 1, v_now + (p_window_seconds || ' seconds')::interval)
  ON CONFLICT (caller_hash, bucket_window) DO UPDATE
  SET request_count = CASE
    WHEN rate_limits.bucket_window + (p_window_seconds || ' seconds')::interval <= v_now
      THEN 1
    ELSE rate_limits.request_count + 1
  END,
  bucket_window = CASE
    WHEN rate_limits.bucket_window + (p_window_seconds || ' seconds')::interval <= v_now
      THEN v_now
    ELSE rate_limits.bucket_window
  END,
  expires_at = CASE
    WHEN rate_limits.bucket_window + (p_window_seconds || ' seconds')::interval <= v_now
      THEN v_now + (p_window_seconds || ' seconds')::interval
    ELSE rate_limits.expires_at
  END
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private;

-- ----------------------------------------------------------------------------
-- RPC: move_portfolio_item() - atomic swap with neighbor
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.move_portfolio_item(
  p_item_id UUID,
  p_direction TEXT
)
RETURNS VOID AS $$
DECLARE
  v_current_order INTEGER;
  v_neighbor_id UUID;
  v_neighbor_order INTEGER;
BEGIN
  SELECT sort_order INTO v_current_order
  FROM public.portfolio_items
  WHERE id = p_item_id;

  IF v_current_order IS NULL THEN
    RETURN;
  END IF;

  IF p_direction = 'up' THEN
    SELECT id, sort_order INTO v_neighbor_id, v_neighbor_order
    FROM public.portfolio_items
    WHERE sort_order > v_current_order
    ORDER BY sort_order ASC
    LIMIT 1;
  ELSE
    SELECT id, sort_order INTO v_neighbor_id, v_neighbor_order
    FROM public.portfolio_items
    WHERE sort_order < v_current_order
    ORDER BY sort_order DESC
    LIMIT 1;
  END IF;

  IF v_neighbor_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.portfolio_items SET sort_order = v_neighbor_order WHERE id = p_item_id;
  UPDATE public.portfolio_items SET sort_order = v_current_order WHERE id = v_neighbor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ----------------------------------------------------------------------------
-- RPC: move_testimonial() - atomic swap with neighbor
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.move_testimonial(
  p_testimonial_id UUID,
  p_direction TEXT
)
RETURNS VOID AS $$
DECLARE
  v_current_order INTEGER;
  v_neighbor_id UUID;
  v_neighbor_order INTEGER;
BEGIN
  SELECT sort_order INTO v_current_order
  FROM public.testimonials
  WHERE id = p_testimonial_id;

  IF v_current_order IS NULL THEN
    RETURN;
  END IF;

  IF p_direction = 'up' THEN
    SELECT id, sort_order INTO v_neighbor_id, v_neighbor_order
    FROM public.testimonials
    WHERE sort_order > v_current_order
    ORDER BY sort_order ASC
    LIMIT 1;
  ELSE
    SELECT id, sort_order INTO v_neighbor_id, v_neighbor_order
    FROM public.testimonials
    WHERE sort_order < v_current_order
    ORDER BY sort_order DESC
    LIMIT 1;
  END IF;

  IF v_neighbor_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.testimonials SET sort_order = v_neighbor_order WHERE id = p_testimonial_id;
  UPDATE public.testimonials SET sort_order = v_current_order WHERE id = v_neighbor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ----------------------------------------------------------------------------
-- RLS: rate_limits table (default deny - function only via service key)
-- ----------------------------------------------------------------------------

ALTER TABLE private.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = default deny. Only check_rate_limit() (security definer) can access.

-- ----------------------------------------------------------------------------
-- RLS: enquiries INSERT policy for admin (function uses service key, bypasses RLS)
-- But we add it for completeness in case of direct authenticated inserts
-- ----------------------------------------------------------------------------

CREATE POLICY "Admin insert enquiries" ON public.enquiries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

COMMENT ON FUNCTION public.check_rate_limit(text, integer, integer) IS 'Atomic rate-limit counter for submit-enquiry. Returns true if within limit.';
COMMENT ON FUNCTION public.move_portfolio_item(uuid, text) IS 'Atomic swap of portfolio item sort_order with neighbor.';
COMMENT ON FUNCTION public.move_testimonial(uuid, text) IS 'Atomic swap of testimonial sort_order with neighbor.';