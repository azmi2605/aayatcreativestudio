/**
 * site/js/api/portfolio.js
 * Data-access module for public portfolio items.
 * Seamlessly connects items added/removed in the Admin portal to the client site!
 */

import { getConfig } from '../config.js';

// Base seed items matching @aayatcreativestudio
export const SEED_PORTFOLIO_ITEMS = [
  {
    id: "item-lumina-skincare",
    slug: "lumina-botanicals-ad-campaign",
    title: "Lumina Botanicals — Organic Radiance Ad Creative",
    client_brand: "Lumina Botanicals",
    category: "ads",
    description: "“Your product deserves more than just a photo.” A scroll-stopping product ad creative turning ordinary product photography into an aesthetic, premium digital billboard that demands attention in social feeds.",
    alt_text: "Aesthetic skincare serum bottle with warm amber lighting and serif typography",
    featured: true,
    sort_order: 3,
    offerTag: "Trending Creative",
    portfolio_images: [
      {
        id: "img-lumina",
        storage_path: "/assets/portfolio/lumina-skincare-ad.jpg",
        image_order: 1,
        width: 1200,
        height: 900
      }
    ]
  },
  {
    id: "item-artisan-brew",
    slug: "artisan-brew-bakery-poster",
    title: "Artisan Brew & Bakery — Promotional Ad Poster",
    client_brand: "Artisan Brew Co.",
    category: "posters",
    description: "“Your food deserves to look as irresistible as it tastes.” Commercial promotional poster combining rich food photography with classical editorial typography to drive café footfall and online orders.",
    alt_text: "Commercial café and bakery promotional poster featuring an iced latte, fresh croissant, and warm typography",
    featured: true,
    sort_order: 2,
    offerTag: "Specialty Format",
    portfolio_images: [
      {
        id: "img-brew",
        storage_path: "/assets/portfolio/artisan-brew-poster.jpg",
        image_order: 1,
        width: 1200,
        height: 900
      }
    ]
  },
  {
    id: "item-velvet-fig",
    slug: "velvet-fig-luxury-fragrance",
    title: "Velvet Fig Eau de Parfum — Luxury Social Creative",
    client_brand: "Artisanal Fragrances",
    category: "social_media",
    description: "“You sell the product. We design the impact.” Bespoke social media visual system turning product launches into captivating, luxury brand experiences.",
    alt_text: "High-end luxury perfume advertisement with gold cap, textured stone base, and soft botanical shadows",
    featured: true,
    sort_order: 1,
    offerTag: "Featured",
    portfolio_images: [
      {
        id: "img-velvet",
        storage_path: "/assets/portfolio/velvet-fig-fragrance.jpg",
        image_order: 1,
        width: 1200,
        height: 900
      }
    ]
  }
];

/**
 * Returns portfolio items updated by admin portal in real time
 */
export function getLivePortfolioItems() {
  const customProducts = localStorage.getItem('aayat_custom_products');
  if (customProducts) {
    try {
      const parsed = JSON.parse(customProducts);
      if (Array.isArray(parsed)) {
        return parsed.map((p, idx) => ({
          id: p.id || `item-${idx}`,
          slug: p.slug || generateSlug(p.title),
          title: p.title,
          client_brand: p.brand || p.client_brand,
          category: p.category,
          description: p.desc || p.description,
          alt_text: p.title,
          featured: true,
          sort_order: idx + 1,
          offerTag: p.offerTag || null,
          portfolio_images: [
            {
              id: `img-${idx}`,
              storage_path: p.image || '/assets/brand/monogram.png',
              image_order: 1,
              width: 1200,
              height: 900
            }
          ]
        }));
      }
    } catch (e) {
      console.warn('Error reading admin custom products:', e);
    }
  }
  return SEED_PORTFOLIO_ITEMS;
}

/**
 * Returns active promotional offers configured in admin
 */
export function getLiveOffers() {
  const customOffers = localStorage.getItem('aayat_offers');
  if (customOffers) {
    try {
      const parsed = JSON.parse(customOffers);
      if (Array.isArray(parsed)) return parsed.filter(o => o.active !== false);
    } catch (e) {}
  }
  return [
    {
      id: "offer-1",
      title: "New Brand Launch Starter Package",
      code: "IMPACT25",
      discount: "20% OFF on 3+ Ad Creatives",
      expiry: "Limited Slots This Month",
      active: true
    }
  ];
}

/**
 * Fetches all published portfolio items with associated images
 */
export async function fetchPublishedItems() {
  const config = getConfig();
  const endpoint = `${config.supabaseUrl}/rest/v1/portfolio_items` +
    `?select=id,slug,title,client_brand,category,description,alt_text,featured,sort_order,created_at,` +
    `portfolio_images(id,storage_path,image_order,width,height,variants)` +
    `&published=eq.true&order=sort_order.desc`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': config.supabaseAnonKey,
        'Authorization': `Bearer ${config.supabaseAnonKey}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    // Fall back to live admin synced items
  }

  return getLivePortfolioItems();
}

/**
 * Fetches a single published portfolio item by unique slug
 */
export async function fetchPublishedItemBySlug(slug) {
  if (!slug || typeof slug !== 'string') return null;

  const config = getConfig();
  const safeSlug = encodeURIComponent(slug.trim());
  const endpoint = `${config.supabaseUrl}/rest/v1/portfolio_items` +
    `?select=id,slug,title,client_brand,category,description,alt_text,featured,sort_order,created_at,` +
    `portfolio_images(id,storage_path,image_order,width,height,variants)` +
    `&slug=eq.${safeSlug}&published=eq.true`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        'apikey': config.supabaseAnonKey,
        'Authorization': `Bearer ${config.supabaseAnonKey}`,
        'Accept': 'application/vnd.pgrst.object+json'
      }
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {}

  const all = getLivePortfolioItems();
  return all.find(i => i.slug === slug) || null;
}

function generateSlug(text) {
  return (text || 'project')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
