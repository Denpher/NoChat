/**
 * NoChat v4 - 56px Story Circle Component
 */

import { escapeHtml } from '../utils/dom.js';

export function renderStoryCircle(user, hasUnseen = true) {
  const avatar = user?.profilePicture || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.username || 'user'}`;
  const username = escapeHtml(user?.username || 'user');
  const userId = escapeHtml(user?.id || '');

  return `
    <div class="story-circle" data-user-id="${user?.id || ''}">
      <div class="story-ring" style="${!hasUnseen ? 'background: var(--border-light);' : ''}">
        <img src="${avatar}" alt="${username}" class="story-avatar" />
      </div>
      <span class="story-username user-id-hint" data-user-id="${userId}">${username}</span>
    </div>
  `;
}
