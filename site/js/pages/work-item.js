/**
 * site/js/pages/work-item.js
 * Project detail page: loads item by slug parameter, updates dynamic title and renders stacked images
 */

import { fetchPublishedItemBySlug, fetchPublishedItems } from '../api/portfolio.js';

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('item-details-container');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');

  if (!slug) {
    showNotFound(container);
    return;
  }

  try {
    let item = await fetchPublishedItemBySlug(slug);

    // Fallback search in all published items if single fetch returned null
    if (!item) {
      const all = await fetchPublishedItems();
      item = all.find(i => i.slug === slug);
    }

    if (!item) {
      showNotFound(container);
      return;
    }

    // Dynamic document title update (SEO / Accessibility)
    document.title = `${item.title} — Aayat Creative Studio`;

    renderItem(container, item);
  } catch (err) {
    console.error('Error rendering item:', err);
    showNotFound(container);
  }
});

function showNotFound(container) {
  container.textContent = '';
  
  const wrapper = document.createElement('div');
  wrapper.className = 'container-reading';
  wrapper.style.padding = 'var(--cs-space-8) 0';
  wrapper.style.textAlign = 'center';

  const heading = document.createElement('h1');
  heading.textContent = 'Project Not Found';
  heading.style.marginBottom = 'var(--cs-space-4)';
  wrapper.appendChild(heading);

  const desc = document.createElement('p');
  desc.className = 'text-muted';
  desc.textContent = 'This project may have been updated, unpublished, or does not exist.';
  desc.style.marginBottom = 'var(--cs-space-6)';
  wrapper.appendChild(desc);

  const link = document.createElement('a');
  link.href = '/work/';
  link.className = 'btn btn-primary';
  link.textContent = 'View All Projects';
  wrapper.appendChild(link);

  container.appendChild(wrapper);
}

function renderItem(container, item) {
  container.textContent = '';

  const layout = document.createElement('div');
  layout.style.display = 'grid';
  layout.style.gridTemplateColumns = '1fr';
  layout.style.gap = 'var(--cs-space-8)';

  // Responsive two-column on desktop
  const mql = window.matchMedia('(min-width: 1024px)');
  if (mql.matches) {
    layout.style.gridTemplateColumns = '1.6fr 1fr';
    layout.style.alignItems = 'start';
  }

  // Left column: Stacked Images
  const mediaCol = document.createElement('div');
  mediaCol.style.display = 'flex';
  mediaCol.style.flexDirection = 'column';
  mediaCol.style.gap = 'var(--cs-space-6)';

  const images = (item.portfolio_images && item.portfolio_images.length > 0)
    ? item.portfolio_images
    : [{ storage_path: '/assets/brand/monogram.png' }];

  images.forEach((imgObj, idx) => {
    const figure = document.createElement('figure');
    figure.style.backgroundColor = 'var(--cs-color-surface)';
    figure.style.border = 'var(--cs-border-default)';
    figure.style.borderRadius = 'var(--cs-radius-sm)';
    figure.style.overflow = 'hidden';

    const img = document.createElement('img');
    img.src = imgObj.storage_path;
    img.alt = item.alt_text ? `${item.alt_text} (View ${idx + 1})` : item.title;
    img.loading = idx === 0 ? 'eager' : 'lazy';
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';

    figure.appendChild(img);
    mediaCol.appendChild(figure);
  });
  layout.appendChild(mediaCol);

  // Right column: Project Details
  const infoCol = document.createElement('div');
  infoCol.style.position = mql.matches ? 'sticky' : 'static';
  infoCol.style.top = '100px';

  const category = document.createElement('span');
  category.className = 'text-eyebrow';
  category.textContent = formatCategory(item.category);
  category.style.marginBottom = 'var(--cs-space-3)';
  infoCol.appendChild(category);

  const title = document.createElement('h1');
  title.textContent = item.title;
  title.style.marginBottom = 'var(--cs-space-4)';
  infoCol.appendChild(title);

  if (item.client_brand) {
    const brandRow = document.createElement('div');
    brandRow.style.padding = 'var(--cs-space-3) 0';
    brandRow.style.borderTop = 'var(--cs-border-default)';
    brandRow.style.borderBottom = 'var(--cs-border-default)';
    brandRow.style.marginBottom = 'var(--cs-space-5)';
    brandRow.style.display = 'flex';
    brandRow.style.justifyContent = 'space-between';
    
    const brandLabel = document.createElement('span');
    brandLabel.className = 'text-small text-muted';
    brandLabel.textContent = 'Client';
    
    const brandVal = document.createElement('span');
    brandVal.className = 'text-small';
    brandVal.style.fontWeight = '500';
    brandVal.textContent = item.client_brand;

    brandRow.appendChild(brandLabel);
    brandRow.appendChild(brandVal);
    infoCol.appendChild(brandRow);
  }

  const descHeading = document.createElement('h2');
  descHeading.textContent = 'About the Project';
  descHeading.style.fontSize = '1.25rem';
  descHeading.style.marginBottom = 'var(--cs-space-3)';
  infoCol.appendChild(descHeading);

  const desc = document.createElement('p');
  desc.className = 'text-body text-muted';
  desc.textContent = item.description;
  desc.style.marginBottom = 'var(--cs-space-7)';
  infoCol.appendChild(desc);

  // CTA Box
  const ctaBox = document.createElement('div');
  ctaBox.style.padding = 'var(--cs-space-5)';
  ctaBox.style.border = 'var(--cs-border-default)';
  ctaBox.style.borderRadius = 'var(--cs-radius-sm)';
  ctaBox.style.backgroundColor = 'var(--cs-color-surface)';

  const ctaText = document.createElement('p');
  ctaText.className = 'text-small';
  ctaText.style.fontWeight = '500';
  ctaText.style.marginBottom = 'var(--cs-space-3)';
  ctaText.textContent = 'Looking for similar creative work?';
  ctaBox.appendChild(ctaText);

  const ctaBtn = document.createElement('a');
  ctaBtn.href = '/contact/';
  ctaBtn.className = 'btn btn-primary';
  ctaBtn.style.width = '100%';
  ctaBtn.textContent = 'Start a Project';
  ctaBox.appendChild(ctaBtn);

  infoCol.appendChild(ctaBox);
  layout.appendChild(infoCol);

  container.appendChild(layout);
}

function formatCategory(cat) {
  switch (cat) {
    case 'ads': return 'Ad Creative';
    case 'posters': return 'Poster Design';
    case 'social_media': return 'Social Media';
    default: return 'Creative Work';
  }
}
