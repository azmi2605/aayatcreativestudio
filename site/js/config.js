/**
 * site/js/config.js
 * Public Environment Configuration for Aayat Creative Studio
 *
 * NOTE: Contains ONLY public-facing configuration.
 * Under NO circumstances should any secret or service-role key be placed here (AGENTS 7.1).
 */

const CONFIGS = {
  // Local development environment
  localhost: {
    environment: 'local',
    supabaseUrl: 'http://127.0.0.1:54321',
    // Default Supabase local development anon key
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM0NDk2MDB9.CRXP_placeholder_local_key',
    siteUrl: 'http://localhost:3000',
    gaMeasurementId: null,
    enquiryEndpoint: 'http://127.0.0.1:54321/functions/v1/submit-enquiry'
  },

  // Cloudflare Pages preview & staging environment
  preview: {
    environment: 'preview',
    supabaseUrl: 'https://dev-project.supabase.co',
    supabaseAnonKey: 'PLACEHOLDER_DEV_ANON_KEY',
    siteUrl: 'https://aayatcreativestudio.pages.dev',
    gaMeasurementId: null,
    enquiryEndpoint: 'https://dev-project.supabase.co/functions/v1/submit-enquiry'
  },

  // Live production environment
  production: {
    environment: 'production',
    supabaseUrl: 'https://prod-project.supabase.co',
    supabaseAnonKey: 'PLACEHOLDER_PROD_ANON_KEY',
    siteUrl: 'https://aayatcreativestudio.com',
    gaMeasurementId: 'G-XXXXXXXXXX',
    enquiryEndpoint: 'https://prod-project.supabase.co/functions/v1/submit-enquiry'
  }
};

/**
 * Resolves current environment config based on window.location.hostname
 * Fails closed if hostname is unrecognized.
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

  // Fallback for safety in local testing or file:// protocol
  console.warn(`[Config] Unrecognized hostname "${hostname}", defaulting to local config.`);
  return CONFIGS.localhost;
}

export default getConfig();
