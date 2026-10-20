/**
 * site/js/admin/supabase-client.js
 * Lightweight Supabase client for Admin CRUD operations.
 * Uses the vendored Supabase JS SDK (no build step, no runtime CDN).
 */

import { getConfig } from '../config.js';

// Vendored @supabase/supabase-js v2.118.0 (UMD build, committed to the repo).
// Loaded from the same origin so the Content-Security-Policy 'self' source
// allows it — a CDN import was blocked in production and silently broke
// every admin read and write.
const SUPABASE_SDK_PATH = '/js/lib/supabase.js';
const STORAGE_BUCKET = 'portfolio';

let _supabase = null;

/** Lazily initialize and cache the Supabase client. */
export async function getSupabaseClient() {
  if (_supabase) return _supabase;
  const config = getConfig();

  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SUPABASE_SDK_PATH;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Supabase SDK'));
      document.head.appendChild(script);
    });
  }

  _supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  return _supabase;
}

/** Sign in admin via Supabase Auth. Returns { session, error }. */
export async function adminSignIn(email, password) {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  return { session: data?.session || null, error };
}

/** Sign out current admin session. */
export async function adminSignOut() {
  const client = await getSupabaseClient();
  await client.auth.signOut();
}

/** Get current auth session (null if not signed in). */
export async function getAdminSession() {
  const client = await getSupabaseClient();
  const { data } = await client.auth.getSession();
  return data?.session || null;
}

/**
 * Ask the database whether the signed-in user is an administrator.
 * The is_admin() function checks private.admin_users (DATABASE.md 6.6), so a
 * valid Auth session on its own does not grant access.
 * @returns {Promise<boolean>} True when the user is an admin.
 */
export async function isAdminUser() {
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc('is_admin');
  if (error) throw error;
  return data === true;
}

// ─── PORTFOLIO ITEMS ────────────────────────────────────────────────────────

/** Fetch ALL portfolio items (all publish states) for admin table. */
export async function adminFetchAllItems() {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('portfolio_items')
    .select('id, slug, title, client_brand, category, description, alt_text, offer_tag, featured, published, sort_order, created_at, media, portfolio_images ( id, storage_path, image_order, width, height, media_type, mime_type, file_size, thumbnail_url )')
    .order('sort_order', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Insert a new portfolio item. Returns inserted row. */
export async function adminInsertItem(itemData) {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('portfolio_items')
    .insert([itemData])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Update a portfolio item by ID. */
export async function adminUpdateItem(id, updates) {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('portfolio_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Delete a portfolio item by ID (cascades to portfolio_images). */
export async function adminDeleteItem(id) {
  const client = await getSupabaseClient();
  const { error } = await client.from('portfolio_items').delete().eq('id', id);
  if (error) throw error;
}

/** Insert a portfolio_images row. */
export async function adminInsertImage(imageData) {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('portfolio_images')
    .insert([imageData])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── CATEGORIES (shared list for the admin portal and the client site) ─────


/** Fetch the shared category list, ordered for display. */
export async function adminFetchCategories() {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('categories')
    .select('id, value, label, sort_order, is_active')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Insert a category into the shared list. */
export async function adminInsertCategory(category) {
  const client = await getSupabaseClient();
  const payload = {
    ...category,
    is_active: category.is_active !== undefined ? !!category.is_active : true
  };
  const { data, error } = await client
    .from('categories')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Delete a category from the shared list by its value. */
export async function adminDeleteCategory(value) {
  const client = await getSupabaseClient();
  const { error } = await client.from('categories').delete().eq('value', value);
  if (error) throw error;
}

/** Rename a category (update its label) by its value. */
export async function adminUpdateCategory(value, updates) {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('categories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('value', value)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Soft-delete / reactivate a category by flipping its is_active flag. */
export async function adminToggleCategoryActive(value, isActive) {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('categories')
    .update({ is_active: !!isActive, updated_at: new Date().toISOString() })
    .eq('value', value)
    .select('id, value, label, sort_order, is_active')
    .single();
  if (error) throw error;
  return data;
}

// ─── SERVICES (shared admin <-> client list for Capabilities section) ─────

/** Fetch all services (admin view, includes inactive). */
export async function adminFetchServices() {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('services')
    .select('id, category_name, description, sort_order, is_active, items')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Insert a new service. */
export async function adminInsertService(service) {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('services')
    .insert([service])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Update a service by ID. */
export async function adminUpdateService(id, updates) {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('services')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Delete a service by ID. */
export async function adminDeleteService(id) {
  const client = await getSupabaseClient();
  const { error } = await client.from('services').delete().eq('id', id);
  if (error) throw error;
}

/** Soft-delete / reactivate a service by flipping its is_active flag. */
export async function adminToggleServiceActive(id, isActive) {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('services')
    .update({ is_active: !!isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, category_name, is_active')
    .single();
  if (error) throw error;
  return data;
}

// ─── STORAGE ────────────────────────────────────────────────────────────────

/** Upload media file (image or video) to Supabase Storage. Returns { path, publicUrl }. */
export async function uploadPortfolioMedia(file, itemSlug) {
  const client = await getSupabaseClient();
  const config = getConfig();
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${itemSlug}/${Date.now()}.${ext}`;

  const { data, error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: file.type });

  if (error) throw error;

  const publicUrl = `${config.supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${data.path}`;
  return { path: data.path, publicUrl };
}

/** Backward-compatible alias for uploadPortfolioMedia. */
export const uploadPortfolioImage = uploadPortfolioMedia;

/** Remove a file from Storage by its path. */
export async function deleteStorageImage(storagePath) {
  const client = await getSupabaseClient();
  const { error } = await client.storage.from(STORAGE_BUCKET).remove([storagePath]);
  if (error) console.warn('Storage delete failed:', error.message);
}

// ─── OFFERS (persisted in site_settings.offers_json + localStorage mirror) ──

/** Fetch offers array from Supabase, with localStorage fallback. */
export async function adminFetchOffers() {
  try {
    const client = await getSupabaseClient();
    const { data, error } = await client.from('site_settings').select('offers_json').single();
    if (!error && data && data.offers_json) {
      const offers = Array.isArray(data.offers_json) ? data.offers_json : JSON.parse(data.offers_json);
      // Sync to localStorage so client pages pick it up instantly
      localStorage.setItem('aayat_offers', JSON.stringify(offers));
      return offers;
    }
  } catch (e) {
    // fall through to localStorage
  }
  const stored = localStorage.getItem('aayat_offers');
  return stored ? JSON.parse(stored) : [];
}

/** Persist offers array to Supabase AND localStorage. */
export async function adminSaveOffers(offers) {
  // Always write to localStorage first (instant client-side sync)
  localStorage.setItem('aayat_offers', JSON.stringify(offers));

  try {
    const client = await getSupabaseClient();
    await client
      .from('site_settings')
      .update({ offers_json: offers, updated_at: new Date().toISOString() })
      .eq('is_singleton', true);
  } catch (e) {
    console.warn('Offers not synced to Supabase yet (column may be missing):', e.message);
  }
}
