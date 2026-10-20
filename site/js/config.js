/**
 * site/js/config.js
 * Public Environment Configuration for Aayat Creative Studio
 *
 * NOTE: Contains ONLY public-facing keys (anon / publishable).
 * These are safe to ship in frontend code — they enforce Row Level Security.
 * Under NO circumstances should a service-role key be placed here (AGENTS 7.1).
 */

// Real Supabase project (used across all environments)
const SUPABASE_URL = 'https://dkqpjgptckcsxtsxyyuy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RudiMLiPlMZuUkQL6_DZaA_Jtix3YWH';

// Single source of truth for the "Start a Project" call-to-action link.
// Change here to update every CTA across the site (header, hero, footer,
// work-item pages). No code hunting required.
export const INSTAGRAM_DM_URL = 'https://www.instagram.com/direct/t/18137977882528127/';

const CONFIGS = {
  // Local development — points to the REAL Supabase cloud project
  localhost: {
    environment: 'local',
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    siteUrl: 'http://localhost:3000',
    gaMeasurementId: null,
    enquiryEndpoint: `${SUPABASE_URL}/functions/v1/submit-enquiry`
  },

  // Cloudflare Pages preview / staging environment
  preview: {
    environment: 'preview',
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    siteUrl: 'https://aayatcreativestudio.pages.dev',
    gaMeasurementId: null,
    enquiryEndpoint: `${SUPABASE_URL}/functions/v1/submit-enquiry`
  },

  // Live production environment
  production: {
    environment: 'production',
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    siteUrl: 'https://aayatcreativestudio.com',
    gaMeasurementId: 'G-XXXXXXXXXX',
    enquiryEndpoint: `${SUPABASE_URL}/functions/v1/submit-enquiry`
  }
};

/**
 * Resolves current environment config based on window.location.hostname.
 */
export function getConfig() {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return CONFIGS.localhost;
  }

  if (hostname.endsWith('.pages.dev') || hostname.includes('preview')) {
    return CONFIGS.preview;
  }

  if (hostname === 'aayatcreativestudio.com' || hostname === 'www.aayatcreativestudio.com') {
    return CONFIGS.production;
  }

  // Fallback for file:// or unknown hosts during local testing
  console.warn(`[Config] Unrecognized hostname "${hostname}", defaulting to local config.`);
  return CONFIGS.localhost;
}

export default getConfig();
