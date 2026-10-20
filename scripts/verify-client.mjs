/**
 * scripts/verify-client.mjs
 * Executes the browser modules against a minimal DOM shim and a stubbed
 * Supabase, to prove the client site renders what the admin published.
 *
 * It checks:
 *   - the work page builds its filter bar from the shared category list
 *   - an admin-added category appears as a filter and filters the grid
 *   - the home page shows the featured designs
 *   - an empty database renders the empty state, not invented projects
 *
 * Run: node scripts/verify-client.mjs
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

// ── Minimal DOM ────────────────────────────────────────────────────────────
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.dataset = {};
    this.listeners = {};
    this._text = '';
    this.className = '';
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this.children = []; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }
  remove() {
    const p = this.parent;
    if (p) p.children = p.children.filter(c => c !== this);
  }
  get parent() { return this._parent || null; }
  set parent(p) { this._parent = p; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatch(type, event = {}) {
    // Events bubble, so a delegated listener on an ancestor sees them.
    const evt = { target: this, type, ...event };
    let node = this;
    while (node) {
      (node.listeners[type] || []).forEach(fn => fn(evt));
      node = node.parent;
    }
  }
  click() { this.dispatch('click'); }
  closest(sel) {
    let n = this;
    while (n) {
      if (sel.startsWith('.') && n.className.split(/\s+/).includes(sel.slice(1))) return n;
      n = n.parent;
    }
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (node) => {
      node.children.forEach(c => {
        if (sel.startsWith('.') && c.className.split(/\s+/).includes(sel.slice(1))) out.push(c);
        if (sel.startsWith('[') && sel.includes('=')) {
          const m = sel.match(/^\[([^\]=]+)=([^\]]+)\]$/);
          if (m && c.getAttribute(m[1]) === m[2].replace(/^["']|["']$/g, '')) out.push(c);
        }
        walk(c);
      });
    };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  get innerHTML() { return this._text; }
  set innerHTML(v) { this._text = String(v); this.children = []; }
}

function makeDoc() {
  const doc = {
    _byId: {},
    _classes: {},
    _roots: [],
    createElement(tag) { const e = new El(tag); e.parent = null; return e; },
    getElementById(id) { return this._byId[id] || null; },
    querySelector(sel) {
      if (sel.startsWith('#')) return this._byId[sel.slice(1)] || null;
      if (sel.startsWith('.')) {
        const direct = this._classes[sel.slice(1)];
        if (direct) return direct;
        return this.querySelectorAll(sel)[0] || null;
      }
      return null;
    },
    querySelectorAll(sel) {
      const out = [];
      const matches = (el) => {
        if (sel.startsWith('.')) return el.className.split(/\s+/).includes(sel.slice(1));
        if (sel.startsWith('#')) return el.getAttribute('id') === sel.slice(1);
        return false;
      };
      const walk = (node) => {
        node.children.forEach(c => {
          if (matches(c)) out.push(c);
          walk(c);
        });
      };
      this._roots.forEach(walk);
      return out;
    },
    addEventListener() {},
    title: ''
  };
  return doc;
}

function register(doc, id) {
  const el = doc.createElement('div');
  el.setAttribute('id', id);
  doc._byId[id] = el;
  doc._roots.push(el);
  return el;
}

function registerClass(doc, cls, tag = 'nav') {
  const el = doc.createElement(tag);
  el.className = cls;
  doc._classes[cls] = el;
  doc._roots.push(el);
  return el;
}

function collectText(node) {
  let out = node._text || '';
  node.children.forEach(c => { out += ' ' + collectText(c); });
  return out.trim();
}

// ── Supabase stub ──────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;

const state = {
  categories: [],
  items: []
};

function restStub(path) {
  const [table, query = ''] = path.split('?');
  if (table === 'categories') {
    return state.categories.map(c => ({
      value: c.value, label: c.label, sort_order: c.sort_order
    }));
  }
  if (table === 'portfolio_items') {
    const publishedOnly = /published=eq\.true/.test(query);
    const slugMatch = query.match(/slug=eq\.([^&]+)/);
    return state.items
      .filter(i => (publishedOnly ? i.published : true))
      .filter(i => (slugMatch ? i.slug === decodeURIComponent(slugMatch[1]) : true))
      .map(i => ({
        id: i.id, slug: i.slug, title: i.title, client_brand: i.client_brand,
        category: i.category, description: i.description, alt_text: i.alt_text,
        offer_tag: i.offer_tag, featured: i.featured, published: i.published,
        sort_order: i.sort_order, created_at: i.created_at,
        portfolio_images: i.portfolio_images || []
      }));
  }
  return [];
}

globalThis.fetch = async (url, options = {}) => {
  const u = new URL(url);
  if (u.pathname.endsWith('/rest/v1/categories')) {
    return { ok: true, status: 200, json: async () => restStub('categories') };
  }
  if (u.pathname.endsWith('/rest/v1/portfolio_items')) {
    return { ok: true, status: 200, json: async () => restStub('portfolio_items' + (u.search ? '?' + u.search.slice(1) : '')) };
  }
  if (u.pathname.endsWith('/rest/v1/site_settings')) {
    // The live row, so the offer banner path is exercised against real data.
    return realFetch(url, options);
  }
  throw new Error('Unexpected fetch: ' + url);
};

const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear()
};

function makeLocation(search = '') {
  const loc = {
    hostname: 'localhost',
    search,
    href: 'http://localhost:3000/work/' + search,
    toString() { return this.href; }
  };
  return loc;
}

globalThis.window = {
  location: makeLocation(),
  history: { pushState() {} },
  addEventListener() {}
};
globalThis.URLSearchParams = URLSearchParams;

// ── Load the page module with a fresh DOM ─────────────────────────────────
async function loadPage(moduleUrl, setup) {
  const doc = makeDoc();
  globalThis.document = doc;
  setup(doc);

  // The modules read the config on import.
  await import(moduleUrl);
  // Fire the DOMContentLoaded handler the modules registered.
  const handlers = doc._domReady || [];
  for (const h of handlers) await h();
  // Let the page modules finish their own async renders.
  await new Promise(resolve => setTimeout(resolve, 50));
  return doc;
}

// Patch makeDoc to record DOMContentLoaded handlers.
const origMakeDoc = makeDoc;
makeDoc = function () {
  const doc = origMakeDoc();
  doc._domReady = [];
  doc.addEventListener = (type, fn) => { if (type === 'DOMContentLoaded') doc._domReady.push(fn); };
  return doc;
};

// ── Checks ─────────────────────────────────────────────────────────────────
const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// The work page module caches the fetch on import, so each scenario needs a
// fresh module instance — use a cache-busting query.
const workModule = new URL('../site/js/pages/work.js', import.meta.url).href;
let moduleRun = 0;

async function runWorkPage(items, categories, search = '') {
  state.items = items;
  state.categories = categories;
  window.location = makeLocation(search);

  const doc = await loadPage(`${workModule}?run=${moduleRun++}`, (d) => {
    const container = register(d, 'portfolio-container');
    container.className = 'portfolio-grid';
    register(d, 'filter-status');
    const bar = registerClass(d, 'filter-bar');
    const allBtn = d.createElement('button');
    allBtn.className = 'filter-btn';
    allBtn.setAttribute('data-category', 'all');
    allBtn.textContent = 'All Projects';
    bar.appendChild(allBtn);
  });
  return doc;
}

const CATEGORIES = [
  { value: 'ads', label: 'Ad Creatives', sort_order: 1 },
  { value: 'posters', label: 'Poster Design', sort_order: 2 },
  { value: 'social_media', label: 'Social Media Design', sort_order: 3 }
];

// 1. The filter bar is built from the shared category list.
{
  const doc = await runWorkPage([], CATEGORIES);
  const bar = doc.querySelector('.filter-bar');
  const buttons = bar.querySelectorAll('.filter-btn');
  const labels = buttons.map(b => b.textContent);
  check('the filter bar is built from the shared category list',
    labels.join('|') === 'All Projects|Ad Creatives|Poster Design|Social Media Design',
    labels.join('|'));
}

// 2. A category added in the admin portal shows up as a filter.
{
  const withNew = [...CATEGORIES, { value: 'brand_identity', label: 'Brand Identity', sort_order: 4 }];
  const doc = await runWorkPage([], withNew);
  const bar = doc.querySelector('.filter-bar');
  const labels = bar.querySelectorAll('.filter-btn').map(b => b.textContent);
  check('an admin-added category appears as a filter button', labels.includes('Brand Identity'), labels.join('|'));
}

// 3. Clicking a filter shows only the designs in that category.
{
  const items = [
    { id: '1', slug: 'a', title: 'Ad One', client_brand: 'X', category: 'ads', description: 'd', alt_text: 'a', offer_tag: null, featured: true, published: true, sort_order: 1, portfolio_images: [] },
    { id: '2', slug: 'b', title: 'Poster One', client_brand: 'Y', category: 'posters', description: 'd', alt_text: 'b', offer_tag: 'Deal', featured: true, published: true, sort_order: 2, portfolio_images: [] }
  ];
  const doc = await runWorkPage(items, CATEGORIES);
  const bar = doc.querySelector('.filter-bar');
  const container = doc.getElementById('portfolio-container');

  const postersBtn = bar.querySelectorAll('.filter-btn').find(b => b.getAttribute('data-category') === 'posters');
  postersBtn.click();

  const text = collectText(container);
  check('clicking a filter shows only that category', text.includes('Poster One') && !text.includes('Ad One'), text.slice(0, 120));
  check('the active filter is marked for assistive technology',
    postersBtn.getAttribute('aria-pressed') === 'true', postersBtn.getAttribute('aria-pressed'));
  check('the offer tag from the database is rendered', text.includes('Deal'), text.slice(0, 120));
}

// 4. An empty database renders the empty state, not invented projects.
{
  const doc = await runWorkPage([], CATEGORIES);
  const container = doc.getElementById('portfolio-container');
  const text = collectText(container);
  check('an empty database renders the empty state',
    text.includes('No projects found') && !text.includes('Lumina') && !text.includes('Velvet'),
    text.slice(0, 120));
}

// 5. The home page shows the featured designs from the database.
{
  state.items = [
    { id: '1', slug: 'a', title: 'Featured Ad', client_brand: 'X', category: 'ads', description: 'd', alt_text: 'a', offer_tag: null, featured: true, published: true, sort_order: 1, portfolio_images: [] },
    { id: '2', slug: 'b', title: 'Hidden Draft', client_brand: 'Y', category: 'ads', description: 'd', alt_text: 'b', offer_tag: null, featured: true, published: false, sort_order: 2, portfolio_images: [] }
  ];
  state.categories = CATEGORIES;

  const homeModule = new URL('../site/js/pages/home.js', import.meta.url).href;
  const doc = await loadPage(`${homeModule}?run=${moduleRun++}`, (d) => {
    register(d, 'featured-portfolio-grid');
    register(d, 'top-offer-banner');
    register(d, 'offer-banner-text');
  });

  const grid = doc.getElementById('featured-portfolio-grid');
  const text = collectText(grid);
  check('the home page shows the featured design', text.includes('Featured Ad'), text.slice(0, 120));
  check('the home page uses the shared category label', text.includes('Ad Creatives'), text.slice(0, 120));
  check('the home page hides the unpublished design', !text.includes('Hidden Draft'), text.slice(0, 120));
}

// 6. Against the live database: the client modules read what is really there.
{
  const liveCategories = await (await realFetch(`${URL_BASE}/rest/v1/categories?select=value,label&order=sort_order.asc`, {
    headers: { apikey: ANON_KEY }
  })).json();

  const liveItems = await (await realFetch(`${URL_BASE}/rest/v1/portfolio_items?select=slug&published=eq.true`, {
    headers: { apikey: ANON_KEY }
  })).json();

  const doc = await runWorkPage([], liveCategories);
  const labels = doc.querySelector('.filter-bar').querySelectorAll('.filter-btn').map(b => b.textContent);
  const expected = ['All Projects', ...liveCategories.map(c => c.label)];
  check('the live category list renders on the work page',
    labels.join('|') === expected.join('|'), labels.join('|'));

  const container = doc.getElementById('portfolio-container');
  const text = collectText(container);
  check('the live database is empty, so no invented projects are shown',
    !text.includes('Lumina') && !text.includes('Velvet') && !text.includes('Artisan'),
    text.slice(0, 120));
  check('the live database currently has no published designs',
    Array.isArray(liveItems) && liveItems.length === 0, `${liveItems.length} row(s)`);
}

// 7. The offer banner reads the live site_settings row.
{
  const homeModule = new URL('../site/js/pages/home.js', import.meta.url).href;
  const doc = await loadPage(`${homeModule}?run=${moduleRun++}`, (d) => {
    register(d, 'featured-portfolio-grid');
    const banner = register(d, 'top-offer-banner');
    banner.style = {};
    register(d, 'offer-banner-text');
  });

  await new Promise(r => setTimeout(r, 120));

  const liveSettings = await (await realFetch(`${URL_BASE}/rest/v1/site_settings?select=offers_json`, {
    headers: { apikey: ANON_KEY }
  })).json();

  const liveOffers = Array.isArray(liveSettings) && liveSettings[0] ? liveSettings[0].offers_json : null;
  const bannerText = collectText(doc.getElementById('offer-banner-text'));

  check('the live offer row is read as an array', Array.isArray(liveOffers), typeof liveOffers);
  if (Array.isArray(liveOffers) && liveOffers.length > 0) {
    const top = liveOffers[0];
    check('the offer banner shows the live offer', bannerText.includes(top.title), bannerText.slice(0, 120));
  } else {
    check('the offer banner stays hidden when there is no live offer',
      bannerText === '', bannerText.slice(0, 120));
  }
}

const failed = results.filter(r => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  failed.forEach(f => console.log(' - ' + f.name + (f.detail ? ' — ' + f.detail : '')));
  process.exitCode = 1;
}
