/**
 * scripts/verify-sync.js
 * End-to-end check of the admin portal -> client site data path.
 *
 * It signs in as the real admin, writes through the same Supabase calls the
 * portal makes, then reads back through the same public REST calls the client
 * site makes — including the anonymous reader.
 *
 * Run: node scripts/verify-sync.js
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readEnv(name) {
  if (process.env[name]) return process.env[name].trim();
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return '';
  const line = readFileSync(envPath, 'utf8').split('\n').find(l => l.trim().startsWith(`${name}=`));
  if (!line) return '';
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
}

const URL_BASE = readEnv('SUPABASE_URL');
const ANON_KEY = readEnv('SUPABASE_PUBLISHABLE_KEY');
const EMAIL = readEnv('ADMIN_EMAIL');
const PASSWORD = readEnv('ADMIN_PASSWORD');

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function signIn() {
  const resp = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  if (!resp.ok) throw new Error(`sign-in failed: ${resp.status} ${await resp.text()}`);
  const body = await resp.json();
  return body.access_token;
}

async function rest(token, path, options = {}) {
  const resp = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token || ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: resp.status, data };
}

const stamp = Date.now().toString(36);
const testCategoryValue = `verify_${stamp}`;
const testCategoryLabel = `Verification ${stamp}`;
const testSlug = `verify-item-${stamp}`;

const token = await signIn();
check('admin signs in with Supabase Auth', !!token);

const isAdmin = await rest(token, 'rpc/is_admin');
check('is_admin() returns true for the signed-in admin', isAdmin.data === true, JSON.stringify(isAdmin.data));

// 1. An anonymous reader must NOT be able to write.
const anonWrite = await rest(null, 'categories', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ value: `anon_${stamp}`, label: 'Should not exist', sort_order: 99 })
});
check('anonymous insert into categories is rejected', anonWrite.status >= 400, `status ${anonWrite.status}`);

const anonItemWrite = await rest(null, 'portfolio_items', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({
    slug: `anon-${stamp}`,
    title: 'Should not exist',
    client_brand: 'Nobody',
    category: 'ads',
    description: 'This row must never be written by an anonymous caller.',
    published: true
  })
});
check('anonymous insert into portfolio_items is rejected', anonItemWrite.status >= 400, `status ${anonItemWrite.status}`);

const anonSettingsWrite = await rest(null, 'site_settings', {
  method: 'PATCH',
  body: JSON.stringify({ offers_json: [] })
});
check('anonymous update of site_settings is rejected', anonSettingsWrite.status >= 400, `status ${anonSettingsWrite.status}`);

// 2. The admin writes a category the way the portal does.
const catInsert = await rest(token, 'categories', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ value: testCategoryValue, label: testCategoryLabel, sort_order: 90 })
});
check('admin inserts a shared category', catInsert.status === 201 && catInsert.data?.[0]?.value === testCategoryValue, `status ${catInsert.status}`);

// 3. The anonymous client reads the new category.
const catRead = await rest(null, 'categories?select=value,label&order=sort_order.asc');
const foundCategory = Array.isArray(catRead.data) && catReadReadIncludes(catRead.data, testCategoryValue);
function catReadReadIncludes(list, value) {
  return list.some(c => c.value === value);
}
check('anonymous client reads the new category', foundCategory, `status ${catRead.status}`);

// 4. The admin writes a portfolio item in that category.
const itemInsert = await rest(token, 'portfolio_items', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({
    slug: testSlug,
    title: 'Verification Design',
    client_brand: '[SAMPLE] Verification Studio',
    category: testCategoryValue,
    description: 'A temporary row used to verify the admin to client data path end to end.',
    alt_text: 'Verification design placeholder',
    offer_tag: 'Verify Tag',
    featured: true,
    published: true
  })
});
const insertedItem = Array.isArray(itemInsert.data) ? itemInsert.data[0] : null;
check('admin inserts a portfolio item', itemInsert.status === 201 && !!insertedItem, `status ${itemInsert.status}`);

// 5. The anonymous client reads the published item.
const itemsRead = await rest(null,
  'portfolio_items?select=id,slug,title,category,offer_tag,published,portfolio_images(id,storage_path)&published=eq.true');
const readItem = Array.isArray(itemsRead.data) ? itemsRead.data.find(i => i.slug === testSlug) : null;
check('anonymous client reads the published item', !!readItem, `status ${itemsRead.status}`);
check('the item keeps the admin-chosen category', readItem?.category === testCategoryValue, readItem?.category);
check('the item keeps the admin-chosen offer tag', readItem?.offer_tag === 'Verify Tag', readItem?.offer_tag);

// 6. An unpublished item must not reach the client.
const draftInsert = await rest(token, 'portfolio_items', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({
    slug: `${testSlug}-draft`,
    title: 'Verification Draft',
    client_brand: '[SAMPLE] Verification Studio',
    category: testCategoryValue,
    description: 'A temporary draft row used to verify that unpublished work stays private.',
    published: false
  })
});
const draftId = Array.isArray(draftInsert.data) ? draftInsert.data[0]?.id : null;
check('admin inserts an unpublished draft', draftInsert.status === 201 && !!draftId, `status ${draftInsert.status}`);

const itemsRead2 = await rest(null, 'portfolio_items?select=slug&published=eq.true');
const draftLeaked = Array.isArray(itemsRead2.data) && itemsRead2.data.some(i => i.slug === `${testSlug}-draft`);
check('the unpublished draft is hidden from the client', !draftLeaked);

// 7. The admin deletes the category the item still uses — the DB allows it,
//    so verify the category list updates for the client.
const catDelete = await rest(token, `categories?value=eq.${encodeURIComponent(testCategoryValue)}`, { method: 'DELETE' });
check('admin deletes the shared category', catDelete.status === 204, `status ${catDelete.status}`);

const catRead2 = await rest(null, 'categories?select=value');
const categoryGone = Array.isArray(catRead2.data) && !catRead2.data.some(c => c.value === testCategoryValue);
check('the client no longer sees the deleted category', categoryGone);

// 8. Clean up the temporary rows.
if (draftId) await rest(token, `portfolio_items?id=eq.${draftId}`, { method: 'DELETE' });
if (insertedItem?.id) await rest(token, `portfolio_items?id=eq.${insertedItem.id}`, { method: 'DELETE' });

const after = await rest(null, 'portfolio_items?select=slug&published=eq.true');
const leftover = Array.isArray(after.data) && after.data.some(i => i.slug.startsWith('verify-item-'));
check('verification rows are cleaned up', !leftover);

// 9. Storage: the portal uploads the design image to the portfolio bucket.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const storagePath = `verify/${stamp}.png`;

const anonUpload = await fetch(`${URL_BASE}/storage/v1/object/portfolio/${storagePath}`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'image/png' },
  body: png
});
check('anonymous storage upload is rejected', anonUpload.status >= 400, `status ${anonUpload.status}`);

const adminUpload = await fetch(`${URL_BASE}/storage/v1/object/portfolio/${storagePath}`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
  body: png
});
check('admin storage upload succeeds', adminUpload.status === 200, `status ${adminUpload.status}`);

const publicRead = await fetch(`${URL_BASE}/storage/v1/object/public/portfolio/${storagePath}`);
check('the uploaded file is publicly readable', publicRead.status === 200, `status ${publicRead.status}`);

const adminDelete = await fetch(`${URL_BASE}/storage/v1/object/portfolio/${storagePath}`, {
  method: 'DELETE',
  headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` }
});
check('admin storage delete succeeds', adminDelete.status === 200, `status ${adminDelete.status}`);

// The public URL is CDN-cached, so the cache is busted before checking.
const publicAfter = await fetch(`${URL_BASE}/storage/v1/object/public/portfolio/${storagePath}?cb=${Date.now()}`);
check('the file is gone after deletion', publicAfter.status >= 400, `status ${publicAfter.status}`);

const failed = results.filter(r => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  console.log('Failed checks:');
  failed.forEach(f => console.log(' - ' + f.name + (f.detail ? ' — ' + f.detail : '')));
  process.exitCode = 1;
}
