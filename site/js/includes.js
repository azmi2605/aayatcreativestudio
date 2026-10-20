/**
 * site/js/includes.js
 * Fetch-injects the shared header/footer partials into every public page,
 * marks the active navigation link, initializes the mobile menu, and binds
 * every "Start a Project" CTA to the single source Instagram DM URL.
 * Replaces the redundant inline header/footer markup across site/ pages.
 */

import { INSTAGRAM_DM_URL } from './config.js';

const HEADER_URL = '/includes/header.html';
const FOOTER_URL = '/includes/footer.html';

async function inject(id, url) {
  const placeholder = document.getElementById(id);
  if (!placeholder) return;

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    placeholder.innerHTML = await res.text();
  } catch (err) {
    console.error(`Failed to include ${url}:`, err);
  }
}

/**
 * Binds every "Start a Project" CTA to the single source Instagram DM URL.
 * Uses real anchor tags with target="_blank" and rel="noopener noreferrer"
 * so the site stays open in the original tab. Design, colors, fonts, size,
 * position, hover/focus styles, and keyboard accessibility are unchanged.
 */
function bindProjectCtas() {
  const ctaIds = [
    'header-cta-btn',
    'hero-cta-btn',
    'footer-cta-btn',
    'footer-nav-cta'
  ];

  ctaIds.forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.href = INSTAGRAM_DM_URL;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
  });
}

function setActiveNavLink() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll('.site-nav .nav-link').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    const isCurrent = href === '/' ? path === '/' : path.startsWith(href);
    link.toggleAttribute('aria-current', isCurrent);
  });
}

function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const nav = document.querySelector('.site-nav');
  if (!menuBtn || !nav) return;

  // Create overlay element
  let overlay = document.querySelector('.mobile-nav-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'mobile-nav-overlay';
    document.body.appendChild(overlay);
  }

  // Wrap nav in mobile-nav-sheet if not already
  if (!nav.parentElement.classList.contains('mobile-nav-sheet')) {
    const sheet = document.createElement('nav');
    sheet.className = 'mobile-nav-sheet';
    nav.parentElement.insertBefore(sheet, nav);
    sheet.appendChild(nav);
    sheet.setAttribute('id', 'mobile-nav-sheet');
  }
  const sheet = document.getElementById('mobile-nav-sheet');

  function openMenu() {
    menuBtn.setAttribute('aria-expanded', 'true');
    sheet.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    menuBtn.setAttribute('aria-expanded', 'false');
    sheet.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  menuBtn.addEventListener('click', () => {
    const isExpanded = menuBtn.getAttribute('aria-expanded') === 'true';
    if (isExpanded) closeMenu(); else openMenu();
  });

  overlay.addEventListener('click', closeMenu);

  // Close menu when clicking a nav link
  nav.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
}

(async () => {
  await inject('site-header', HEADER_URL);
  await inject('site-footer', FOOTER_URL);
  setActiveNavLink();
  initMobileMenu();
  bindProjectCtas();
})();
