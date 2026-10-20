/**
 * site/js/admin/dashboard.js
 * Admin Dashboard — full Supabase-connected CRUD.
 *
 * Flow:
 *   1. Verifies a Supabase Auth session AND the is_admin() database check.
 *      No local flag can open the dashboard.
 *   2. Loads portfolio items, categories and offers from Supabase.
 *   3. Admin can add/delete products with real image upload to Supabase Storage.
 *   4. All changes are written to Supabase, which is the single source of
 *      truth the client site reads from.
 */

import {
  getAdminSession,
  adminSignOut,
  isAdminUser,
  adminFetchAllItems,
  adminInsertItem,
  adminInsertImage,
  adminUpdateItem,
  adminDeleteItem,
  uploadPortfolioImage,
  deleteStorageImage,
  adminFetchOffers,
  adminSaveOffers,
  adminFetchCategories,
  adminInsertCategory,
  adminDeleteCategory,
  adminUpdateCategory,
  adminToggleCategoryActive
} from './supabase-client.js';

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
let allItems = [];
let allOffers = [];
let selectedImageFile = null;
let statusHideTimer = null;
let statusMessageId = 0;

// The portfolio bucket rejects files above 5 MB.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const loadingMessageId = showStatus('Loading dashboard…', 'info');

  // ADM-1 — the guard runs on every page load, before anything renders.
  // Both the Auth session and the is_admin() check must pass.
  const authed = await verifyAdminAccess();
  if (!authed) {
    window.location.href = '/admin/';
    return;
  }

  // Wire up UI controls
  initModals();
  initImageUpload();
  initProductForm();
  initCategoryControls();
  initOfferForm();
  initLogout();

  // Load data
  await Promise.all([refreshAll(), refreshCategories()]);
  hideStatus(loadingMessageId);
});

/**
 * Confirms the visitor is a signed-in administrator.
 * A Supabase session alone is not enough — the database must also report the
 * user as an admin, so an ordinary Auth account cannot open the portal.
 * @returns {Promise<boolean>} True when access is granted.
 */
async function verifyAdminAccess() {
  try {
    const session = await getAdminSession();
    if (!session) return false;
    return await isAdminUser();
  } catch (e) {
    console.warn('Admin access check failed:', e);
    return false;
  }
}

/**
 * Re-verifies admin access immediately before a write operation.
 * Sessions can expire between page load and a write; reads may still work
 * under the public SELECT policy while writes require an authenticated admin.
 * Shows a specific "session expired" message and redirects to login when access
 * is lost, rather than a generic "could not save" message.
 * @returns {Promise<boolean>} True when write access is confirmed.
 */
async function reverifyAdminAccess() {
  const authed = await verifyAdminAccess();
  if (!authed) {
    const session = await getAdminSession();
    if (!session) {
      showStatus('Session expired — please sign in again.', 'error');
    } else {
      showStatus('Admin access lost — please sign in again.', 'error');
    }
    setTimeout(() => { window.location.href = '/admin/'; }, 1500);
  }
  return authed;
}

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
    console.warn('Supabase fetch failed:', e.message);
    showStatus('Could not load designs from the database. Check the connection and reload.', 'error');
    allItems = [];
  }
  renderProductsTable();
  populateCategoryDropdown(document.getElementById('prod-category')?.value);
}

async function refreshOffers() {
  try {
    allOffers = await adminFetchOffers();
  } catch (e) {
    console.warn('Supabase offer fetch failed:', e.message);
    showStatus('Could not load offers from the database. Check the connection and reload.', 'error');
    allOffers = [];
  }
  renderOffersTable();
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

  // Bind delete — inline toggle confirm (no browser dialog)
  tbody.querySelectorAll('.delete-offer').forEach(btn => {
    btn.addEventListener('click', () => {
      inlineConfirm(btn, async () => {
        allOffers = allOffers.filter(o => o.id !== btn.dataset.id);
        await adminSaveOffers(allOffers);
        renderOffersTable();
      });
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
      const messageId = showStatus('Updating…', 'info');
      try {
        await adminUpdateItem(id, { published: newPublished, featured: newPublished });
        await refreshItems();
        showStatus(newPublished ? 'Product published — now visible on client site.' : 'Product unpublished.', 'success');
      } catch (e) {
        console.error('Publish toggle failed:', e);
        showStatus('Could not update the design. The client site still shows the old state.', 'error');
      }
      setTimeout(() => hideStatus(messageId), 3000);
    });
  });

  // Bind delete — inline toggle confirm (no browser dialog)
  tbody.querySelectorAll('.delete-prod').forEach(btn => {
    btn.addEventListener('click', () => {
      inlineConfirm(btn, async () => {
        const id = btn.dataset.id;
        const item = allItems.find(i => i.id === id);
        const messageId = showStatus('Deleting…', 'info');
        try {
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
          console.error('Delete failed:', e);
          showStatus('Could not delete the design. It is still on the client site.', 'error');
        }
        setTimeout(() => hideStatus(messageId), 3000);
      });
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

  // Reset custom category box
  const newCatBox = document.getElementById('new-category-box');
  const newCatInput = document.getElementById('new-cat-input');
  const newCatErr = document.getElementById('new-cat-error');
  if (newCatBox) newCatBox.style.display = 'none';
  if (newCatInput) newCatInput.value = '';
  if (newCatErr) newCatErr.style.display = 'none';

  populateCategoryDropdown(DEFAULT_CATEGORIES[0].value);
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
  if (file.size > MAX_IMAGE_BYTES) {
    showStatus('Image must be under 5 MB.', 'error');
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
    let category = document.getElementById('prod-category').value;
    const desc = document.getElementById('prod-desc').value.trim();
    const offerTag = document.getElementById('prod-offer').value.trim() || null;

    // Handle custom category selection if user selected __add_new__
    if (category === ADD_NEW_CATEGORY_VALUE) {
      const customInput = document.getElementById('new-cat-input');
      const customName = customInput ? customInput.value.trim() : '';
      if (!customName) {
        showStatus('Enter a name for the new category, or pick an existing one.', 'error');
        const box = document.getElementById('new-category-box');
        if (box) box.style.display = 'block';
        customInput?.focus();
        return;
      }
      const slug = customName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || ('cat_' + Date.now());
      try {
        await saveCustomCategory(customName, slug);
      } catch (e) {
        console.error('Category save failed:', e);
        showStatus(`Could not save category "${customName}" — it will not appear on the client site.`, 'error');
        return;
      }
      populateCategoryDropdown(slug);
      category = slug;
    }

    if (!title || !brand || !desc) {
      showStatus('Fill in the title, client name and description.', 'error');
      return;
    }

    const submitBtn = document.querySelector('#product-form button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      showStatus('Uploading to Supabase…', 'info');

      // Generate valid slug strictly matching database constraint ^[a-z0-9]+(-[a-z0-9]+)*$
      const baseSlug = generateSlug(title);
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      // 1. Insert portfolio item
      const savedItem = await adminInsertItem({
        slug,
        title,
        client_brand: brand,
        category,
        description: desc,
        alt_text: title,
        offer_tag: offerTag,
        featured: true,
        published: true
      });

      // 2. Upload image to Storage if provided
      if (selectedImageFile) {
        const uploaded = await uploadPortfolioImage(selectedImageFile, slug);
        const uploadedItem = await adminInsertImage({
          portfolio_item_id: savedItem.id,
          storage_path: uploaded.publicUrl,
          image_order: 1,
          width: 1200,
          height: 900
        });
        if (!uploadedItem) {
          throw new Error('The image record was not stored.');
        }
      }

      showStatus('Product published to client site via Supabase!', 'success');

      // Refresh to pick up the saved item
      await refreshItems();

      // Close modal
      document.getElementById('product-modal').style.display = 'none';
      resetProductForm();

      setTimeout(hideStatus, 4000);
    } catch (e) {
      console.error('Save failed:', e);
      // The form keeps its values so nothing has to be retyped (AGENTS 9.4).
      showStatus(
        'Could not save to the database, so this design is NOT on the client site. Check the connection and try again.',
        'error'
      );
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
      showStatus('Fill in the offer headline and the discount.', 'error');
      return;
    }

    try {
      await adminSaveOffers([newOffer, ...allOffers]);
      allOffers = [newOffer, ...allOffers];
      const statusId = showStatus('Offer published — now visible on client site!', 'success');
    } catch (e) {
      console.error('Offer save failed:', e);
      showStatus('Could not save the offer, so it is NOT on the client site. Try again.', 'error');
      return;
    }

    renderOffersTable();
    document.getElementById('offer-form').reset();
    document.getElementById('offer-modal').style.display = 'none';
    setTimeout(() => hideStatus(statusId), 3000);
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
    } catch (_) {
      // A failed sign-out still leaves the portal, because the guard on the
      // next page load requires a live session.
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// INLINE CONFIRM TOGGLE
// Replaces native confirm() with an inline "Sure? ✓ Yes  ✕ No" toggle on the button
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Replaces `btn` with an inline "Sure? ✓ ✕" toggle for one-click confirmation.
 * Clicking ✓ Yes runs onConfirm(); clicking ✕ No restores the button.
 * @param {HTMLButtonElement} btn - The delete/action button to replace.
 * @param {Function} onConfirm - Async callback to run on confirmation.
 */
function inlineConfirm(btn, onConfirm) {
  if (btn.dataset.confirming === 'true') return;
  btn.dataset.confirming = 'true';

  const originalHTML = btn.innerHTML;
  const originalStyle = btn.getAttribute('style') || '';
  const originalClass = btn.className;

  btn.innerHTML = '';
  btn.removeAttribute('style');
  btn.className = '';
  btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:0;background:none;border:none;cursor:default;';

  const label = document.createElement('span');
  label.textContent = 'Sure?';
  label.style.cssText = 'font-size:0.8rem;color:var(--cs-color-ink-muted);white-space:nowrap;';

  const yesBtn = document.createElement('button');
  yesBtn.type = 'button';
  yesBtn.textContent = '✓ Yes';
  yesBtn.style.cssText = 'padding:3px 10px;font-size:0.78rem;font-weight:600;background:var(--cs-color-error,#dc2626);color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;';

  const noBtn = document.createElement('button');
  noBtn.type = 'button';
  noBtn.textContent = '✕ No';
  noBtn.style.cssText = 'padding:3px 10px;font-size:0.78rem;font-weight:500;background:none;color:var(--cs-color-ink-muted);border:1px solid var(--cs-color-line-strong,#ccc);border-radius:4px;cursor:pointer;white-space:nowrap;';

  const restore = () => {
    btn.innerHTML = originalHTML;
    btn.className = originalClass;
    btn.setAttribute('style', originalStyle);
    delete btn.dataset.confirming;
  };

  yesBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    yesBtn.disabled = true;
    yesBtn.textContent = '…';
    await onConfirm();
    restore();
  });

  noBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    restore();
  });

  btn.appendChild(label);
  btn.appendChild(yesBtn);
  btn.appendChild(noBtn);
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY MANAGEMENT
//
// The category list is shared state: it lives in the public.categories table
// so the admin portal and the client site read exactly the same list. The
// localStorage key below is only a mirror for offline use — it is written
// after every successful read and write, and the client site reads it only
// when Supabase cannot be reached.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { value: 'ads', label: 'Ad Creatives' },
  { value: 'posters', label: 'Poster Design' },
  { value: 'social_media', label: 'Social Media Design' }
];

const CATEGORY_STORE_KEY = 'aayat_custom_categories';
const ADD_NEW_CATEGORY_VALUE = '__add_new__';

let allCategories = [];
let isRemovingCategory = false;
let isConfirmDialogOpen = false;

/** Reads the localStorage mirror of the shared category list. */
function getStoredCustomCategories() {
  try {
    const raw = localStorage.getItem(CATEGORY_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/** Mirrors the shared category list into localStorage for offline use. */
function mirrorCategoriesToLocalStorage(categories) {
  const mapped = categories.map(c => ({ label: c.label, value: c.value }));
  try {
    localStorage.setItem(CATEGORY_STORE_KEY, JSON.stringify(mapped));
  } catch (_) {
    // A full or blocked storage must not break the admin flow.
  }
}

/**
 * Loads the shared category list.
 * Supabase is the source of truth; the localStorage mirror is the fallback.
 */
async function refreshCategories() {
  try {
    allCategories = await adminFetchCategories();
    mirrorCategoriesToLocalStorage(allCategories);
  } catch (e) {
    console.warn('Supabase category fetch failed, using localStorage mirror:', e.message);
    allCategories = getStoredCustomCategories();
  }
  populateCategoryDropdown();
  renderCustomCategoryManager();
}

/**
 * Adds a category to the shared list so the client site sees it too.
 * Performs a case-insensitive duplicate check on the slug before writing to
 * the database so the admin gets a friendly message instead of a constraint
 * violation. Throws when the shared write fails, so the caller can tell the
 * admin the category did not reach the client site.
 * @param {string} label - The display name of the category.
 * @param {string} value - The stored value (slug) of the category.
 * @returns {Promise<object>} The inserted row.
 */
async function saveCustomCategory(label, value) {
  const trimmedLabel = String(label || '').trim();
  if (!trimmedLabel) {
    const err = new Error('EMPTY_CATEGORY');
    throw err;
  }
  const trimmedValue = String(value || '').trim().toLowerCase();

  // Case-insensitive duplicate prevention on both value (slug) and label.
  const existing = allCategories.find(c => 
    String(c.value || '').toLowerCase() === trimmedValue ||
    String(c.label || '').trim().toLowerCase() === trimmedLabel.toLowerCase()
  );
  if (existing) {
    const err = new Error('DUPLICATE_CATEGORY');
    err.category = existing;
    throw err;
  }

  const inserted = await adminInsertCategory({
    label: trimmedLabel,
    value: trimmedValue,
    sort_order: allCategories.length,
    is_active: true
  });
  allCategories = await adminFetchCategories();
  mirrorCategoriesToLocalStorage(allCategories);
  return inserted;
}

/**
 * Deletes a category from the shared list.
 * Throws when the shared write fails, so the caller keeps the category and
 * tells the admin that the client site still shows it.
 * @param {string} value - The category value to remove.
 */
async function removeCategory(value) {
  await adminDeleteCategory(value);

  allCategories = allCategories.filter(c => c.value !== value);
  const list = getStoredCustomCategories().filter(c => c.value !== value);
  mirrorCategoriesToLocalStorage(list);
}

/** Every active category the admin can pick — shared list, mirror as fallback.
 * Inactive (soft-deleted) categories are excluded so new designs can't be
 * assigned to a category that no longer shows on the client site.
 */
function getAvailableCategories() {
  const mirror = getStoredCustomCategories();
  const source = allCategories.length
    ? allCategories.filter(c => c.is_active !== false)
    : (mirror.length ? mirror : DEFAULT_CATEGORIES);

  const seen = new Set();
  const list = [];
  source.forEach(cat => {
    if (!cat || !cat.value || seen.has(cat.value)) return;
    seen.add(cat.value);
    list.push({ value: cat.value, label: cat.label });
  });
  return list;
}

/** The display name of a category value. */
function getCategoryLabel(value) {
  return formatCat(value);
}

/**
 * Designs that still reference a category.
 * Checks the designs loaded from the database, so a category in use cannot be
 * removed by accident.
 * @param {string} value - The category value to look for.
 * @returns {Array<object>} The items using that category.
 */
function getItemsUsingCategory(value) {
  const target = String(value).toLowerCase();
  const found = [];
  const seen = new Set();

  (Array.isArray(allItems) ? allItems : []).forEach(item => {
    if (!item || !item.category) return;
    if (String(item.category).toLowerCase() !== target) return;
    const key = item.id || item.slug || item.title;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(item);
  });

  return found;
}

/**
 * Renders every category in the shared list (active and soft-deleted).
 * Each row shows the label, an active/inactive toggle (soft-delete), a rename
 * control, and a hard-remove button that is blocked while designs reference
 * the category. The list is the same one the client site reads, so any change
 * here propagates to the Client Site on its next load.
 */
function renderCustomCategoryManager() {
  const manager = document.getElementById('custom-cat-manager');
  if (!manager) return;

  // All categories from Supabase, mirror as fallback.
  const allCats = allCategories.length
    ? allCategories
    : (getStoredCustomCategories().length ? getStoredCustomCategories() : DEFAULT_CATEGORIES);

  manager.innerHTML = '';

  if (allCats.length === 0) {
    manager.style.display = 'none';
    return;
  }

  manager.style.display = 'block';

  const heading = document.createElement('p');
  heading.style.cssText = 'font-size:0.72rem;color:var(--cs-color-ink-muted);margin:0 0 8px 0;font-weight:500;';
  heading.textContent = 'Shared categories (same list the Client Site reads):';
  manager.appendChild(heading);

  const listEl = document.createElement('div');
  listEl.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  manager.appendChild(listEl);

  allCats.forEach(cat => {
    const isActive = cat.is_active !== false;
    const usedBy = getItemsUsingCategory(cat.value);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';

    // Label (inline edit on click)
    const labelWrap = document.createElement('span');
    labelWrap.style.cssText = `display:inline-flex;align-items:center;gap:5px;min-width:150px;color:${isActive ? 'var(--cs-color-brown)' : 'var(--cs-color-ink-muted)'};font-size:0.82rem;${isActive ? 'font-weight:500;' : 'text-decoration:line-through;font-weight:400;'};`;
    const labelText = document.createElement('span');
    labelText.textContent = cat.label;
    labelWrap.appendChild(labelText);

    if (isActive) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.title = `Rename "${cat.label}"`;
      editBtn.innerHTML = '✎';
      editBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:0.78rem;color:var(--cs-color-gold-deep,#b45309);padding:0;line-height:1;';
      editBtn.addEventListener('click', () => renameCategory(labelWrap, labelText, cat));
      labelWrap.appendChild(editBtn);
    }

    const statusText = document.createElement('span');
    statusText.style.cssText = `font-size:0.7rem;${isActive ? 'color:var(--cs-color-success);' : 'color:var(--cs-color-error);'};`;
    statusText.textContent = isActive ? 'Active' : 'Inactive';
    labelWrap.appendChild(statusText);

    row.appendChild(labelWrap);

    // Active toggle (soft-delete / reactivate)
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.title = isActive ? 'Deactivate category (soft-delete)' : 'Reactivate category';
    toggleBtn.textContent = isActive ? 'Deactivate' : 'Reactivate';
    toggleBtn.style.cssText = `padding:2px 10px;font-size:0.72rem;border-radius:2px;border:1px solid;cursor:pointer;${isActive ? 'background:var(--cs-color-error-tint);color:var(--cs-color-error);border-color:var(--cs-color-error);' : 'background:var(--cs-color-success-tint);color:var(--cs-color-success);border-color:var(--cs-color-success);'};`;
    toggleBtn.addEventListener('click', async () => {
      try {
        await adminToggleCategoryActive(cat.value, !isActive);
        await refreshCategories();
        const messageId = showStatus(`Category “${cat.label}” ${isActive ? 'deactivated' : 'reactivated'}.`, 'success');
        setTimeout(() => hideStatus(messageId), 2000);
      } catch (e) {
        console.error('Toggle category active failed:', e);
        showStatus(`Could not ${isActive ? 'deactivate' : 'reactivate'} “${cat.label}”.`, 'error');
      }
    });
    row.appendChild(toggleBtn);

    // Hard-remove button (blocked while in use)
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.disabled = usedBy.length > 0;
    removeBtn.setAttribute('aria-disabled', String(usedBy.length > 0));
    removeBtn.title = usedBy.length > 0
      ? `“${cat.label}” is used by ${usedBy.length} design(s). Reassign or delete them first.`
      : `Hard-delete "${cat.label}" category`;
    removeBtn.innerHTML = '✕';
    removeBtn.style.cssText = `background:none;border:none;cursor:${usedBy.length > 0 ? 'default' : 'pointer'};font-size:0.85rem;line-height:1;color:${usedBy.length > 0 ? 'var(--cs-color-ink-muted)' : 'var(--cs-color-error)'};padding:0 0 0 2px;opacity:${usedBy.length > 0 ? '0.5' : '1'};`;
    removeBtn.addEventListener('click', () => {
      if (usedBy.length > 0) return;
      inlineConfirm(removeBtn, async () => {
        try {
          await removeCategory(cat.value);
          await refreshCategories();
          const messageId = showStatus(`Category “${cat.label}” hard-deleted.`, 'success');
          setTimeout(() => hideStatus(messageId), 2000);
        } catch (e) {
          console.error('Category removal failed:', e);
          showStatus(`Could not remove “${cat.label}”.`, 'error');
        }
      });
    });
    row.appendChild(removeBtn);

    if (usedBy.length > 0) {
      const hint = document.createElement('span');
      hint.style.cssText = 'font-size:0.7rem;color:var(--cs-color-ink-muted);margin-left:6px;';
      hint.textContent = `used by ${usedBy.length} design(s)`;
      row.appendChild(hint);
    }

    listEl.appendChild(row);
  });
}

/**
 * Inline rename flow for a category label.
 * Replaces the label text with an input; pressing Enter or clicking away saves.
 * @param {HTMLElement} labelWrap - The wrapper span containing the label.
 * @param {HTMLElement} labelText - The text node span to edit.
 * @param {object} cat - The category row { value, label, ... }.
 */
function renameCategory(labelWrap, labelText, cat) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = cat.label;
  input.maxLength = 60;
  input.style.cssText = 'font:inherit;font-size:0.82rem;padding:2px 4px;border:1px solid var(--cs-color-line-strong);border-radius:2px;min-width:120px;color:inherit;';
  input.maxLength = 60;

  const save = async () => {
    const newLabel = input.value.trim();
    if (!newLabel || newLabel === cat.label) {
      restore();
      return;
    }
    try {
      await adminUpdateCategory(cat.value, { label: newLabel });
      await refreshCategories();
      labelText.textContent = newLabel;
    } catch (e) {
      console.error('Rename category failed:', e);
      showStatus(`Could not rename “${cat.label}”.`, 'error');
    } finally {
      restore();
    }
  };

  const restore = () => {
    if (labelWrap.contains(input)) {
      labelWrap.replaceChild(labelText, input);
    }
    input.removeEventListener('blur', save);
    input.removeEventListener('keydown', onKey);
  };

  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { restore(); }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', onKey);

  labelWrap.replaceChild(input, labelText);
  input.focus();
  input.select();
}

function populateCategoryDropdown(selectedVal = null) {
  const sel = document.getElementById('prod-category');
  if (!sel) return;

  const currentVal = selectedVal || sel.value || '';
  sel.innerHTML = '';

  // 1. Categories the admin can pick (defaults + custom, minus removed ones)
  const addedValues = new Set();
  getAvailableCategories().forEach(cat => {
    addedValues.add(cat.value);
    const opt = document.createElement('option');
    opt.value = cat.value;
    opt.textContent = cat.label;
    sel.appendChild(opt);
  });

  // 2. Add any categories found in existing products
  if (Array.isArray(allItems)) {
    allItems.forEach(item => {
      if (item.category && !addedValues.has(item.category)) {
        addedValues.add(item.category);
        const opt = document.createElement('option');
        opt.value = item.category;
        opt.textContent = formatCat(item.category);
        sel.appendChild(opt);
      }
    });
  }

  // 3. Append "+ Add New Category..." at the bottom
  const addOpt = document.createElement('option');
  addOpt.value = ADD_NEW_CATEGORY_VALUE;
  addOpt.textContent = '+ Add New Category...';
  addOpt.style.fontWeight = '600';
  addOpt.style.color = 'var(--cs-color-brown, #b45309)';
  sel.appendChild(addOpt);

  // Keep the current selection when it is still available, otherwise fall
  // back to the first remaining category.
  if (currentVal === ADD_NEW_CATEGORY_VALUE) {
    sel.value = ADD_NEW_CATEGORY_VALUE;
  } else if (currentVal && addedValues.has(currentVal)) {
    sel.value = currentVal;
  } else {
    sel.value = sel.options.length ? sel.options[0].value : ADD_NEW_CATEGORY_VALUE;
  }
}

function initCategoryControls() {
  const sel = document.getElementById('prod-category');
  const btnShow = document.getElementById('btn-show-add-cat');
  const btnRemove = document.getElementById('btn-remove-cat');
  const box = document.getElementById('new-category-box');
  const input = document.getElementById('new-cat-input');
  const btnSave = document.getElementById('btn-save-new-cat');
  const btnCancel = document.getElementById('btn-cancel-new-cat');
  const errEl = document.getElementById('new-cat-error');

  if (!sel) return;

  populateCategoryDropdown();
  syncRemoveButtonState();

  const showBox = () => {
    if (box) {
      box.style.display = 'block';
      if (input) {
        input.value = '';
        input.focus();
      }
      if (errEl) errEl.style.display = 'none';
    }
  };

  const hideBox = () => {
    if (box) box.style.display = 'none';
    if (errEl) errEl.style.display = 'none';
    if (sel.value === ADD_NEW_CATEGORY_VALUE) {
      sel.value = firstCategoryValue();
      syncRemoveButtonState();
    }
  };

  sel.addEventListener('change', () => {
    syncRemoveButtonState();
    if (sel.value === ADD_NEW_CATEGORY_VALUE) {
      showBox();
    } else {
      if (box) box.style.display = 'none';
    }
  });

  if (btnShow) {
    btnShow.addEventListener('click', (e) => {
      e.preventDefault();
      sel.value = ADD_NEW_CATEGORY_VALUE;
      syncRemoveButtonState();
      showBox();
    });
  }

  // Remove the selected category (trash button next to the dropdown)
  if (btnRemove) {
    btnRemove.addEventListener('click', () => {
      handleRemoveCategory();
    });
  }

  const handleSaveCategory = async () => {
    const raw = (input?.value || '').trim();
    if (!raw) {
      if (errEl) {
        errEl.textContent = 'Please enter a category name.';
        errEl.style.display = 'block';
      }
      input?.focus();
      return;
    }

    const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || ('cat_' + Date.now());

    // Re-verify admin write access before attempting the database write.
    // Reads work under the public SELECT policy, but writes require an
    // authenticated admin session; sessions can expire after page load.
    if (!(await reverifyAdminAccess())) return;

    try {
      await saveCustomCategory(raw, slug);
    } catch (e) {
      if (e && e.message === 'DUPLICATE_CATEGORY') {
        if (errEl) {
          errEl.textContent = 'Category already exists. Choose a different name.';
          errEl.style.display = 'block';
        }
        input?.focus();
        return;
      }
      if (e && e.message === 'EMPTY_CATEGORY') {
        if (errEl) {
          errEl.textContent = 'Please enter a category name.';
          errEl.style.display = 'block';
        }
        input?.focus();
        return;
      }
      // Surface auth/permission failures with a specific message; keep the
      // raw error in the console only (no stack traces in the UI).
      if (e && (e.status === 401 || e.status === 403 || e.code === '42501' || e.code === '42P01')) {
        if (errEl) {
          errEl.textContent = 'Session expired or admin access lost — please sign in again.';
          errEl.style.display = 'block';
        }
        showStatus('Write rejected: admin session invalid. Redirecting to login…', 'error');
        setTimeout(() => { window.location.href = '/admin/'; }, 1500);
        return;
      }
      // Generic system error (database, network, etc.).
      if (errEl) {
        errEl.textContent = 'Could not save the category — it was not shared with the client site.';
        errEl.style.display = 'block';
      }
      console.error('Category save failed:', e);
      const messageId = showStatus(
        `Could not save category "${raw}" — it will not appear on the client site.`, 'error');
      setTimeout(() => hideStatus(messageId), 5000);
      return;
    }

    // Optimistic UI: select the new category, close the add interface, and
    // refresh the shared-category list so the client site sees it on next load.
    if (input) input.value = '';
    populateCategoryDropdown(slug);
    syncRemoveButtonState();
    if (box) box.style.display = 'none';
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
    renderCustomCategoryManager();
    const messageId = showStatus(`Category "${raw}" added!`, 'success');
    setTimeout(() => hideStatus(messageId), 2500);
  };

  if (btnSave) {
    btnSave.addEventListener('click', (e) => {
      e.preventDefault();
      handleSaveCategory();
    });
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveCategory();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideBox();
      }
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', (e) => {
      e.preventDefault();
      hideBox();
    });
  }
}

/**
 * Enables the remove button only when a real category is selected.
 * The "+ Add New Category..." option is not a category and is not removable.
 */
function syncRemoveButtonState() {
  const sel = document.getElementById('prod-category');
  const btn = document.getElementById('btn-remove-cat');
  if (!sel || !btn) return;
  const removable = !!sel.value && sel.value !== ADD_NEW_CATEGORY_VALUE && !isRemovingCategory;
  btn.disabled = !removable;
  btn.setAttribute('aria-disabled', String(!removable));
}

/** The first selectable category in the dropdown, or '' when there is none. */
function firstCategoryValue() {
  const sel = document.getElementById('prod-category');
  if (!sel || !sel.options.length) return '';
  return sel.options[0].value;
}

/**
 * Removes the category currently selected in the Category dropdown.
 * Blocks the removal while a design still uses the category, asks for
 * confirmation first, and keeps the category in the list when the write fails.
 */
async function handleRemoveCategory() {
  const sel = document.getElementById('prod-category');
  const btnRemove = document.getElementById('btn-remove-cat');
  if (!sel || !btnRemove || isRemovingCategory) return;

  const value = sel.value;
  if (!value || value === ADD_NEW_CATEGORY_VALUE) return;

  const label = getCategoryLabel(value);

  // A category that designs still point at cannot be removed.
  const usedBy = getItemsUsingCategory(value);
  if (usedBy.length > 0) {
    const titles = usedBy.map(item => item.title).join(', ');
    const messageId = showStatus(
      `"${label}" is used by ${usedBy.length} design(s) (${titles}). ` +
      'Reassign or delete them first.',
      'error'
    );
    setTimeout(() => hideStatus(messageId), 6000);
    return;
  }

  // The flag covers the confirmation too, so a second click cannot start a
  // second removal while the first one is still open.
  isRemovingCategory = true;
  syncRemoveButtonState();

  try {
    const confirmed = await confirmDialog(`Remove '${label}'? This can't be undone.`);
    if (!confirmed) return;

    showStatus(`Removing "${label}"…`, 'info');

    await removeCategory(value);
    populateCategoryDropdown();
    syncRemoveButtonState();
    const messageId = showStatus(`Category "${label}" removed.`, 'success');
    setTimeout(() => hideStatus(messageId), 3000);
  } catch (e) {
    console.error('Category removal failed:', e);
    const messageId = showStatus(
      `Could not remove "${label}". The category was kept — it is still listed on the client site.`,
      'error');
    setTimeout(() => hideStatus(messageId), 5000);
  } finally {
    isRemovingCategory = false;
    syncRemoveButtonState();
  }
}

/**
 * Shows the confirmation modal and resolves with the admin's choice.
 * Enter or the confirm button accepts, Escape or the backdrop cancels.
 * @param {string} message - The confirmation text.
 * @param {string} [confirmLabel] - Label of the confirm button.
 * @returns {Promise<boolean>} True when the admin confirmed.
 */
function confirmDialog(message, confirmLabel = 'Remove') {
  const modal = document.getElementById('confirm-modal');
  const msgEl = document.getElementById('confirm-modal-message');
  const okBtn = document.getElementById('confirm-modal-ok');
  const cancelBtn = document.getElementById('confirm-modal-cancel');

  if (!modal || !msgEl || !okBtn || !cancelBtn) return Promise.resolve(false);
  // One dialog at a time — a second request is ignored.
  if (isConfirmDialogOpen) return Promise.resolve(false);
  isConfirmDialogOpen = true;

  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    let settled = false;

    const close = (confirmed) => {
      if (settled) return;
      settled = true;
      isConfirmDialogOpen = false;
      modal.style.display = 'none';
      document.removeEventListener('keydown', onKeyDown, true);
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
      resolve(confirmed);
    };

    const onOk = () => close(true);
    const onCancel = () => close(false);

    const trapFocus = (e) => {
      const focusables = [cancelBtn, okBtn];
      const index = focusables.indexOf(document.activeElement);
      e.preventDefault();
      if (index === -1) {
        okBtn.focus();
        return;
      }
      const next = e.shiftKey ? index - 1 : index + 1;
      focusables[(next + focusables.length) % focusables.length].focus();
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        close(true);
      } else if (e.key === 'Tab') {
        trapFocus(e);
      }
    };

    msgEl.textContent = message;
    okBtn.textContent = confirmLabel;
    modal.style.display = 'flex';
    okBtn.focus();

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKeyDown, true);
    modal.onclick = (e) => { if (e.target === modal) close(false); };
  });
}

/**
 * The display name of a category value.
 * The shared list wins; anything else falls back to a readable slug.
 * @param {string} value - The category value.
 * @returns {string} The label to show.
 */
function formatCat(value) {
  if (!value) return 'Creative Work';

  const match = getAvailableCategories().find(cat => cat.value === value);
  if (match) return match.label;

  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

function generateSlug(text) {
  return (text || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 45) || 'project';
}

function showStatus(msg, type = 'info') {
  let bar = document.getElementById('admin-status-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'admin-status-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:10px 20px;font-size:0.875rem;font-weight:500;text-align:center;transition:opacity 0.3s;';
    document.body.prepend(bar);
  }
  // A pending hide must not hide the message that just arrived.
  statusMessageId += 1;
  if (statusHideTimer) {
    clearTimeout(statusHideTimer);
    statusHideTimer = null;
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
  return statusMessageId;
}

/**
 * Fades the banner out.
 * Pass the id returned by showStatus to hide only that message — the dashboard
 * finishes loading asynchronously, and its closing hide must not swallow a
 * message the admin triggered in the meantime.
 * @param {number} [messageId] - Id of the message to hide.
 */
function hideStatus(messageId) {
  const bar = document.getElementById('admin-status-bar');
  if (!bar) return;
  if (messageId !== undefined && messageId !== statusMessageId) return;
  const hideId = statusMessageId;
  if (statusHideTimer) clearTimeout(statusHideTimer);
  statusHideTimer = setTimeout(() => {
    statusHideTimer = null;
    if (statusMessageId !== hideId) return;
    bar.style.opacity = '0';
    setTimeout(() => {
      if (statusMessageId === hideId) bar.style.display = 'none';
    }, 300);
  }, 0);
}
