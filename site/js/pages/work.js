/**
 * site/js/pages/work.js
 * Portfolio list page filtering and rendering
 */

import { fetchPublishedItems, fetchCategories, getCategoryLabel } from '../api/portfolio.js';

let allItems = [];

document.addEventListener('DOMContentLoaded', async () => {
  initMobileMenu();
  initFilterControls();
  await loadPortfolio();
});

function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const nav = document.querySelector('.site-nav');
  if (!menuBtn || !nav) return;

  menuBtn.addEventListener('click', () => {
    const isExpanded = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!isExpanded));
    if (!isExpanded) {
      nav.style.display = 'flex';
      nav.style.flexDirection = 'column';
      nav.style.position = 'absolute';
      nav.style.top = '100%';
      nav.style.left = '0';
      nav.style.right = '0';
      nav.style.backgroundColor = 'var(--cs-color-surface)';
      nav.style.padding = 'var(--cs-space-5)';
      nav.style.borderBottom = 'var(--cs-border-default)';
      nav.style.gap = 'var(--cs-space-4)';
    } else {
      nav.style.display = '';
    }
  });
}

async function loadPortfolio() {
  const container = document.getElementById('portfolio-container');
  if (!container) return;

  try {
    // The category list and the projects come from the same shared source
    // the admin portal writes to.
    const [items, categories] = await Promise.all([
      fetchPublishedItems(),
      fetchCategories()
    ]);
    allItems = items;
    renderFilterButtons(categories);

    // Check URL query parameter (e.g. ?category=ads)
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category') || 'all';

    applyFilter(categoryParam);
  } catch (err) {
    console.error('Failed to load portfolio:', err);
    container.textContent = '';
    const errEl = document.createElement('p');
    errEl.className = 'text-muted';
    errEl.textContent = 'Unable to load portfolio items at this time.';
    container.appendChild(errEl);
  }
}

function initFilterControls() {
  const filterBar = document.querySelector('.filter-bar');
  if (!filterBar) return;

  // Delegated listener — it also serves the buttons rendered from the
  // shared category list.
  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    const category = btn.getAttribute('data-category');

    // Update URL query parameter cleanly without reloading
    const url = new URL(window.location);
    if (category === 'all') {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', category);
    }
    window.history.pushState({}, '', url);

    applyFilter(category);
  });

  // Handle back/forward navigation
  window.addEventListener('popstate', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category') || 'all';
    applyFilter(category);
  });
}

/**
 * Builds the filter bar from the shared category list, plus any category that
 * only exists on a project. A category added in the admin portal shows up here
 * without a code change.
 * @param {Array<object>} categories - The shared category list.
 */
function renderFilterButtons(categories) {
  const filterBar = document.querySelector('.filter-bar');
  if (!filterBar) return;

  // Keep the static "All Projects" button and drop the rendered ones.
  const allBtn = filterBar.querySelector('[data-category="all"]');
  filterBar.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn !== allBtn) btn.remove();
  });

  const known = new Set(categories.map(c => c.value));
  const buttons = categories.map(c => ({ value: c.value, label: c.label }));

  // Categories that are only referenced by a project still deserve a filter.
  allItems.forEach(item => {
    if (item.category && !known.has(item.category)) {
      known.add(item.category);
      buttons.push({ value: item.category, label: getCategoryLabel(item.category) });
    }
  });

  buttons.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.setAttribute('data-category', cat.value);
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = cat.label;
    filterBar.appendChild(btn);
  });
}

function applyFilter(category) {
  // Update button states
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    const isCurrent = btn.getAttribute('data-category') === category;
    btn.setAttribute('aria-pressed', String(isCurrent));
  });

  const container = document.getElementById('portfolio-container');
  const statusEl = document.getElementById('filter-status');
  if (!container) return;

  container.textContent = '';

  const filtered = category === 'all'
    ? allItems
    : allItems.filter(item => item.category === category);

  // Screen reader update
  if (statusEl) {
    statusEl.textContent = `Showing ${filtered.length} ${category === 'all' ? 'projects' : category + ' projects'}.`;
  }

  if (filtered.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'text-muted';
    emptyMsg.textContent = 'No projects found in this category.';
    container.appendChild(emptyMsg);
    return;
  }

  filtered.forEach(item => {
    const card = createWorkCard(item);
    container.appendChild(card);
  });
}

function createWorkCard(item) {
  const article = document.createElement('article');
  article.style.border = 'var(--cs-border-default)';
  article.style.borderRadius = 'var(--cs-radius-sm)';
  article.style.backgroundColor = 'var(--cs-color-surface)';
  article.style.overflow = 'hidden';
  article.style.display = 'flex';
  article.style.flexDirection = 'column';

  const imgWrapper = document.createElement('div');
  imgWrapper.style.backgroundColor = 'var(--cs-color-bg)';
  imgWrapper.style.aspectRatio = '4 / 3';
  imgWrapper.style.overflow = 'hidden';

  const image = document.createElement('img');
  const coverImg = item.portfolio_images && item.portfolio_images.length > 0
    ? item.portfolio_images[0]
    : null;

  image.src = coverImg ? coverImg.storage_path : '/assets/brand/monogram.png';
  image.alt = item.alt_text || item.title;
  image.loading = 'lazy';
  image.style.width = '100%';
  image.style.height = '100%';
  image.style.objectFit = 'cover';
  imgWrapper.appendChild(image);
  article.appendChild(imgWrapper);

  const content = document.createElement('div');
  content.style.padding = 'var(--cs-space-5)';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.flex = '1';

  const catRow = document.createElement('div');
  catRow.style.display = 'flex';
  catRow.style.justifyContent = 'space-between';
  catRow.style.alignItems = 'center';
  catRow.style.marginBottom = 'var(--cs-space-2)';

  const category = document.createElement('span');
  category.className = 'text-eyebrow';
  category.style.fontSize = '0.75rem';
  category.textContent = getCategoryLabel(item.category);
  catRow.appendChild(category);

  if (item.offerTag) {
    const offerBadge = document.createElement('span');
    offerBadge.textContent = item.offerTag;
    offerBadge.style.fontSize = '0.7rem';
    offerBadge.style.fontWeight = '600';
    offerBadge.style.backgroundColor = '#FEE2E2';
    offerBadge.style.color = '#991B1B';
    offerBadge.style.padding = '2px 8px';
    offerBadge.style.borderRadius = 'var(--cs-radius-sm)';
    catRow.appendChild(offerBadge);
  }
  content.appendChild(catRow);

  const title = document.createElement('h3');
  title.style.marginBottom = 'var(--cs-space-2)';
  title.style.fontSize = '1.25rem';
  
  const titleLink = document.createElement('a');
  titleLink.href = `/work/item.html?slug=${encodeURIComponent(item.slug)}`;
  titleLink.textContent = item.title;
  titleLink.style.textDecoration = 'none';
  titleLink.style.color = 'var(--cs-color-brown)';
  title.appendChild(titleLink);
  content.appendChild(title);

  if (item.client_brand) {
    const brand = document.createElement('p');
    brand.className = 'text-small text-muted';
    brand.style.marginBottom = 'var(--cs-space-3)';
    brand.textContent = `Client: ${item.client_brand}`;
    content.appendChild(brand);
  }

  const desc = document.createElement('p');
  desc.className = 'text-small';
  desc.style.color = 'var(--cs-color-ink-muted)';
  desc.style.marginTop = 'auto';
  desc.textContent = item.description;
  content.appendChild(desc);

  article.appendChild(content);
  return article;
}

