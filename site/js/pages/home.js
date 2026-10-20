/**
 * site/js/pages/home.js
 * Logic for the Home Page (index.html)
 * Follows AGENTS.md rules: no innerHTML with untrusted data, semantic DOM creation.
 */

import { fetchPublishedItems, getLiveOffers, fetchActiveOffers, fetchCategories, getCategoryLabel } from '../api/portfolio.js';

document.addEventListener('DOMContentLoaded', async () => {
  loadOffersBanner();     // Instant sync render from localStorage
  loadFeaturedWork();
  // Then upgrade offer banner async from Supabase
  fetchActiveOffers().then(offers => {
    updateOffersBanner(offers);
  }).catch(() => {});
});

function loadOffersBanner() {
  const offers = getLiveOffers();
  updateOffersBanner(offers);
}

function updateOffersBanner(offers) {
  const banner = document.getElementById('top-offer-banner');
  const textEl = document.getElementById('offer-banner-text');
  if (!banner || !textEl) return;

  if (offers && offers.length > 0) {
    const topOffer = offers[0];
    textEl.textContent = `✨ ${topOffer.title}: ${topOffer.discount} ${topOffer.code ? `(Use code: ${topOffer.code})` : ''}`;
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
}

/**
 * Loads featured work cards into the Home page showcase
 */
async function loadFeaturedWork() {
  const container = document.getElementById('featured-portfolio-grid');
  if (!container) return;

  try {
    // The shared category list gives the cards the same labels the admin uses.
    const [items, categories] = await Promise.all([
      fetchPublishedItems(),
      fetchCategories()
    ]);
    const featuredItems = items.filter(item => item.featured).slice(0, 3);

    container.textContent = ''; // Clear loading state safely

    if (featuredItems.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'text-muted';
      emptyMsg.textContent = 'Selected works will appear here shortly.';
      container.appendChild(emptyMsg);
      return;
    }

    // Grid layout
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
    container.style.gap = 'var(--cs-space-6)';

    featuredItems.forEach(item => {
      const card = createWorkCard(item);
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load featured projects:', err);
    container.textContent = '';
    const errorMsg = document.createElement('p');
    errorMsg.className = 'text-muted';
    errorMsg.textContent = 'Unable to display featured projects right now.';
    container.appendChild(errorMsg);
  }
}

/**
 * Builds a secure DOM element card for a portfolio item
 */
function createWorkCard(item) {
  const article = document.createElement('article');
  article.style.border = 'var(--cs-border-default)';
  article.style.borderRadius = 'var(--cs-radius-sm)';
  article.style.backgroundColor = 'var(--cs-color-surface)';
  article.style.overflow = 'hidden';
  article.style.display = 'flex';
  article.style.flexDirection = 'column';

  // Image section
  const imgWrapper = document.createElement('div');
  imgWrapper.style.backgroundColor = 'var(--cs-color-bg)';
  imgWrapper.style.aspectRatio = '4 / 3';
  imgWrapper.style.overflow = 'hidden';
  imgWrapper.style.display = 'flex';
  imgWrapper.style.alignItems = 'center';
  imgWrapper.style.justifyContent = 'center';

  const image = document.createElement('img');
  const coverImg = item.portfolio_images && item.portfolio_images.length > 0
    ? item.portfolio_images[0]
    : null;

  image.src = coverImg ? coverImg.storage_path : '/assets/brand/monogram.png';
  image.alt = item.alt_text || item.title || 'Portfolio creative piece';
  image.loading = 'lazy';
  image.style.width = '100%';
  image.style.height = '100%';
  image.style.objectFit = 'cover';
  imgWrapper.appendChild(image);
  article.appendChild(imgWrapper);

  // Content body
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
