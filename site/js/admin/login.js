/**
 * site/js/admin/login.js
 * Admin sign-in interaction and session handling
 */

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

    btn.disabled = true;
    btn.textContent = 'Verifying...';

    // Demo / Initial check
    setTimeout(() => {
      // If local credentials or demo access
      if (email && password) {
        // Save local session state
        sessionStorage.setItem('aayat_admin_authenticated', 'true');
        sessionStorage.setItem('aayat_admin_email', email);
        window.location.href = '/admin/dashboard.html';
      } else {
        btn.disabled = false;
        btn.textContent = 'Sign In to Portal';
        if (errorEl) errorEl.style.display = 'block';
      }
    }, 600);
  });
});
