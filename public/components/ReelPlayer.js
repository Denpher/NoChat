/**
 * NoChat v4 - Full-Screen Reel Player Component
 */

import { escapeHtml } from '../utils/dom.js';
import { formatCount } from '../utils/formatters.js';

export function renderReelItem(reel, currentUser = null, isFollowing = false) {
  const isLiked = Boolean(reel.isLiked || (reel.likes && reel.likes.includes(currentUser?.id)));
  const avatar = reel.user?.profilePicture || `https://api.dicebear.com/7.x/identicon/svg?seed=${reel.user?.username || 'user'}`;
  const username = escapeHtml(reel.user?.username || 'creator');
  const isVerified = Boolean(reel.user?.isVerified || reel.user?.verifiedBadge);
  const isOwnPending = String(reel.userId) === String(currentUser?.id) && reel.moderationStatus === 'pending';
  const audioTitle = escapeHtml(reel.audioTitle || 'Original Audio · Denpher Beats');

  return `
    <div class="reel-item" data-reel-id="${reel.id}">
      <video src="${reel.videoUrl}" loop muted playsinline class="reel-video" preload="metadata"></video>
      ${isOwnPending ? '<div class="reel-review-state" role="status">Uploaded · under review · only you can see this</div>' : ''}
      <div class="heart-burst"><i data-lucide="heart" style="width:80px;height:80px;fill:var(--like-red);"></i></div>

      <div class="reel-actions-column">
        <button class="reel-action-btn ${isLiked ? 'liked' : ''}" data-action="reel-like">
          <i data-lucide="heart" style="${isLiked ? 'fill:var(--like-red);' : ''}"></i>
          <span>${formatCount(reel.likesCount || 0)}</span>
        </button>

        <button class="reel-action-btn" data-action="reel-comment">
          <i data-lucide="message-circle"></i>
          <span>${formatCount(reel.commentsCount || 0)}</span>
        </button>

        <button class="reel-action-btn" data-action="reel-share">
          <i data-lucide="send"></i>
          <span>Share</span>
        </button>

        <button class="reel-action-btn" data-action="reel-save">
          <i data-lucide="bookmark"></i>
          <span>Save</span>
        </button>

        <div class="music-disc" title="${audioTitle}">
          <i data-lucide="music" style="width:16px;height:16px;color:#fff;"></i>
        </div>
      </div>

      <div class="reel-bottom-info">
        <div class="reel-user-row">
          <img src="${avatar}" alt="${username}" class="reel-avatar" />
          <span class="reel-username user-id-hint" data-user-id="${escapeHtml(reel.userId || '')}" title="User ID: ${escapeHtml(reel.userId || '')}">@${username}</span>
          ${isVerified ? `<i data-lucide="badge-check" style="width:16px;height:16px;color:var(--verified-mint);"></i>` : ''}
          ${currentUser && currentUser.id !== reel.userId ? `
            <button class="btn-follow-pill ${isFollowing ? 'following' : ''}" data-action="toggle-follow" data-user-id="${reel.userId}">
              ${isFollowing ? 'Following' : 'Follow'}
            </button>
          ` : ''}
        </div>

        ${reel.caption ? `<p class="reel-caption-text">${escapeHtml(reel.caption)}</p>` : ''}

        <div class="reel-audio-track">
          <i data-lucide="music" style="width:14px;height:14px;"></i>
          <span>${audioTitle}</span>
        </div>
      </div>
    </div>
  `;
}
