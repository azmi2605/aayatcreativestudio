/**
 * site/js/pages/contact.js
 * Project brief submission handling according to API.md section 6 and contracts/enquiry-contract.json
 * Generates client submissionId (UUID v4), validates inputs, posts to submit-enquiry endpoint
 */

import { getConfig } from '../config.js';

let submissionId = generateUUID();

document.addEventListener('DOMContentLoaded', async () => {
  await initCategoryPills();
  initCharCounter();
  initFormSubmission();
});

async function initCategoryPills() {
  const grid = document.getElementById('category-options');
  const empty = document.getElementById('category-empty');
  const select = document.getElementById('service');
  if (!grid) return;

  let categories = [];
  try {
    categories = await fetchCategories();
  } catch (e) {
    console.warn('[contact.js] Failed to fetch categories:', e.message);
  }

  // Render dynamic pills + hidden fallback select from the shared list.
  grid.innerHTML = '';
  if (select) select.innerHTML = '<option value="">Select a creative focus...</option>';

  if (categories.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  categories.forEach((cat) => {
    const value = cat.value;
    const label = cat.label;

    const pill = document.createElement('label');
    pill.className = 'category-pill';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'services';
    input.value = value;
    const span = document.createElement('span');
    span.textContent = label;
    pill.appendChild(input);
    pill.appendChild(span);
    grid.appendChild(pill);

    if (select) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    }
  });

  // Delegated change listener keeps the hidden fallback select in sync.
  grid.addEventListener('change', () => {
    const checkedBoxes = Array.from(document.querySelectorAll('input[name="services"]:checked'));
    if (select && checkedBoxes.length > 0) {
      select.value = checkedBoxes[0].value;
    }
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

