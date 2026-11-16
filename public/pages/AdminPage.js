/**
 * NoChat v4 - Admin & Moderation Console
 * Strictly restricted to denpherai@gmail.com (Founder)
 */

import { escapeHtml } from '../utils/dom.js';
import { formatTimeAgo } from '../utils/formatters.js';
import { renderFooter } from '../components/Footer.js';

export function renderAdminPage({ users = [], reviewReels = [], currentUser = null }) {
  const isFounder = Boolean(
    currentUser && (
      (currentUser.email && currentUser.email.toLowerCase() === 'denpherai@gmail.com') ||
      currentUser.username === 'denpher' ||
      currentUser.id === 'denpher-official-founder-id'
    )
  );

  if (!isFounder) {
    return `
      <div style="max-width:600px; margin:80px auto; text-align:center; padding:40px 24px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-card);">
        <i data-lucide="shield-alert" style="width:48px;height:48px;color:var(--like-red); margin-bottom:16px;"></i>
        <h2 style="font-size:22px; font-weight:800; margin-bottom:8px;">Access Restricted</h2>
        <p style="color:var(--muted); font-size:14px; margin-bottom:24px;">
          Only <strong>denpherai@gmail.com</strong> (Official Founder) can access the NoChat Admin Console and Content Moderation.
        </p>
        <a href="#/home" class="btn btn-secondary">Return to Home</a>
      </div>
      ${renderFooter()}
    `;
  }

  return `
    <div class="admin-container">
      <header class="admin-header">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <div class="badge badge-mint" style="margin-bottom:8px;">Founder Console · denpherai@gmail.com</div>
            <h1 style="font-size:28px; font-weight:800; letter-spacing:-0.5px;">NoChat Administrator</h1>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-primary btn-sm" data-action="open-announcement-modal">
              <i data-lucide="megaphone"></i> Post Announcement
            </button>
          </div>
        </div>
      </header>

      <section class="v4-admin-review-section">
        <div class="v4-admin-section-heading"><div><span>CONTENT SAFETY</span><h2>Reel moderation</h2></div><strong>${reviewReels.length} awaiting review</strong></div>
        ${reviewReels.length ? `<div class="v4-admin-review-grid">${reviewReels.map(reel=>`<article class="v4-admin-review-card" data-review-reel="${escapeHtml(reel.id)}"><video src="${escapeHtml(reel.videoUrl||'')}" controls playsinline preload="metadata"></video><div><strong>@${escapeHtml(reel.user?.username||'human')}</strong><p>${escapeHtml(reel.caption||'No caption')}</p><small>${escapeHtml(reel.moderationReason||'Reported content')} · ${formatTimeAgo(reel.createdAt)}</small><footer><button type="button" class="btn btn-primary" data-action="moderate-reel" data-reel-id="${escapeHtml(reel.id)}" data-status="approved">Approve</button><button type="button" class="btn btn-danger" data-action="moderate-reel" data-reel-id="${escapeHtml(reel.id)}" data-status="blocked">Block</button></footer></div></article>`).join('')}</div>` : '<div class="v4-admin-review-empty">No reels need review right now.</div>'}
      </section>

      <!-- Users Overview Section -->
      <section style="margin-bottom:40px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h2 style="font-size:18px; font-weight:700;">Human Directory (${users.length} Registered)</h2>
          <input type="text" id="admin-user-search" placeholder="Search by username or ID..." style="width:260px; height:36px; padding:0 12px;" />
        </div>

        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Username</th>
                <th>Role / Status</th>
                <th>Verified Badge</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="admin-users-tbody">
              ${users.map(u => `
                <tr data-user-id="${u.id}">
                  <td><strong>#${u.memberNumber || '1'}</strong></td>
                  <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <img src="${u.profilePicture || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.username}`}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" />
                      <span>@${escapeHtml(u.username)}</span>
                      ${u.isVerified ? `<i data-lucide="badge-check" style="width:16px;height:16px;color:var(--verified-mint);"></i>` : ''}
                    </div>
                  </td>
                  <td>
                    <span class="badge ${u.status === 'banned' ? 'badge-red' : 'badge-blue'}">${u.status || 'active'}</span>
                  </td>
                  <td>
                    ${u.isVerified ? (u.verifiedUntil ? `Exp: ${formatTimeAgo(u.verifiedUntil)}` : 'Permanent') : 'None'}
                  </td>
                  <td>${formatTimeAgo(u.createdAt)}</td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-secondary btn-sm" style="height:28px; padding:0 8px; font-size:11px;" data-action="admin-verify-user" data-user-id="${u.id}">
                        Verify
                      </button>
                      ${u.id !== currentUser.id ? `
                        <button class="btn btn-danger btn-sm" style="height:28px; padding:0 8px; font-size:11px;" data-action="admin-ban-user" data-user-id="${u.id}" data-username="${u.username}">
                          Ban
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Give Verified Modal -->
    <div class="modal-overlay hidden" id="verify-modal">
      <div class="modal-box" style="padding:24px;">
        <h3 style="font-size:16px; font-weight:700; margin-bottom:12px;">Grant Verified Human Badge</h3>
        <p style="font-size:13px; color:var(--muted); margin-bottom:16px;">
          Choose badge duration for <strong id="verify-modal-username"></strong>:
        </p>
        <form id="verify-duration-form" style="display:flex; flex-direction:column; gap:12px;">
          <input type="hidden" id="verify-target-user-id" />
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="radio" name="duration" value="5d" checked />
            <span>5 Days (Auto-Expires)</span>
          </label>
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="radio" name="duration" value="30d" />
            <span>30 Days (Auto-Expires)</span>
          </label>
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="radio" name="duration" value="perm" />
            <span>Permanent Badge</span>
          </label>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
            <button type="button" class="btn btn-secondary btn-sm" data-action="close-verify-modal">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm">Save Badge</button>
          </div>
        </form>
      </div>
    </div>

    ${renderFooter()}
  `;
}
