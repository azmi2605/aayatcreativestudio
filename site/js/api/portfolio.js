/**
 * site/js/api/portfolio.js
 * Public data-access module — reads portfolio items and offers for the client site.
 *
 * Data priority chain (highest → lowest):
 *   1. Supabase REST API (live, authoritative data from admin changes)
 *   2. localStorage mirror (written by admin dashboard on every save — instant cross-tab sync)
 *   3. Hard-coded seed items (first-load fallback when Supabase is unreachable)
 */

import { getConfig } from '../config.js';

// ─── Seed portfolio items (matches @aayatcreativestudio Instagram content) ───
export const SEED_PORTFOLIO_ITEMS = [
  {
    id: 'item-lumina-skincare',
    slug: 'lumina-botanicals-ad-campaign',
    title: 'Lumina Botanicals — Organic Radiance Ad Creative',
    client_brand: 'Lumina Botanicals',
    category: 'ads',
    description: '"Your product deserves more than just a photo." A scroll-stopping product ad creative turning ordinary product photography into an aesthetic, premium digital billboard that demands attention in social feeds.',
    alt_text: 'Aesthetic skincare serum bottle with warm amber lighting and serif typography',
    featured: true,
    published: true,
    sort_order: 3,
    offerTag: 'Trending Creative',
    portfolio_images: [{ id: 'img-lumina', storage_path: '/assets/portfolio/lumina-skincare-ad.jpg', image_order: 1, width: 1200, height: 900 }]
  },
  {
    id: 'item-artisan-brew',
    slug: 'artisan-brew-bakery-poster',
    title: 'Artisan Brew & Bakery — Promotional Ad Poster',
    client_brand: 'Artisan Brew Co.',
    category: 'posters',
    description: '"Your food deserves to look as irresistible as it tastes." Commercial promotional poster combining rich food photography with classical editorial typography to drive café footfall and online orders.',
    alt_text: 'Commercial café and bakery promotional poster featuring an iced latte, fresh croissant, and warm typography',
    featured: true,
    published: true,
    sort_order: 2,
    offerTag: 'Specialty Format',
    portfolio_images: [{ id: 'img-brew', storage_path: '/assets/portfolio/artisan-brew-poster.jpg', image_order: 1, width: 1200, height: 900 }]
  },
  {
    id: 'item-velvet-fig',
    slug: 'velvet-fig-luxury-fragrance',
    title: 'Velvet Fig Eau de Parfum — Luxury Social Creative',
    client_brand: 'Artisanal Fragrances',
    category: 'social_media',
    description: '"You sell the product. We design the impact." Bespoke social media visual system turning product launches into captivating, luxury brand experiences.',
    alt_text: 'High-end luxury perfume advertisement with gold cap, textured stone base, and soft botanical shadows',
    featured: true,
    published: true,
    sort_order: 1,
    offerTag: 'Featured',
    portfolio_images: [{ id: 'img-velvet', storage_path: '/assets/portfolio/velvet-fig-fragrance.jpg', image_order: 1, width: 1200, height: 900 }]
  }
];

// ─── Default offer seed ────────────────────────────────────────────────────
const SEED_OFFERS = [
  {
    id: 'offer-1',
    title: 'New Brand Launch Starter Package',
    code: 'IMPACT25',
    discount: '20% OFF on 3+ Ad Creatives',
    expiry: 'Limited Slots This Month',
    active: true
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch published portfolio items for the client site.
 * Tries Supabase first, falls back to localStorage mirror, then seed data.
 */
export async function fetchPublishedItems() {
  // 1. Try Supabase REST
  try {
    const items = await _fetchFromSupabase();
    if (items && items.length > 0) {
      // Mirror to localStorage for offline/fast next-load
      localStorage.setItem('aayat_custom_products', JSON.stringify(_mapToLocalFormat(items)));
      return items;
    }
  } catch (e) {
    // Supabase unreachable — fall through
  }

  // 2. localStorage mirror (written by admin dashboard)
  const localItems = _getLocalStorageItems();
  if (localItems && localItems.length > 0) {
    return localItems;
  }

  // 3. Seed data
  return SEED_PORTFOLIO_ITEMS;
}

/**
 * Fetch a single published portfolio item by slug.
 */
export async function fetchPublishedItemBySlug(slug) {
  if (!slug || typeof slug !== 'string') return null;

  // 1. Try Supabase
  try {
    const item = await _fetchSlugFromSupabase(slug);
    if (item) return item;
  } catch (e) {}

  // 2. Local fallback
  const all = _getLocalStorageItems() || SEED_PORTFOLIO_ITEMS;
  return all.find(i => i.slug === slug) || null;
}

/**
 * Get active offers to display on the client site (banner / promos section).
 * Uses localStorage mirror written by admin dashboard, with Supabase as primary.
 */
export async function fetchActiveOffers() {
  // 1. Try Supabase site_settings
  try {
    const offers = await _fetchOffersFromSupabase();
    if (offers && offers.length > 0) {
      localStorage.setItem('aayat_offers', JSON.stringify(offers));
      return offers.filter(o => o.active !== false);
    }
  } catch (e) {}

  // 2. localStorage mirror
  return getLiveOffers();
}

/**
 * Synchronous getter used by home.js for immediate banner display.
 * Reads directly from localStorage (written by admin dashboard).
 */
export function getLiveOffers() {
  const stored = localStorage.getItem('aayat_offers');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed.filter(o => o.active !== false);
    } catch (e) {}
  }
  return SEED_OFFERS;
}

/**
 * Synchronous getter for portfolio items from localStorage.
 * Used for instant rendering while async Supabase fetch is in-flight.
 */
export function getLivePortfolioItems() {
  return _getLocalStorageItems() || SEED_PORTFOLIO_ITEMS;
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
    `?select=id,slug,title,client_brand,category,description,alt_text,featured,published,sort_order,created_at,` +
    `portfolio_images(id,storage_path,image_order,width,height)` +
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

async function _fetchSlugFromSupabase(slug) {
  const config = getConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey || config.supabaseAnonKey.includes('placeholder')) {
    throw new Error('Supabase not configured');
  }

  const endpoint = `${config.supabaseUrl}/rest/v1/portfolio_items` +
    `?select=id,slug,title,client_brand,category,description,alt_text,featured,published,sort_order,created_at,` +
    `portfolio_images(id,storage_path,image_order,width,height)` +
    `&slug=eq.${encodeURIComponent(slug)}&published=eq.true`;

  const resp = await fetch(endpoint, {
    headers: {
      'apikey': config.supabaseAnonKey,
      'Authorization': `Bearer ${config.supabaseAnonKey}`,
      'Accept': 'application/vnd.pgrst.object+json'
    }
  });

  if (!resp.ok) throw new Error(`Not found: ${resp.status}`);
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
      'Accept': 'application/vnd.pgrst.object+json'
    }
  });

  if (!resp.ok) throw new Error('No offers data');
  const data = await resp.json();
  if (!data || !data.offers_json) return null;
  return Array.isArray(data.offers_json) ? data.offers_json : JSON.parse(data.offers_json);
}

/**
 * Read items from localStorage mirror (admin dashboard writes this on every save).
 * Normalizes both the admin-format and Supabase-format objects into a consistent shape.
 */
function _getLocalStorageItems() {
  const stored = localStorage.getItem('aayat_custom_products');
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    return parsed
      .filter(p => p.published !== false) // Only show published items
      .map((p, idx) => ({
        id: p.id || `item-${idx}`,
        slug: p.slug || generateSlug(p.title),
        title: p.title,
        client_brand: p.client_brand || p.brand,
        category: p.category,
        description: p.description || p.desc,
        alt_text: p.alt_text || p.title,
        featured: p.featured !== false,
        published: p.published !== false,
        sort_order: p.sort_order || idx,
        offerTag: p.offerTag || null,
        portfolio_images: p.portfolio_images && p.portfolio_images.length > 0
          ? p.portfolio_images
          : [{ id: `img-${idx}`, storage_path: p.image || '/assets/brand/monogram.png', image_order: 1, width: 1200, height: 900 }]
      }));
  } catch (e) {
    console.warn('[portfolio.js] localStorage parse error:', e);
    return null;
  }
}

/** Convert Supabase items to the format localStorage stores (for mirroring). */
function _mapToLocalFormat(items) {
  return items.map(p => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    client_brand: p.client_brand,
    brand: p.client_brand,
    category: p.category,
    description: p.description,
    desc: p.description,
    alt_text: p.alt_text || p.title,
    featured: p.featured,
    published: p.published,
    sort_order: p.sort_order,
    offerTag: p.offerTag || null,
    image: p.portfolio_images && p.portfolio_images.length > 0 ? p.portfolio_images[0].storage_path : '/assets/brand/monogram.png',
    portfolio_images: p.portfolio_images || []
  }));
}

function generateSlug(text) {
  return (text || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) || 'project';
}
