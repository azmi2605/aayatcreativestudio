-- Migration 00004: Support both images and videos in portfolio
-- Updates portfolio bucket limits to 50MB and adds video MIME types.
-- Extends portfolio_images and portfolio_items schema with media attributes.

UPDATE storage.buckets
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm'
    ]
WHERE id = 'portfolio';

ALTER TABLE public.portfolio_images
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS media JSONB;

-- Backfill existing images
UPDATE public.portfolio_images
SET media_type = 'image',
    mime_type = CASE
      WHEN storage_path ILIKE '%.png' THEN 'image/png'
      WHEN storage_path ILIKE '%.webp' THEN 'image/webp'
      WHEN storage_path ILIKE '%.mp4' THEN 'video/mp4'
      WHEN storage_path ILIKE '%.webm' THEN 'video/webm'
      ELSE 'image/jpeg'
    END
WHERE mime_type IS NULL;

-- Backfill portfolio_items.media object
UPDATE public.portfolio_items p
SET media = jsonb_build_object(
  'url', img.storage_path,
  'type', COALESCE(img.media_type, 'image'),
  'mimeType', COALESCE(img.mime_type, 'image/jpeg'),
  'size', COALESCE(img.file_size, 0),
  'thumbnailUrl', img.thumbnail_url
)
FROM public.portfolio_images img
WHERE img.portfolio_item_id = p.id AND p.media IS NULL;
