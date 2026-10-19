/**
 * site/js/api/portfolio.js
 * Data-access module for public portfolio items using plain fetch against Supabase PostgREST Data API
 * Source of truth: API.md PUB-2 and PUB-3
 */

import { getConfig } from '../config.js';

/**
 * Fetches all published portfolio items with associated images
 * @returns {Promise<Array>} List of published portfolio items
 */
export async function fetchPublishedItems() {
  const config = getConfig();
  const endpoint = `${config.supabaseUrl}/rest/v1/portfolio_items` +
    `?select=id,slug,title,client_brand,category,description,alt_text,featured,sort_order,created_at,` +
    `portfolio_images(id,storage_path,image_order,width,height,variants)` +
    `&published=eq.true&order=sort_order.desc`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout per API 16.2

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

    if (!response.ok) {
      console.warn(`[Portfolio API] PostgREST returned status ${response.status}. Using fallback preview items.`);
      return getFallbackPortfolioItems();
    }

    const data = await response.json();
    return Array.isArray(data) && data.length > 0 ? data : getFallbackPortfolioItems();
  } catch (err) {
    console.warn('[Portfolio API] Network or fetch error. Using fallback preview items.', err);
    return getFallbackPortfolioItems();
  }
}

/**
 * Fetches a single published portfolio item by unique slug
 * @param {string} slug
 * @returns {Promise<Object|null>}
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
      method: 'GET',
      headers: {
        'apikey': config.supabaseAnonKey,
        'Authorization': `Bearer ${config.supabaseAnonKey}`,
        'Accept': 'application/vnd.pgrst.object+json'
      }
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn(`[Portfolio API] Error fetching item with slug "${slug}".`, err);
    return null;
  }
}

/**
 * Fallback items for local preview and offline resilience (ARCHITECTURE 3.1)
 */
function getFallbackPortfolioItems() {
  return [
    {
      id: "preview-1",
      slug: "lumina-botanicals-campaign",
      title: "Lumina Botanicals Brand & Social Launch",
      client_brand: "Lumina Botanicals",
      category: "ads",
      description: "A conversion-focused visual campaign celebrating organic skincare through minimalist typography and earthy tones.",
      alt_text: "Editorial skincare advertising poster featuring warm amber lighting and serif typography",
      featured: true,
      sort_order: 3,
      portfolio_images: [
        {
          id: "img-1",
          storage_path: "/assets/brand/monogram.png",
          image_order: 1,
          width: 800,
          height: 1000
        }
      ]
    },
    {
      id: "preview-2",
      slug: "solstice-sound-festival",
      title: "Solstice Festival Cultural Poster Series",
      client_brand: "Solstice Arts",
      category: "posters",
      description: "Limited-edition silkscreen posters with experimental typography for an indie electronic music festival.",
      alt_text: "Dynamic geometric poster with bold high-contrast serifs and gold accent flourishes",
      featured: true,
      sort_order: 2,
      portfolio_images: [
        {
          id: "img-2",
          storage_path: "/assets/brand/monogram.png",
          image_order: 1,
          width: 800,
          height: 1100
        }
      ]
    },
    {
      id: "preview-3",
      slug: "aurora-coffee-roasters",
      title: "Aurora Artisan Coffee Packaging & Social Identity",
      client_brand: "Aurora Coffee",
      category: "social_media",
      description: "Cohesive social feed direction and editorial visual system for an artisanal specialty roastery.",
      alt_text: "Warm coffee packaging and social grid design with clean layout structure",
      featured: true,
      sort_order: 1,
      portfolio_images: [
        {
          id: "img-3",
          storage_path: "/assets/brand/monogram.png",
          image_order: 1,
          width: 800,
          height: 800
        }
      ]
    }
  ];
}
