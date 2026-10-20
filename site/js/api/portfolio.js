/**
 * site/js/api/portfolio.js
 * Public data-access module — reads portfolio items, categories and offers
 * for the client site.
 *
 * Data priority chain (highest → lowest):
 *   1. Supabase REST API — the single source of truth. The admin portal writes
 *      here, and the client site reads from here.
 *   2. localStorage mirror — a copy of what Supabase last returned in this
 *      browser. It is only used when Supabase cannot be reached (offline).
 *
 * A successful Supabase response is always authoritative, even when it is
 * empty: the client site shows what the admin published, nothing else. There
 * is no seed data, so an empty database renders an empty state rather than
 * invented projects.
 */

import { getConfig } from '../config.js';

// ─── Storage keys shared with the admin dashboard ──────────────────────────
const PRODUCTS_STORE_KEY = 'aayat_custom_products';
const CATEGORIES_STORE_KEY = 'aayat_custom_categories';
const OFFERS_STORE_KEY = 'aayat_offers';

// The columns the client site is allowed to read (AGENTS 6.2 — explicit select).
const ITEM_COLUMNS =
  'id,slug,title,client_brand,category,description,alt_text,offer_tag,' +
  'featured,published,sort_order,created_at,media,' +
  'portfolio_images(id,storage_path,image_order,width,height,media_type,mime_type,file_size,thumbnail_url)';

// Categories resolved on the last read, used for synchronous label lookups.
let liveCategories = [];

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch published portfolio items for the client site.
 * Supabase is authoritative: an empty result means the admin has published
 * nothing yet, and the page renders its empty state.
 * @returns {Promise<Array<object>>} The published portfolio items.
 */
export async function fetchPublishedItems() {
  try {
    const items = await _fetchFromSupabase();
    const normalized = (items || []).map(_normalizeItem);
    // Mirror for the offline path only. Never read back as authoritative.
    localStorage.setItem(PRODUCTS_STORE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (e) {
    console.warn('[portfolio.js] Supabase unreachable, using the local mirror:', e.message);
    return _getLocalStorageItems() || [];
  }
}

/**
 * Fetch the shared category list.
 * The admin portal and the client site read the same public.categories table.
 * @returns {Promise<Array<{value: string, label: string}>>} The category list.
 */
export async function fetchCategories() {
  try {
    const categories = await _fetchCategoriesFromSupabase();
    if (Array.isArray(categories)) {
      liveCategories = categories;
      localStorage.setItem(CATEGORIES_STORE_KEY, JSON.stringify(categories));
      return categories;
    }
  } catch (e) {
    console.warn('[portfolio.js] Supabase unreachable, using the local mirror:', e.message);
  }

  const stored = _getStoredCategories();
  if (stored) {
    liveCategories = stored;
    return stored;
  }
  return [];
}

/**
 * The display name of a category value.
 * Uses the shared list when it is known, and falls back to the slug.
 * @param {string} value - The category value.
 * @returns {string} The label to show.
 */
export function getCategoryLabel(value) {
  if (!value) return 'Creative Work';
  const match = liveCategories.find(c => c.value === value);
  if (match) return match.label;
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Fetch a single published portfolio item by slug.
 * @param {string} slug - The item slug.
 * @returns {Promise<object|null>} The item, or null when it is not published.
 */
export async function fetchPublishedItemBySlug(slug) {
  if (!slug || typeof slug !== 'string') return null;

  try {
    const items = await _fetchSlugFromSupabase(slug);
    if (Array.isArray(items) && items.length > 0) {
      return _normalizeItem(items[0]);
    }
    return null;
  } catch (e) {
    console.warn('[portfolio.js] Supabase unreachable, using the local mirror:', e.message);
  }

  const all = _getLocalStorageItems() || [];
  return all.find(i => i.slug === slug) || null;
}

/**
 * Get active offers to display on the client site (banner / promos section).
 * Supabase is authoritative: an empty list means no offer is running.
 * @returns {Promise<Array<object>>} The active offers.
 */
export async function fetchActiveOffers() {
  try {
    const offers = await _fetchOffersFromSupabase();
    if (Array.isArray(offers)) {
      localStorage.setItem(OFFERS_STORE_KEY, JSON.stringify(offers));
      return offers.filter(o => o.active !== false);
    }
  } catch (e) {
    console.warn('[portfolio.js] Supabase unreachable, using the local mirror:', e.message);
  }
  return getLiveOffers();
}

/**
 * Synchronous getter used by home.js for immediate banner display.
 * Reads the localStorage mirror written after the last successful Supabase read.
 * @returns {Array<object>} The mirrored active offers.
 */
export function getLiveOffers() {
  const stored = localStorage.getItem(OFFERS_STORE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(o => o.active !== false);
  } catch (e) {
    console.warn('[portfolio.js] offer mirror parse error:', e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function _fetchFromSupabase() {
  const config = getConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey || config.supabaseAnonKey.includes('placeholder')) {
    throw new Error('Supabase not configured');
  }

  const endpoint = `${config.supabaseUrl}/rest/v1/portfolio_items` +
    `?select=${ITEM_COLUMNS}` +
    `&published=eq.true&order=sort_order.desc`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  const resp = await fetch(endpoint, {
    headers: {
      'apikey': config.supabaseAnonKey,
      'Authorization': `Bearer ${config.supabaseAnonKey}`,
      'Accept': 'application/json'
    },
    signal: controller.signal
  });

  clearTimeout(timeout);

  if (!resp.ok) throw new Error(`Supabase error: ${resp.status}`);
  return resp.json();
}

async function _fetchCategoriesFromSupabase() {
  const config = getConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey || config.supabaseAnonKey.includes('placeholder')) {
    throw new Error('Supabase not configured');
  }

  const endpoint = `${config.supabaseUrl}/rest/v1/categories` +
    `?select=value,label,sort_order,is_active` +
    `&is_active=eq.true&order=sort_order.asc`;

  const resp = await fetch(endpoint, {
    cache: 'no-store',
    headers: {
      'apikey': config.supabaseAnonKey,
      'Authorization': `Bearer ${config.supabaseAnonKey}`,
      'Accept': 'application/json'
    }
  });

  if (!resp.ok) throw new Error(`Supabase error: ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data) ? data : null;
}

async function _fetchSlugFromSupabase(slug) {
  const config = getConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey || config.supabaseAnonKey.includes('placeholder')) {
    throw new Error('Supabase not configured');
  }

  const endpoint = `${config.supabaseUrl}/rest/v1/portfolio_items` +
    `?select=${ITEM_COLUMNS}` +
    `&slug=eq.${encodeURIComponent(slug)}&published=eq.true`;

  const resp = await fetch(endpoint, {
    headers: {
      'apikey': config.supabaseAnonKey,
      'Authorization': `Bearer ${config.supabaseAnonKey}`,
      'Accept': 'application/json'
    }
  });

  if (!resp.ok) throw new Error(`Supabase error: ${resp.status}`);
  return resp.json();
}

async function _fetchOffersFromSupabase() {
  const config = getConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey || config.supabaseAnonKey.includes('placeholder')) {
    throw new Error('Supabase not configured');
  }

  const endpoint = `${config.supabaseUrl}/rest/v1/site_settings?select=offers_json`;
  const resp = await fetch(endpoint, {
    headers: {
      'apikey': config.supabaseAnonKey,
      'Authorization': `Bearer ${config.supabaseAnonKey}`,
      'Accept': 'application/json'
    }
  });

  if (!resp.ok) throw new Error(`Supabase error: ${resp.status}`);

  // site_settings is a singleton, so PostgREST returns a one-row array.
  const rows = await resp.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const offers = rows[0].offers_json;
  if (Array.isArray(offers)) return offers;
  if (typeof offers === 'string') {
    try {
      return JSON.parse(offers);
    } catch (e) {
      console.warn('[portfolio.js] offers_json is not valid JSON:', e);
      return null;
    }
  }
  return null;
}

/**
 * Read items from the localStorage mirror.
 * Returns null when the mirror is absent or unusable; an empty array is a valid
 * mirror that means "the admin published nothing".
 * @returns {Array<object>|null} The mirrored items, or null.
 */
function _getLocalStorageItems() {
  const stored = localStorage.getItem(PRODUCTS_STORE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return null;

    return parsed
      .filter(p => p.published !== false)
      .map((p, idx) => ({
        id: p.id || `item-${idx}`,
        slug: p.slug || generateSlug(p.title),
        title: p.title,
        client_brand: p.client_brand || p.brand,
        category: p.category,
        description: p.description || p.desc,
        alt_text: p.alt_text || p.title,
        offerTag: p.offerTag || p.offer_tag || null,
        featured: p.featured !== false,
        published: p.published !== false,
        sort_order: p.sort_order || idx,
        portfolio_images: p.portfolio_images && p.portfolio_images.length > 0
          ? p.portfolio_images
          : [{ id: `img-${idx}`, storage_path: p.image || '/assets/brand/monogram.png', image_order: 1, width: 1200, height: 900 }]
      }));
  } catch (e) {
    console.warn('[portfolio.js] localStorage parse error:', e);
    return null;
  }
}

/**
 * Read the mirrored category list.
 * @returns {Array<{value: string, label: string}>|null} The mirror, or null.
 */
function _getStoredCategories() {
  const stored = localStorage.getItem(CATEGORIES_STORE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return null;
    return parsed.map(c => ({ value: c.value, label: c.label }));
  } catch (e) {
    console.warn('[portfolio.js] category mirror parse error:', e);
    return null;
  }
}

/**
 * Normalises a Supabase row into the shape the page modules render.
 * The database column is `offer_tag`; the pages use `offerTag`.
 * @param {object} row - A row from public.portfolio_items.
 * @returns {object} The normalised item.
 */
function _normalizeItem(row) {
  const images = (row.portfolio_images || []).map(img => {
    const isVideo = img.media_type === 'video' ||
      /\.(mp4|webm|mov)(\?.*)?$/i.test(img.storage_path || '') ||
      (img.mime_type && img.mime_type.startsWith('video/'));
    return {
      ...img,
      media_type: isVideo ? 'video' : 'image',
      isVideo
    };
  });

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    client_brand: row.client_brand,
    category: row.category,
    description: row.description,
    alt_text: row.alt_text,
    offerTag: row.offer_tag || null,
    featured: row.featured !== false,
    published: row.published !== false,
    sort_order: row.sort_order,
    media: row.media || null,
    portfolio_images: images
  };
}

function generateSlug(text) {
  return (text || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) || 'project';
}
