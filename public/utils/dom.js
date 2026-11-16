/**
 * NoChat v4 - DOM Utilities
 */

export const $ = (selector, context = document) => context?.querySelector(selector) ?? null;
export const $$ = (selector, context = document) => context ? [...context.querySelectorAll(selector)] : [];

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function toast(message, durationMs = 3200) {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const pill = document.createElement('div');
  pill.className = 'toast-pill';
  pill.textContent = String(message);
  container.appendChild(pill);

  setTimeout(() => {
    pill.style.opacity = '0';
    pill.style.transform = 'translateY(10px)';
    pill.style.transition = 'all 200ms ease';
    setTimeout(() => pill.remove(), 250);
  }, durationMs);
}

export function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}
