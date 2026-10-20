/**
 * site/js/admin/login.js
 * Admin sign-in interaction.
 *
 * The portal is guarded by Supabase Auth. A session is granted only when
 * Supabase confirms the credentials — there is no local fallback, so a failed
 * sign-in never reaches the dashboard.
 */

import { adminSignIn } from './supabase-client.js';

const ERROR_MESSAGES = {
  invalid_credentials: 'That email and password combination is not correct.',
  network: 'The portal could not reach the studio backend. Check your connection and try again.'
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.style.display = 'none';

    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    if (!email || !password) {
      showError(errorEl, 'Please enter both email and password.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in…';

    try {
      const { session, error } = await adminSignIn(email, password);

      if (!session) {
        const message = error?.message || '';
        const isCredentialError = /invalid login credentials/i.test(message);
        showError(
          errorEl,
          isCredentialError
            ? ERROR_MESSAGES.invalid_credentials
            : ERROR_MESSAGES.network
        );
        return;
      }

      window.location.href = '/admin/dashboard.html';
    } catch (err) {
      console.warn('Supabase connection error:', err);
      showError(errorEl, ERROR_MESSAGES.network);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In to Portal';
    }
  });
});

/**
 * Shows the inline error banner.
 * @param {HTMLElement|null} errorEl - The banner element.
 * @param {string} message - The message to show.
 */
function showError(errorEl, message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}
