/**
 * NoChat v4 - Post Card Component (470px Premium Feed)
 */

import { escapeHtml } from '../utils/dom.js';
import { formatTimeAgo, formatCount } from '../utils/formatters.js';

export function renderPostCard(post, currentUser = null) {
  const isLiked = Boolean(post.isLiked || (post.likes && post.likes.includes(currentUser?.id)));
  const avatar = post.user?.profilePicture || `https://api.dicebear.com/7.x/identicon/svg?seed=${post.user?.username || 'user'}`;
  const username = escapeHtml(post.user?.username || 'user');
  const userId = escapeHtml(post.user?.id || post.userId || '');
  const isVerified = Boolean(post.user?.isVerified || post.user?.verifiedBadge);
  const hoverUser = post.user || {};
  const hoverBio = escapeHtml(hoverUser.bio || 'No bio yet');
  const hoverPosts = Number(hoverUser.postsCount || 0);
  const hoverFollowers = Number(hoverUser.followersCount || 0);
  const hoverFollowing = Number(hoverUser.followingCount || 0);
  const mediaUrl = post.videoUrl || post.imageUrl || post.mediaUrl || '';
  const isVideo = Boolean(post.videoUrl || mediaUrl.endsWith('.mp4') || mediaUrl.includes('/reels/'));

  return `
    <article class="post-card" data-post-id="${post.id}">
      <header class="post-header">
        <div class="post-user">
          <img src="${avatar}" alt="${username}" class="post-avatar" />
          <div class="post-username">
            <a href="#/profile/${post.user?.id || ''}">${username}</a>
            <div class="ig-user-preview" role="tooltip"><div class="ig-preview-head"><img src="${avatar}" alt=""/><div><strong>@${username}</strong>${isVerified ? '<span class="ig-preview-verified">✓ Verified</span>' : ''}</div></div><div class="ig-preview-stats"><span><b>${hoverPosts}</b> posts</span><span><b>${hoverFollowers}</b> followers</span><span><b>${hoverFollowing}</b> following</span></div><p>${hoverBio}</p><a class="ig-preview-profile-link" href="#/profile/${post.user?.id || ''}">View profile</a></div>
            ${isVerified ? `<span class="ig-verified-badge" role="img" aria-label="Verified"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="ig-verified-shape" d="M12 1.2 14.2 2.6 16.8 2.3 18 4.7 20.4 5.8 20.1 8.4 21.5 10.6 20.1 12.8 20.4 15.4 18 16.5 16.8 18.9 14.2 18.6 12 20 9.8 18.6 7.2 18.9 6 16.5 3.6 15.4 3.9 12.8 2.5 10.6 3.9 8.4 3.6 5.8 6 4.7 7.2 2.3 9.8 2.6Z"/><path class="ig-verified-check" d="m7.8 10.9 2.7 2.7 5.8-5.8"/></svg></span>` : ''}
          </div>
        </div>
        <span class="post-time">${formatTimeAgo(post.createdAt)}</span>
      </header>

      <div class="post-media-container" data-action="double-tap-like">
        ${isVideo ? `
          <video src="${mediaUrl}" loop playsinline muted preload="metadata" class="post-video"></video>
        ` : `
          <img class="post-media-image" data-post-media src="${mediaUrl || '/icons/icon-512.png'}" alt="Post media" loading="lazy" />
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
