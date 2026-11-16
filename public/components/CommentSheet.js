/**
 * NoChat v4 - Comments Bottom Sheet Drawer
 */

import { escapeHtml } from '../utils/dom.js';
import { formatTimeAgo } from '../utils/formatters.js';

export function renderCommentSheet(comments = [], targetTitle = 'Comments') {
  return `
    <div class="bottom-sheet" id="comment-sheet">
      <div class="sheet-backdrop" data-action="close-sheet"></div>
      <div class="sheet-content">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <h3 style="font-size:15px; font-weight:700;">${targetTitle}</h3>
          <button type="button" class="btn-icon" data-action="close-sheet" aria-label="Close comments"><i data-lucide="x"></i></button>
        </div>
        
        <div class="sheet-body" id="sheet-comments-list">
          ${comments.length === 0 ? `
            <div class="v4-no-comments" style="text-align:center; padding:40px 0; color:var(--muted);">No comments yet. Start the conversation!</div>
          ` : comments.map(c => `
            <div class="comment-item" style="display:flex; gap:12px; font-size:13px;">
              <img src="${c.user?.profilePicture || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.user?.username || 'user'}`}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" />
              <div style="flex:1;">
                <div style="margin-bottom:2px;">
                  <strong style="margin-right:6px;">${escapeHtml(c.user?.username || 'user')}</strong>
                  <span>${escapeHtml(c.text)}</span>
                </div>
                <span style="font-size:11px; color:var(--muted);">${formatTimeAgo(c.createdAt)}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <form class="sheet-input-row" id="comment-form">
          <input type="text" name="text" placeholder="Add a comment..." required style="flex:1; height:38px; padding:0 14px; border-radius:19px;" />
          <button type="submit" class="btn btn-primary btn-sm" style="height:38px; border-radius:19px;">Post</button>
        </form>
      </div>
    </div>
  `;
}
