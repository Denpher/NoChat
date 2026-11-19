/**
 * NoChat v4 - 56px Story Circle Component
 */

import { escapeHtml } from '../utils/dom.js';

export function renderStoryCircle(user, hasUnseen = true) {
  const avatar = user?.profilePicture || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.username || 'user'}`;
  const username = escapeHtml(user?.username || 'user');
  const userId = escapeHtml(user?.id || '');
  const displayName = escapeHtml(user?.displayName || user?.username || '');
  const bio = escapeHtml(user?.bio || 'No bio yet');
  const posts = Number(user?.postsCount || 0), followers = Number(user?.followersCount || 0), following = Number(user?.followingCount || 0);

  return `
    <div class="story-circle" data-user-id="${user?.id || ''}">
      <div class="story-ring" style="${!hasUnseen ? 'background: var(--border-light);' : ''}">
        <img src="${avatar}" alt="${username}" class="story-avatar" />
      </div>
      <span class="story-username user-id-hint" data-user-id="${userId}">${username}</span><div class="ig-user-preview ig-story-preview" role="tooltip"><div class="ig-preview-head"><img src="${avatar}" alt=""/><div><strong>@${username}</strong><small>${displayName}</small></div></div><div class="ig-preview-stats"><span><b>${posts}</b> posts</span><span><b>${followers}</b> followers</span><span><b>${following}</b> following</span></div><p>${bio}</p><a class="ig-preview-profile-link" href="#/profile/${user?.id || ''}">View profile</a></div>
    </div>
  `;
}
