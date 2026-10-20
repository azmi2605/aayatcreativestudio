/**
 * site/js/pages/contact.js
 * Project brief submission handling according to API.md section 6 and contracts/enquiry-contract.json
 * Generates client submissionId (UUID v4), validates inputs, posts to submit-enquiry endpoint
 */

import { getConfig } from '../config.js';

let submissionId = generateUUID();

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initCharCounter();
  initCategoryPills();
  initFormSubmission();
});

function initCategoryPills() {
  const pills = document.querySelectorAll('.category-pill');
  pills.forEach((pill) => {
    const checkbox = pill.querySelector('input[type="checkbox"]');
    if (!checkbox) return;

    const updateState = () => {
      pill.classList.toggle('active', checkbox.checked);
      const checkedBoxes = Array.from(document.querySelectorAll('input[name="services"]:checked'));
      const select = document.getElementById('service');
      if (select && checkedBoxes.length > 0) {
        select.value = checkedBoxes[0].value;
      }
    };

    checkbox.addEventListener('change', updateState);
    updateState();
  });
}

function initCharCounter() {
  const textarea = document.getElementById('projectDetails');
  const counter = document.getElementById('char-counter');
  if (!textarea || !counter) return;

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / 1000`;
  });
}

function initFormSubmission() {
  const form = document.getElementById('enquiry-form');
  const submitBtn = document.getElementById('submit-btn');
  const banner = document.getElementById('form-banner');

  if (!form || !submitBtn || !banner) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    // Check honeypot immediately
    const hp = document.getElementById('website').value;
    if (hp && hp.trim().length > 0) {
      // Spam hit: pretend success
      showBanner(banner, 'success', 'Thank you! Your creative brief has been received. We will contact you soon.');
      form.reset();
      document.querySelectorAll('.category-pill').forEach((p) => p.classList.remove('active'));
      return;
    }

    const checkedServices = Array.from(
      document.querySelectorAll('input[name="services"]:checked')
    ).map((cb) => cb.value);
    const fallbackService = document.getElementById('service')?.value || '';
    const selectedService = checkedServices[0] || fallbackService;

    const payload = {
      submissionId: submissionId,
      name: document.getElementById('name').value.trim(),
      brandName: document.getElementById('brandName').value.trim(),
      email: document.getElementById('email').value.trim().toLowerCase(),
      phone: document.getElementById('phone').value.trim() || null,
      service: selectedService,
      services: checkedServices.length > 0 ? checkedServices : (selectedService ? [selectedService] : []),
      budgetRange: document.getElementById('budgetRange').value || 'not_sure_yet',
      projectDetails: document.getElementById('projectDetails').value.trim(),
      referenceLink: document.getElementById('referenceLink').value.trim() || null,
      timeline: document.getElementById('timeline').value.trim() || null,
      website: ""
    };

    // Client-side validation against contract rules
    const errors = validatePayload(payload);
    if (errors.length > 0) {
      highlightErrors(errors);
      showBanner(banner, 'error', 'Please correct the highlighted fields before submitting.');
      return;
    }

    // Set loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting Brief...';

    try {
      const config = getConfig();
      const response = await fetch(config.enquiryEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.supabaseAnonKey
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showBanner(banner, 'success', 'Thank you! Your creative brief has been submitted successfully. We will be in touch shortly.');
        form.reset();
        document.querySelectorAll('.category-pill').forEach((p) => p.classList.remove('active'));
        // Generate fresh ID for any subsequent submission
        submissionId = generateUUID();
        const counter = document.getElementById('char-counter');
        if (counter) counter.textContent = '0 / 1000';
      } else if (response.status === 429) {
        showBanner(banner, 'error', 'Too many recent submissions. Please try again later or email us directly at aayatcreativestudio@gmail.com.');
      } else {
        const result = await response.json().catch(() => ({}));
        showBanner(banner, 'error', result.message || 'Unable to submit your brief right now. Please try again or reach out on Instagram.');
      }
    } catch (err) {
      console.error('Submission network error:', err);
      showBanner(banner, 'error', 'Network connection issue. Please check your internet or reach us directly at aayatcreativestudio@gmail.com.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Project Brief';
    }
  });
}

function validatePayload(p) {
  const errors = [];
  if (!p.name || p.name.length < 1 || p.name.length > 100) errors.push('name');
  if (!p.brandName || p.brandName.length < 1 || p.brandName.length > 100) errors.push('brandName');
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!p.email || !emailRegex.test(p.email) || p.email.length > 254) errors.push('email');

  if (!p.service && (!p.services || p.services.length === 0)) errors.push('service');
  if (!p.projectDetails || p.projectDetails.length < 20 || p.projectDetails.length > 1000) errors.push('projectDetails');

  if (p.referenceLink) {
    if (!p.referenceLink.startsWith('http://') && !p.referenceLink.startsWith('https://')) {
      errors.push('referenceLink');
    }
  }

  return errors;
}

function highlightErrors(fieldNames) {
  fieldNames.forEach(fieldName => {
    const errorMsg = document.getElementById(`${fieldName}-error`);
    const input = document.getElementById(fieldName);
    if (errorMsg) errorMsg.style.display = 'block';
    if (input) input.style.borderColor = 'var(--cs-color-error)';
  });
}

function clearErrors() {
  document.querySelectorAll('.form-error-msg').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => el.style.borderColor = '');
}

function showBanner(banner, type, text) {
  banner.className = `status-banner ${type}`;
  banner.textContent = text;
  banner.style.display = 'block';
  banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
