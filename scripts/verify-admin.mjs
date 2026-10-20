/**
 * scripts/verify-admin.mjs
 * Executes the admin dashboard module against a minimal DOM shim and a stubbed
 * Supabase, to prove the portal behaves correctly.
 *
 * It checks:
 *   - the guard blocks access without a session
 *   - the guard blocks access for a signed-in non-admin
 *   - the guard allows an admin through
 *   - the category list comes from the shared table, not a local copy
 *   - a failed write is reported instead of silently pretending to succeed
 *
 * Run: node scripts/verify-admin.mjs
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
    this._parent = null;
    this._value = '';
  }
  get options() { return this.children; }
  get value() { return this._value; }
  set value(v) { this._value = v; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get innerHTML() { return this._text; }
  set innerHTML(v) { this._text = String(v); this.children = []; }
  get parent() { return this._parent; }
  set parent(p) { this._parent = p; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  remove() {
    const p = this.parent;
    if (p) p.children = p.children.filter(x => x !== this);
  }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  dispatch(t, event = {}) {
    const evt = { target: this, type: t, preventDefault() {}, stopPropagation() {}, ...event };
    let n = this;
    while (n) { (n.listeners[t] || []).forEach(fn => fn(evt)); n = n.parent; }
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
    const matches = (el) => {
      if (sel.startsWith('.')) return el.className.split(/\s+/).includes(sel.slice(1));
      if (sel.startsWith('#')) return el.getAttribute('id') === sel.slice(1);
      if (/^[a-z]+$/i.test(sel)) return el.tagName === sel.toUpperCase();
      // "tag[attr=value]" and "[attr=value]"
      const attrMatch = sel.match(/^(?:([a-z]+))?\[([^\]=]+)=["']?([^\]"']+)["']?\]$/i);
      if (attrMatch) {
        const [, tag, attr, value] = attrMatch;
        if (tag && el.tagName !== tag.toUpperCase()) return false;
        return el.getAttribute(attr) === value;
      }
      return false;
    };
    const walk = (node) => node.children.forEach(c => {
      if (matches(c)) out.push(c);
      walk(c);
    });
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  focus() {}
  reset() { this._text = ''; this.children = []; }
}

function makeDoc() {
  const doc = {
    _byId: {}, _classes: {}, _roots: [], _domReady: [],
    createElement(tag) { return new El(tag); },
    getElementById(id) { return this._byId[id] || null; },
    querySelector(sel) {
      // A compound descendant selector, e.g. "#product-form button[type=submit]".
      if (/\s/.test(sel)) {
        const parts = sel.split(/\s+/);
        const last = parts[parts.length - 1];
        const scope = parts.length > 1 ? this._byId[parts[0].slice(1)] : this;
        if (!scope) return null;
        return scope.querySelectorAll(last)[0] || null;
      }
      if (sel.startsWith('#')) return this._byId[sel.slice(1)] || null;
      if (sel.startsWith('.')) {
        const d = this._classes[sel.slice(1)];
        if (d) return d;
        return this.querySelectorAll(sel)[0] || null;
      }
      return this.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll(sel) {
      const out = [];
      const matches = el => sel.startsWith('.') && el.className.split(/\s+/).includes(sel.slice(1));
      const walk = n => n.children.forEach(c => { if (matches(c)) out.push(c); walk(c); });
      this._roots.forEach(walk);
      return out;
    },
    addEventListener(t, fn) { if (t === 'DOMContentLoaded') this._domReady.push(fn); },
    head: new El('head'),
    body: new El('body')
  };
  doc.head.parent = doc.body;
  doc.body.parent = null;
  return doc;
}

function collectText(node) {
  let out = node._text || '';
  node.children.forEach(c => { out += ' ' + collectText(c); });
  return out.trim();
}

// ── Supabase stub ──────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;

const state = {
  session: null,
  isAdmin: false,
  categories: [
    { value: 'ads', label: 'Ad Creatives', sort_order: 1 },
    { value: 'posters', label: 'Poster Design', sort_order: 2 }
  ],
  items: [],
  lastInsert: {},
  failNextWrite: false
};

globalThis.fetch = async (url, options = {}) => {
  const u = new URL(url);
  const method = (options.method || 'GET').toUpperCase();

  if (u.pathname.endsWith('/auth/v1/token')) {
    if (u.searchParams.get('grant_type') === 'password') {
      const body = JSON.parse(options.body || '{}');
      if (body.email === EMAIL && body.password === PASSWORD) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'test-token' }) };
      }
      return { ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) };
    }
  }

  if (u.pathname.endsWith('/rest/v1/rpc/is_admin')) {
    return { ok: true, status: 200, json: async () => state.isAdmin };
  }

  if (u.pathname.endsWith('/rest/v1/categories')) {
    if (method !== 'GET') {
      if (state.failNextWrite) {
        return { ok: false, status: 500, statusText: 'error', json: async () => ({ message: 'boom' }) };
      }
      return { ok: true, status: 201, json: async () => [] };
    }
    return { ok: true, status: 200, json: async () => state.categories };
  }

  if (u.pathname.endsWith('/rest/v1/portfolio_items')) {
    if (method !== 'GET') {
      if (state.failNextWrite) {
        return { ok: false, status: 500, statusText: 'error', json: async () => ({ message: 'boom' }) };
      }
      return { ok: true, status: 201, json: async () => [] };
    }
    return { ok: true, status: 200, json: async () => state.items };
  }

  if (u.pathname.endsWith('/rest/v1/site_settings')) {
    return { ok: true, status: 200, json: async () => ({ offers_json: [] }) };
  }

  return realFetch(url, options);
};

// The SDK normally comes from /js/lib/supabase.js. The dashboard module only
// needs a client object with the auth surface, so provide a minimal one.
globalThis.window = {
  supabase: {
    createClient() {
      return {
        auth: {
          async getSession() { return { data: { session: state.session } }; },
          async signInWithPassword() { return { data: { session: state.session }, error: null }; },
          async signOut() { state.session = null; }
        },
        from(table) {
          const builder = {
            select() { return this; },
            order() { return this; },
            insert() { return this; },
            update() { return this; },
            delete() { return this; },
            eq() { return this; },
            limit: async () => ({ data: [], error: null }),
            single: async () => (
              state.failNextWrite
                ? { data: null, error: { message: 'simulated write failure' } }
                : { data: { id: 'new-item', ...state.lastInsert }, error: null }
            )
          };
          // A query without .single() resolves the same way.
          builder.then = (resolve) => resolve(
            state.failNextWrite
              ? { data: null, error: { message: 'simulated write failure' } }
              : { data: [], error: null }
          );
          return builder;
        },
        storage: {
          from() { return { upload: async () => ({ data: null, error: null }) }; }
        },
        rpc: async (fn) => ({ data: fn === 'is_admin' ? state.isAdmin : null, error: null })
      };
    }
  },
  location: { href: 'http://localhost:3000/admin/dashboard.html', hostname: 'localhost' }
};

const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear()
};
globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.URLSearchParams = URLSearchParams;

// ── Load the dashboard module ──────────────────────────────────────────────
const dashModule = new URL('../site/js/admin/dashboard.js', import.meta.url).href;
let run = 0;

async function loadDashboard() {
  const doc = makeDoc();
  globalThis.document = doc;

  const ids = [
    'admin-status-bar', 'products-table-body', 'products-count', 'offers-table-body',
    'offers-count', 'product-form', 'prod-title', 'prod-brand', 'prod-category',
    'prod-desc', 'prod-offer', 'prod-image', 'image-preview', 'image-placeholder',
    'new-cat-input', 'new-cat-error', 'new-category-box', 'btn-show-add-cat',
    'btn-remove-cat', 'btn-save-new-cat', 'btn-cancel-new-cat', 'custom-cat-manager',
    'offer-form', 'offer-title', 'offer-code', 'offer-discount', 'offer-expiry',
    'offer-modal', 'product-modal', 'add-product-btn', 'add-offer-btn',
    'close-prod-modal', 'cancel-prod-btn', 'close-offer-modal', 'cancel-offer-btn',
    'modal-prod-title', 'logout-btn', 'filter-status'
  ];
  ids.forEach(id => {
    const el = doc.createElement('div');
    el.setAttribute('id', id);
    doc._byId[id] = el;
    doc._roots.push(el);
  });

  const redirect = { href: null };
  globalThis.window.location = {
    get href() { return redirect.href; },
    set href(v) { redirect.href = v; },
    hostname: 'localhost'
  };

  await import(`${dashModule}?run=${run++}`);
  for (const h of doc._domReady) await h();
  await new Promise(r => setTimeout(r, 50));

  return { doc, redirect };
}

// ── Checks ─────────────────────────────────────────────────────────────────
const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// 1. No session -> the guard redirects to the login page.
{
  state.session = null;
  state.isAdmin = false;
  const { redirect } = await loadDashboard();
  check('without a session the portal redirects to the login page',
    redirect.href === '/admin/', String(redirect.href));
}

// 2. A session that is not an admin -> still redirected.
{
  state.session = { access_token: 'x' };
  state.isAdmin = false;
  const { redirect } = await loadDashboard();
  check('a signed-in non-admin is redirected away',
    redirect.href === '/admin/', String(redirect.href));
}

// 3. An admin -> allowed in.
{
  state.session = { access_token: 'x' };
  state.isAdmin = true;
  const { redirect } = await loadDashboard();
  check('an admin passes the guard', redirect.href === null, String(redirect.href));
}

// 4. The category dropdown and the manager use the shared list.
{
  state.session = { access_token: 'x' };
  state.isAdmin = true;
  const { doc } = await loadDashboard();

  const sel = doc.getElementById('prod-category');
  const options = sel.children.map(o => o.textContent);
  check('the category dropdown lists the shared categories',
    options.includes('Ad Creatives') && options.includes('Poster Design'), options.join('|'));

  const manager = doc.getElementById('custom-cat-manager');
  const managerText = collectText(manager);
  check('the category manager lists the shared categories',
    managerText.includes('Ad Creatives') && managerText.includes('Poster Design'),
    managerText.slice(0, 120));

  const removeButtons = manager.querySelectorAll('button');
  check('every shared category has a remove control', removeButtons.length === 3, `${removeButtons.length} button(s)`);
}

// 5. A failed write is reported, not silently swallowed.
{
  state.session = { access_token: 'x' };
  state.isAdmin = true;
  state.failNextWrite = true;

  const { doc } = await loadDashboard();
  const form = doc.getElementById('product-form');
  doc.getElementById('prod-title').value = 'A Test Design';
  doc.getElementById('prod-brand').value = 'Test Brand';
  doc.getElementById('prod-desc').value = 'A description that is long enough to pass the checks.';

  // The form handler looks up the submit button the way the real markup has it.
  const submitBtn = doc.createElement('button');
  submitBtn.setAttribute('type', 'submit');
  form.appendChild(submitBtn);

  form.dispatch('submit');
  await new Promise(r => setTimeout(r, 80));

  const statusText = collectText(doc.getElementById('admin-status-bar'));
  check('a failed save is reported to the admin',
    statusText.includes('NOT on the client site'), statusText.slice(0, 140));
  state.failNextWrite = false;
}

const failed = results.filter(r => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  failed.forEach(f => console.log(' - ' + f.name + (f.detail ? ' — ' + f.detail : '')));
  process.exitCode = 1;
}
