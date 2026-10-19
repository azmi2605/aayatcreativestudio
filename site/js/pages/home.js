/**
 * site/js/pages/home.js
 * Logic for the Home Page (index.html)
 * Follows AGENTS.md rules: no innerHTML with untrusted data, semantic DOM creation.
 */

import { fetchPublishedItems } from '../api/portfolio.js';

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  loadFeaturedWork();
});

/**
 * Mobile Navigation Menu Handler
 */
function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const nav = document.querySelector('.site-nav');

  if (!menuBtn || !nav) return;

  menuBtn.addEventListener('click', () => {
    const isExpanded = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!isExpanded));
    
    // Toggle active display on mobile
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
      nav.style.flexDirection = '';
      nav.style.position = '';
      nav.style.top = '';
      nav.style.left = '';
      nav.style.right = '';
      nav.style.backgroundColor = '';
      nav.style.padding = '';
      nav.style.borderBottom = '';
      nav.style.gap = '';
    }
  });
}

/**
 * Loads featured work cards into the Home page showcase
 */
async function loadFeaturedWork() {
  const container = document.getElementById('featured-portfolio-grid');
  if (!container) return;

  try {
    const items = await fetchPublishedItems();
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

  const category = document.createElement('span');
  category.className = 'text-eyebrow';
  category.style.fontSize = '0.75rem';
  category.style.marginBottom = 'var(--cs-space-2)';
  category.textContent = formatCategory(item.category);
  content.appendChild(category);

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

function formatCategory(cat) {
  switch (cat) {
    case 'ads': return 'Ad Creative';
    case 'posters': return 'Poster Design';
    case 'social_media': return 'Social Media';
    default: return 'Creative Work';
  }
}
