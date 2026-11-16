/**
 * NoChat v4 - System Announcement & 24h New User Welcome Banner
 */

import { escapeHtml } from '../utils/dom.js';

export function renderWelcomeBanner(user) {
  if (!user) return '';
  const createdAtMs = new Date(user.createdAt || 0).getTime();
  const isNew = Date.now() - createdAtMs < 24 * 3600 * 1000;
  if (!isNew) return '';

  return `
    <div class="welcome-banner" style="background:linear-gradient(90deg, rgba(0,149,246,0.15), rgba(16,185,129,0.15)); border:1px solid var(--accent-blue); border-radius:var(--radius-card); padding:16px 20px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="font-size:24px;">🎉</div>
        <div>
          <h4 style="font-size:14px; font-weight:700; color:#fff;">Welcome to NoChat, ${escapeHtml(user.displayName || user.username)}!</h4>
          <p style="font-size:12px; color:var(--muted);">You are verified as Human #${user.memberNumber || 22}. Real people only. No algorithms deciding what you see.</p>
        </div>
      </div>
      <button class="btn-icon" data-action="dismiss-welcome"><i data-lucide="x"></i></button>
    </div>
  `;
}

export function renderAnnouncementBanner(announcement) {
  if (!announcement || announcement.dismissed) return '';

  return `
    <div class="announcement-banner" style="background:var(--surface); border:1px solid var(--border-light); border-left:4px solid var(--verified-mint); border-radius:var(--radius-card); padding:14px 20px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center; gap:12px;">
        <i data-lucide="megaphone" style="color:var(--verified-mint); width:20px; height:20px;"></i>
        <div>
          <strong style="font-size:13px; color:#fff;">${escapeHtml(announcement.title || 'Official Announcement')}</strong>
          <span style="font-size:13px; color:var(--muted); margin-left:8px;">${escapeHtml(announcement.message || '')}</span>
        </div>
      </div>
      <button class="btn-icon" data-action="dismiss-announcement" style="width:28px; height:28px;"><i data-lucide="x" style="width:14px;height:14px;"></i></button>
    </div>
  `;
}
