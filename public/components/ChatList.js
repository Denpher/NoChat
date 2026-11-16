/**
 * NoChat v4 - 72px Chat List Row Component
 */

import { escapeHtml } from '../utils/dom.js';
import { formatTimeAgo } from '../utils/formatters.js';

export function renderChatList(conversations = [], activeConvoId = null, onlineUserIds = new Set(), currentUserId = null) {
  if (conversations.length === 0) {
    return `<div style="text-align:center; padding:48px 20px; color:var(--muted); font-size:14px;">No messages yet.<br>Start chatting with real humans!</div>`;
  }

  return conversations.map(c => {
    const isOther = c.otherUser || c.recipient || (c.members || []).find(id => id !== currentUserId);
    const otherUser = c.otherUser || (typeof isOther === 'object' ? isOther : { id: isOther, username: 'user' });
    const isOnline = onlineUserIds.has(otherUser?.id);
    const avatar = otherUser?.profilePicture || `https://api.dicebear.com/7.x/identicon/svg?seed=${otherUser?.username || 'chat'}`;
    const username = escapeHtml(otherUser?.displayName || otherUser?.username || 'Chat');
    const isActive = c.id === activeConvoId;
    const lastMsg = c.lastMessage || c.latestMessage || (c.messages && c.messages[c.messages.length - 1]);
    const snippet = lastMsg ? (lastMsg.text || (lastMsg.sharedReel ? 'Shared a reel' : 'Attachment')) : 'Start a chat';
    const time = lastMsg?.createdAt ? formatTimeAgo(lastMsg.createdAt) : '';
    const unread = Number(c.unreadCount) || 0;

    return `
      <div class="chat-row ${isActive ? 'active' : ''}" data-convo-id="${c.id}">
        <div class="chat-avatar-wrap">
          <img src="${avatar}" alt="${username}" class="chat-avatar" />
          ${isOnline ? `<div class="online-dot"></div>` : ''}
        </div>
        <div class="chat-row-info">
          <div class="chat-row-top">
            <span class="chat-row-name">${username}</span>
            <span class="chat-row-time">${time}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="chat-row-snippet">${escapeHtml(snippet)}</span>
            ${unread > 0 ? `<span class="badge badge-red">${unread}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}
