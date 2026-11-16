/**
 * NoChat v4 - Post Card Component (470px Premium Feed)
 */

import { escapeHtml } from '../utils/dom.js';
import { formatTimeAgo, formatCount } from '../utils/formatters.js';

export function renderPostCard(post, currentUser = null) {
  const isLiked = Boolean(post.isLiked || (post.likes && post.likes.includes(currentUser?.id)));
  const avatar = post.user?.profilePicture || `https://api.dicebear.com/7.x/identicon/svg?seed=${post.user?.username || 'user'}`;
  const username = escapeHtml(post.user?.username || 'user');
  const isVerified = Boolean(post.user?.isVerified || post.user?.verifiedBadge);
  const mediaUrl = post.videoUrl || post.imageUrl || post.mediaUrl || '';
  const isVideo = Boolean(post.videoUrl || mediaUrl.endsWith('.mp4') || mediaUrl.includes('/reels/'));

  return `
    <article class="post-card" data-post-id="${post.id}">
      <header class="post-header">
        <div class="post-user">
          <img src="${avatar}" alt="${username}" class="post-avatar" />
          <div class="post-username">
            <a href="#/profile/${post.user?.id || ''}">${username}</a>
            ${isVerified ? `<i data-lucide="badge-check" style="width:16px;height:16px;color:var(--verified-mint);"></i>` : ''}
          </div>
        </div>
        <span class="post-time">${formatTimeAgo(post.createdAt)}</span>
      </header>

      <div class="post-media-container" data-action="double-tap-like">
        ${isVideo ? `
          <video src="${mediaUrl}" loop playsinline muted autoplay class="post-video"></video>
        ` : `
          <img src="${mediaUrl || '/icons/icon-512.png'}" alt="Post media" loading="lazy" />
        `}
        <div class="heart-burst"><i data-lucide="heart" style="width:72px;height:72px;fill:var(--like-red);"></i></div>
      </div>

      <div class="post-actions">
        <div class="post-action-group">
          <button class="post-action-btn ${isLiked ? 'liked' : ''}" data-action="toggle-like" aria-label="Like">
            <i data-lucide="heart" style="${isLiked ? 'fill:var(--like-red);' : ''}"></i>
          </button>
          <button class="post-action-btn" data-action="open-comments" aria-label="Comment">
            <i data-lucide="message-circle"></i>
          </button>
          <button class="post-action-btn" data-action="share-post" aria-label="Share">
            <i data-lucide="send"></i>
          </button>
        </div>
        <button class="post-action-btn" data-action="bookmark-post" aria-label="Save">
          <i data-lucide="bookmark"></i>
        </button>
      </div>

      <div class="post-body">
        <div class="post-likes">${formatCount(post.likesCount || (post.likes?.length || 0))} likes</div>
        ${post.caption ? `
          <div class="post-caption">
            <strong>${username}</strong>${escapeHtml(post.caption)}
          </div>
        ` : ''}
        <div class="post-comments-link" data-action="open-comments">
          View all ${formatCount(post.commentsCount || 0)} comments
        </div>
      </div>
    </article>
  `;
}
