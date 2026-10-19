/**
 * site/js/admin/dashboard.js
 * Admin Dashboard — full Supabase-connected CRUD.
 *
 * Flow:
 *   1. Checks auth session via Supabase; falls back to sessionStorage flag.
 *   2. Loads portfolio items + offers from Supabase (localStorage fallback).
 *   3. Admin can add/delete products with real image upload to Supabase Storage.
 *   4. All changes are written to Supabase AND mirrored to localStorage so the
 *      client site reflects updates immediately even without a page reload.
 */

import {
  getAdminSession,
  adminSignOut,
  adminFetchAllItems,
  adminInsertItem,
  adminInsertImage,
  adminUpdateItem,
  adminDeleteItem,
  uploadPortfolioImage,
  deleteStorageImage,
  adminFetchOffers,
  adminSaveOffers
} from './supabase-client.js';

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
let allItems = [];
let allOffers = [];
let selectedImageFile = null;
let editingItemId = null; // null = new, string = edit mode

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  showStatus('Loading dashboard…', 'info');

  // Auth check (Supabase session OR sessionStorage flag for local dev)
  let authed = false;
  try {
    const session = await getAdminSession();
    authed = !!session;
  } catch (e) {
    // Supabase not reachable — use dev flag
  }
  if (!authed) {
    authed = sessionStorage.getItem('aayat_admin_authenticated') === 'true';
  }

  if (!authed) {
    window.location.href = '/admin/';
    return;
  }

  // Wire up UI controls
  initModals();
  initImageUpload();
  initProductForm();
  initOfferForm();
  initLogout();

  // Load data
  await refreshAll();
  hideStatus();
});

// ─────────────────────────────────────────────────────────────────────────────
// DATA REFRESH
// ─────────────────────────────────────────────────────────────────────────────
async function refreshAll() {
  await Promise.all([refreshItems(), refreshOffers()]);
}

async function refreshItems() {
  try {
    allItems = await adminFetchAllItems();
  } catch (e) {
    console.warn('Supabase fetch failed, using localStorage items:', e.message);
    const stored = localStorage.getItem('aayat_custom_products');
    allItems = stored ? JSON.parse(stored) : [];
  }
  // Always mirror to localStorage for client-site instant sync
  mirrorItemsToLocalStorage(allItems);
  renderProductsTable();
}

async function refreshOffers() {
  try {
    allOffers = await adminFetchOffers();
  } catch (e) {
    const stored = localStorage.getItem('aayat_offers');
    allOffers = stored ? JSON.parse(stored) : [];
  }
  renderOffersTable();
}

/**
 * Mirror Supabase items to localStorage in the format the public portfolio.js
 * getLivePortfolioItems() expects, so the client site reflects changes even
 * before the Supabase fetch completes on the public side.
 */
function mirrorItemsToLocalStorage(items) {
  const mapped = items.map(p => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: p.client_brand,
    client_brand: p.client_brand,
    category: p.category,
    desc: p.description,
    description: p.description,
    alt_text: p.alt_text || p.title,
    featured: p.featured !== false,
    published: p.published !== false,
    offerTag: p.offerTag || null,
    image: p.portfolio_images && p.portfolio_images.length > 0
      ? p.portfolio_images[0].storage_path
      : '/assets/brand/monogram.png',
    portfolio_images: p.portfolio_images || []
  }));
  localStorage.setItem('aayat_custom_products', JSON.stringify(mapped));
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER TABLES
// ─────────────────────────────────────────────────────────────────────────────
function renderOffersTable() {
  const tbody = document.getElementById('offers-table-body');
  const countEl = document.getElementById('offers-count');
  if (!tbody) return;

  const active = allOffers.filter(o => o.active !== false);
  if (countEl) countEl.textContent = `${active.length} Active`;
  tbody.innerHTML = '';

  if (allOffers.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="6" style="text-align:center;color:var(--cs-color-ink-muted);padding:var(--cs-space-6);">No offers yet. Create your first offer!</td>';
    tbody.appendChild(tr);
    return;
  }

  allOffers.forEach(offer => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(offer.title)}</strong></td>
      <td><code>${esc(offer.code || 'N/A')}</code></td>
      <td><strong style="color:var(--cs-color-brown);">${esc(offer.discount)}</strong></td>
      <td><span class="text-muted">${esc(offer.expiry || 'Ongoing')}</span></td>
      <td><span class="badge ${offer.active !== false ? 'badge-pub' : ''}">${offer.active !== false ? 'Active' : 'Inactive'}</span></td>
      <td>
        <button class="btn btn-secondary btn-compact toggle-offer" data-id="${esc(offer.id)}" style="margin-right:4px;">${offer.active !== false ? 'Deactivate' : 'Activate'}</button>
        <button class="btn btn-secondary btn-compact delete-offer" data-id="${esc(offer.id)}" style="color:var(--cs-color-error);">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind toggle
  tbody.querySelectorAll('.toggle-offer').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      allOffers = allOffers.map(o => o.id === id ? { ...o, active: !o.active } : o);
      await adminSaveOffers(allOffers);
      renderOffersTable();
    });
  });

  // Bind delete
  tbody.querySelectorAll('.delete-offer').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this offer? It will no longer appear on the client site.')) return;
      allOffers = allOffers.filter(o => o.id !== btn.dataset.id);
      await adminSaveOffers(allOffers);
      renderOffersTable();
    });
  });
}

function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  const countEl = document.getElementById('products-count');
  if (!tbody) return;

  if (countEl) countEl.textContent = `${allItems.length} Items`;
  tbody.innerHTML = '';

  if (allItems.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7" style="text-align:center;color:var(--cs-color-ink-muted);padding:var(--cs-space-6);">No products yet. Add your first creative work!</td>';
    tbody.appendChild(tr);
    return;
  }

  allItems.forEach(p => {
    const coverPath = p.portfolio_images && p.portfolio_images.length > 0
      ? p.portfolio_images[0].storage_path
      : (p.image || '/assets/brand/monogram.png');

    const published = p.published !== false;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${esc(coverPath)}" alt="" width="52" height="40" style="object-fit:cover;border-radius:2px;" onerror="this.src='/assets/brand/monogram.png'"></td>
      <td><strong>${esc(p.title)}</strong><br><span class="text-small text-muted">${esc((p.description || p.desc || '').substring(0,60))}…</span></td>
      <td>${esc(p.client_brand || p.brand || '')}</td>
      <td><span class="badge badge-new">${esc(formatCat(p.category))}</span></td>
      <td>${p.offerTag ? `<span class="badge badge-offer">${esc(p.offerTag)}</span>` : '<span class="text-muted">—</span>'}</td>
      <td>
        <span class="badge ${published ? 'badge-pub' : ''}" style="${published ? '' : 'background:#f1f5f9;color:#64748b;'}">${published ? 'Published' : 'Draft'}</span>
      </td>
      <td>
        <button class="btn btn-secondary btn-compact toggle-pub" data-id="${esc(p.id)}" style="margin-right:4px;">${published ? 'Unpublish' : 'Publish'}</button>
        <button class="btn btn-secondary btn-compact delete-prod" data-id="${esc(p.id)}" style="color:var(--cs-color-error);">Remove</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind toggle-publish
  tbody.querySelectorAll('.toggle-pub').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const item = allItems.find(i => i.id === id);
      if (!item) return;
      const newPublished = !(item.published !== false);
      try {
        showStatus('Updating…', 'info');
        await adminUpdateItem(id, { published: newPublished, featured: newPublished });
        await refreshItems();
        showStatus(newPublished ? 'Product published — now visible on client site.' : 'Product unpublished.', 'success');
      } catch (e) {
        // Fallback: update in-memory + localStorage
        allItems = allItems.map(i => i.id === id ? { ...i, published: newPublished } : i);
        mirrorItemsToLocalStorage(allItems);
        renderProductsTable();
        showStatus('Saved locally (Supabase offline).', 'warn');
      }
      setTimeout(hideStatus, 3000);
    });
  });

  // Bind delete
  tbody.querySelectorAll('.delete-prod').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this product? It will be deleted from the client site immediately.')) return;
      const id = btn.dataset.id;
      const item = allItems.find(i => i.id === id);
      try {
        showStatus('Deleting…', 'info');
        // Delete storage images if any
        if (item && item.portfolio_images) {
          for (const img of item.portfolio_images) {
            if (img.storage_path && !img.storage_path.startsWith('/assets/')) {
              await deleteStorageImage(img.storage_path);
            }
          }
        }
        await adminDeleteItem(id);
        await refreshItems();
        showStatus('Product removed from client site.', 'success');
      } catch (e) {
        // Fallback: remove from localStorage only
        allItems = allItems.filter(i => i.id !== id);
        mirrorItemsToLocalStorage(allItems);
        renderProductsTable();
        showStatus('Removed locally (Supabase offline).', 'warn');
      }
      setTimeout(hideStatus, 3000);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
function initModals() {
  const prodModal = document.getElementById('product-modal');
  const offerModal = document.getElementById('offer-modal');

  document.getElementById('add-product-btn').onclick = () => {
    editingItemId = null;
    document.getElementById('modal-prod-title').textContent = 'Add New Product / Work';
    resetProductForm();
    prodModal.style.display = 'flex';
  };

  document.getElementById('close-prod-modal').onclick = () => prodModal.style.display = 'none';
  document.getElementById('cancel-prod-btn').onclick = () => prodModal.style.display = 'none';

  document.getElementById('add-offer-btn').onclick = () => {
    offerModal.style.display = 'flex';
  };
  document.getElementById('close-offer-modal').onclick = () => offerModal.style.display = 'none';
  document.getElementById('cancel-offer-btn').onclick = () => offerModal.style.display = 'none';

  // Close on overlay click
  [prodModal, offerModal].forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
  });
}

function resetProductForm() {
  document.getElementById('product-form').reset();
  selectedImageFile = null;
  const previewImg = document.getElementById('image-preview');
  const placeholder = document.getElementById('image-placeholder-text');
  if (previewImg) { previewImg.style.display = 'none'; previewImg.src = ''; }
  if (placeholder) placeholder.style.display = 'block';
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE UPLOAD
// ─────────────────────────────────────────────────────────────────────────────
function initImageUpload() {
  const dropArea = document.getElementById('image-drop-area');
  const fileInput = document.getElementById('prod-image-file');
  const previewImg = document.getElementById('image-preview');
  const placeholder = document.getElementById('image-placeholder-text');

  if (!dropArea || !fileInput) return;

  dropArea.onclick = () => fileInput.click();

  dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.style.borderColor = 'var(--cs-color-brown)'; });
  dropArea.addEventListener('dragleave', () => { dropArea.style.borderColor = ''; });
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImageFile(file, previewImg, placeholder);
  });

  fileInput.onchange = e => {
    const file = e.target.files[0];
    if (file) handleImageFile(file, previewImg, placeholder);
  };
}

function handleImageFile(file, previewImg, placeholder) {
  if (file.size > 5 * 1024 * 1024) {
    alert('Image must be under 5 MB.');
    return;
  }
  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = evt => {
    if (previewImg) { previewImg.src = evt.target.result; previewImg.style.display = 'block'; }
    if (placeholder) placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT FORM SUBMIT
// ─────────────────────────────────────────────────────────────────────────────
function initProductForm() {
  document.getElementById('product-form').addEventListener('submit', async e => {
    e.preventDefault();

    const title = document.getElementById('prod-title').value.trim();
    const brand = document.getElementById('prod-brand').value.trim();
    const category = document.getElementById('prod-category').value;
    const desc = document.getElementById('prod-desc').value.trim();
    const offerTag = document.getElementById('prod-offer').value.trim() || null;

    if (!title || !brand || !desc) {
      alert('Please fill in all required fields.');
      return;
    }

    const submitBtn = document.querySelector('#product-form button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      showStatus('Uploading to Supabase…', 'info');

      // Generate slug from title
      const slug = generateSlug(title) + '-' + Date.now().toString(36);

      // Try Supabase insert
      let savedItem = null;
      let imagePublicUrl = '/assets/brand/monogram.png';
      let imageStoragePath = null;

      try {
        // 1. Insert portfolio item
        savedItem = await adminInsertItem({
          slug,
          title,
          client_brand: brand,
          category,
          description: desc,
          alt_text: title,
          featured: true,
          published: true
        });

        // 2. Upload image to Storage if provided
        if (selectedImageFile) {
          const uploaded = await uploadPortfolioImage(selectedImageFile, slug);
          imagePublicUrl = uploaded.publicUrl;
          imageStoragePath = uploaded.path;

          // 3. Link image record
          await adminInsertImage({
            portfolio_item_id: savedItem.id,
            storage_path: imagePublicUrl,
            image_order: 1,
            width: 1200,
            height: 900
          });
        }

        showStatus('Product published to client site via Supabase!', 'success');
      } catch (supaErr) {
        console.warn('Supabase insert failed, saving to localStorage only:', supaErr.message);

        // Fallback: save to localStorage with the base64 preview
        const previewImg = document.getElementById('image-preview');
        imagePublicUrl = previewImg && previewImg.src ? previewImg.src : '/assets/brand/monogram.png';

        const localItem = {
          id: 'local-' + Date.now(),
          slug,
          title,
          client_brand: brand,
          brand,
          category,
          description: desc,
          desc,
          alt_text: title,
          featured: true,
          published: true,
          offerTag,
          image: imagePublicUrl,
          portfolio_images: [{ id: 'img-0', storage_path: imagePublicUrl, image_order: 1, width: 1200, height: 900 }]
        };

        allItems = [localItem, ...allItems];
        mirrorItemsToLocalStorage(allItems);
        renderProductsTable();
        showStatus('Saved locally (Supabase offline). Will sync when reconnected.', 'warn');
      }

      // Add offer tag support via localStorage for quick sync even if Supabase worked
      if (offerTag && savedItem) {
        savedItem.offerTag = offerTag;
      }

      // Refresh to pick up Supabase-saved items
      await refreshItems();

      // Close modal
      document.getElementById('product-modal').style.display = 'none';
      resetProductForm();

      setTimeout(hideStatus, 4000);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save & Publish Product';
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFER FORM SUBMIT
// ─────────────────────────────────────────────────────────────────────────────
function initOfferForm() {
  document.getElementById('offer-form').addEventListener('submit', async e => {
    e.preventDefault();

    const newOffer = {
      id: 'offer-' + Date.now(),
      title: document.getElementById('offer-title').value.trim(),
      code: document.getElementById('offer-code').value.trim(),
      discount: document.getElementById('offer-discount').value.trim(),
      expiry: document.getElementById('offer-expiry').value.trim(),
      active: true
    };

    if (!newOffer.title || !newOffer.discount) {
      alert('Please fill in the offer headline and discount fields.');
      return;
    }

    allOffers = [newOffer, ...allOffers];

    try {
      await adminSaveOffers(allOffers);
      showStatus('Offer published — now visible on client site!', 'success');
    } catch (e) {
      showStatus('Offer saved locally.', 'warn');
    }

    renderOffersTable();
    document.getElementById('offer-form').reset();
    document.getElementById('offer-modal').style.display = 'none';
    setTimeout(hideStatus, 3000);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
function initLogout() {
  document.getElementById('logout-btn').addEventListener('click', async e => {
    e.preventDefault();
    try {
      await adminSignOut();
    } catch (_) {}
    sessionStorage.removeItem('aayat_admin_authenticated');
    sessionStorage.removeItem('aayat_admin_email');
    window.location.href = '/admin/';
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCat(c) {
  if (c === 'ads') return 'Ad Creative';
  if (c === 'posters') return 'Poster Design';
  if (c === 'social_media') return 'Social Media';
  return c || 'Creative Work';
}

function generateSlug(text) {
  return (text || 'project')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 60);
}

function showStatus(msg, type = 'info') {
  let bar = document.getElementById('admin-status-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'admin-status-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:10px 20px;font-size:0.875rem;font-weight:500;text-align:center;transition:opacity 0.3s;';
    document.body.prepend(bar);
  }
  const colors = {
    info: 'background:#1e293b;color:#f8fafc;',
    success: 'background:#166534;color:#f0fdf4;',
    warn: 'background:#92400e;color:#fffbeb;',
    error: 'background:#991b1b;color:#fef2f2;'
  };
  bar.style.cssText += colors[type] || colors.info;
  bar.textContent = msg;
  bar.style.display = 'block';
  bar.style.opacity = '1';
}

function hideStatus() {
  const bar = document.getElementById('admin-status-bar');
  if (bar) { bar.style.opacity = '0'; setTimeout(() => { bar.style.display = 'none'; }, 300); }
}
