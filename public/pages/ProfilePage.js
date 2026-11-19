/**
 * NoChat v4 - Profile Page (150px Avatar, Human #21, 3-Column Grid)
 */

import { escapeHtml } from '../utils/dom.js';
import { formatMemberNumber, formatVerifiedCountdown, formatCount } from '../utils/formatters.js';
import { renderFooter } from '../components/Footer.js';

export function renderProfilePage({
  profileUser,
  currentUser = null,
  posts = [],
  reels = [],
  savedPosts = [],
  activeTab = 'posts',
  isFollowing = false
}) {
  const user = profileUser || currentUser || {};
  const isSelf = currentUser && currentUser.id === user.id;
  const avatar = user.profilePicture || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username || 'user'}`;
  const username = escapeHtml(user.username || 'user');
  const userId = escapeHtml(user.id || '');
  const displayName = escapeHtml(user.displayName || user.username || 'Human');
  const isVerified = Boolean(user.isVerified || user.verifiedBadge);
  const memberText = formatMemberNumber(user.memberNumber || 21);
  const verifiedCountdown = user.verifiedUntil ? formatVerifiedCountdown(user.verifiedUntil) : (isVerified ? 'Permanent' : null);

  const currentItems = activeTab === 'reels' ? reels : activeTab === 'saved' ? savedPosts : posts;

  return `
    <div class="profile-container">
      <header class="profile-header">
        <div class="profile-avatar-wrap">
          <img src="${avatar}" alt="${displayName}" class="profile-avatar" />
        </div>

        <div class="profile-details">
          <div class="profile-top-row">
            <h2 class="profile-username">@${username}</h2>
            ${isVerified ? `
              <div title="Verified Human · ${verifiedCountdown}" style="display:inline-flex; align-items:center;">
                <span class="ig-verified-badge ig-verified-badge-lg" role="img" aria-label="Verified"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="ig-verified-shape" d="M12 1.2 14.2 2.6 16.8 2.3 18 4.7 20.4 5.8 20.1 8.4 21.5 10.6 20.1 12.8 20.4 15.4 18 16.5 16.8 18.9 14.2 18.6 12 20 9.8 18.6 7.2 18.9 6 16.5 3.6 15.4 3.9 12.8 2.5 10.6 3.9 8.4 3.6 5.8 6 4.7 7.2 2.3 9.8 2.6Z"/><path class="ig-verified-check" d="m7.8 10.9 2.7 2.7 5.8-5.8"/></svg></span>
              </div>
            ` : ''}
            <span class="member-pill">${memberText}</span>

            ${isSelf ? `
              <button class="btn btn-secondary btn-sm" data-action="open-edit-profile">Edit profile</button>
            ` : `
              <button class="btn btn-primary btn-sm ${isFollowing ? 'btn-secondary' : ''}" data-action="toggle-follow" data-user-id="${user.id}">
                ${isFollowing ? 'Following' : 'Follow'}
              </button>
              <button class="btn btn-secondary btn-sm" data-action="message-user" data-user-id="${user.id}">Message</button>
            `}
          </div>

          <div class="profile-stats-row">
            <div class="profile-stat"><strong>${formatCount(posts.length + reels.length)}</strong> posts</div>
            <div class="profile-stat"><strong>${formatCount(user.followersCount || user.subscribersCount || 0)}</strong> followers</div>
            <div class="profile-stat"><strong>${formatCount(user.followingCount || 0)}</strong> following</div>
          </div>

          <div class="profile-bio">
            <div style="font-weight:700; margin-bottom:2px;">${displayName}</div>
            ${user.bio ? `<p style="white-space:pre-line; color:var(--text);">${escapeHtml(user.bio)}</p>` : ''}
            ${user.role ? `<div style="font-size:12px; color:var(--muted); margin-top:4px;">${escapeHtml(user.role)}</div>` : ''}
            ${user.verifiedUntil ? `<div style="font-size:12px; color:var(--verified-mint); margin-top:2px;">⭐ Verified Badge active: ${verifiedCountdown}</div>` : ''}
          </div>
        </div>
      </header>

      <!-- Profile Tabs -->
      <nav class="profile-tabs">
        <button class="profile-tab ${activeTab === 'posts' ? 'active' : ''}" data-tab="posts">
          <i data-lucide="grid"></i>
          <span>Posts</span>
        </button>
        <button class="profile-tab ${activeTab === 'reels' ? 'active' : ''}" data-tab="reels">
          <i data-lucide="clapperboard"></i>
          <span>Reels</span>
        </button>
        ${isSelf ? `
          <button class="profile-tab ${activeTab === 'saved' ? 'active' : ''}" data-tab="saved">
            <i data-lucide="bookmark"></i>
            <span>Saved</span>
          </button>
        ` : ''}
      </nav>

      <!-- 3-Column Square Grid -->
      <main class="profile-grid">
        ${currentItems.length === 0 ? `
          <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--muted);">
            <div style="width:56px; height:56px; border-radius:50%; border:2px solid var(--border); display:flex; align-items:center; justify-content:center; margin:0 auto 12px;">
              <i data-lucide="camera" style="width:24px; height:24px;"></i>
            </div>
            <h3 style="font-size:16px; font-weight:700; color:var(--text); margin-bottom:4px;">No ${activeTab} yet</h3>
            <p style="font-size:13px;">When media is posted, it will appear here.</p>
          </div>
        ` : currentItems.map(item => `
          <div class="grid-item" data-item-id="${escapeHtml(item.id)}" data-type="${item.isPost !== true && item.videoUrl ? 'reel' : 'post'}" ${item.isPost !== true && item.videoUrl ? `role="button" tabindex="0" aria-label="Open reel by @${username}" title="@${username} · User ID: ${escapeHtml(item.userId || user.id || '')}"` : ''}>
            ${item.isPost !== true && item.videoUrl ? `
              <span class="profile-grid-username" title="User ID: ${escapeHtml(item.userId || user.id || '')}">@${username}</span>` : ''}
            ${item.videoUrl ? `
              <video src="${item.videoUrl}#t=0.1" preload="metadata" muted playsinline></video>
              <div style="position:absolute; top:8px; right:8px; color:#fff; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8));">
                <i data-lucide="clapperboard" style="width:18px;height:18px;"></i>
              </div>
            ` : `
              <img src="${item.imageUrl || item.thumbnailUrl || item.mediaUrl || '/icons/icon-512.png'}" alt="Media thumbnail" loading="lazy" />
            `}
          </div>
        `).join('')}
      </main>
    </div>
    ${renderFooter()}
  `;
}
