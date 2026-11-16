/**
 * NoChat v4 - Chat Window Component (Bubbles, Reactions, Reel Cards)
 */

import { escapeHtml } from '../utils/dom.js';
import { formatTimeAgo } from '../utils/formatters.js';

export function renderChatWindow(conversation, messages = [], currentUserId = null, isRecipientOnline = false) {
  if (!conversation) {
    return `
      <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--muted); text-align:center; padding:24px;">
        <div style="width:80px; height:80px; border-radius:50%; border:2px solid var(--border); display:flex; align-items:center; justify-content:center; margin-bottom:16px;">
          <i data-lucide="message-circle" style="width:36px; height:36px;"></i>
        </div>
        <h2 style="font-size:20px; font-weight:700; color:var(--text); margin-bottom:8px;">Your Messages</h2>
        <p>Send private messages, share reels, or start a video call with real humans.</p>
      </div>
    `;
  }

  const recipient = conversation.otherUser || { username: 'Friend', displayName: 'Friend' };
  const recipientName = escapeHtml(recipient.displayName || recipient.username);
  const avatar = recipient.profilePicture || `https://api.dicebear.com/7.x/identicon/svg?seed=${recipient.username}`;

  return `
    <div class="chat-main">
      <header class="chat-header">
        <button type="button" class="chat-mobile-back" data-action="mobile-chat-back" aria-label="Back to conversations">‹</button>
        <div class="chat-recipient">
          <img src="${avatar}" alt="${recipientName}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" />
          <div>
            <div style="font-weight:700; font-size:15px; display:flex; align-items:center; gap:6px;">
              <span>${recipientName}</span>
              ${recipient.isVerified ? `<i data-lucide="badge-check" style="width:16px;height:16px;color:var(--verified-mint);"></i>` : ''}
            </div>
            <div style="font-size:12px; color:${isRecipientOnline ? 'var(--verified-mint)' : 'var(--muted)'};">
              ${isRecipientOnline ? 'Online now' : 'Offline'}
            </div>
          </div>
        </div>

        <div style="display:flex; gap:8px;">
          <button class="btn-icon" data-action="start-video-call" title="Video Call"><i data-lucide="video"></i></button>
          <button type="button" class="btn-icon" data-action="start-voice-call" title="Voice Call"><i data-lucide="phone"></i></button>
          ${!conversation.group && conversation.type !== 'group' ? '<button type="button" class="btn-icon chat-delete-button" data-action="delete-full-chat" title="Delete full chat for me" aria-label="Delete full chat"><i data-lucide="trash-2"></i></button>' : ''}
        </div>
      </header>

      <div class="messages-area" id="chat-messages-scroll">
        ${messages.map(m => renderMessageBubble(m, currentUserId)).join('')}
      </div>

      <!-- Reply Bar Preview (if replying) -->
      <div id="reply-bar" class="hidden" style="padding:8px 24px; background:var(--card); border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; font-size:12px;">
        <div>
          <span style="color:var(--accent-blue); font-weight:600;">Replying to <span id="reply-bar-user">user</span>:</span>
          <span id="reply-bar-text" style="color:var(--muted); margin-left:6px;"></span>
        </div>
        <button class="btn-icon" data-action="cancel-reply" style="width:24px; height:24px;"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
      </div>

      <form class="chat-input-bar" id="chat-send-form">
        <button type="button" class="btn-icon" data-action="attach-file" title="Attach file"><i data-lucide="image"></i></button>
        <input type="text" name="text" id="chat-message-input" placeholder="Message..." autocomplete="off" class="chat-input" />
        <button type="submit" class="btn btn-primary btn-sm" style="border-radius:20px; height:38px; padding:0 16px;">Send</button>
      </form>
    </div>
  `;
}

function renderMessageBubble(m, currentUserId) {
  const isMine = String(m.senderId) === String(currentUserId);
  const time = formatTimeAgo(m.createdAt);
  const isWithin15Min = Date.now() - new Date(m.createdAt).getTime() < 15 * 60 * 1000;

  return `
    <div class="message-bubble ${isMine ? 'message-mine' : 'message-other'}" data-message-id="${m.id}">
      ${m.replyTo ? `
        <div class="message-reply-preview">
          <strong>@${escapeHtml(m.replyTo.senderUsername)}</strong>: ${escapeHtml(m.replyTo.text)}
        </div>
      ` : ''}

      ${m.sharedReel ? `
        <div class="reel-chat-card" data-action="open-shared-reel" data-reel-id="${m.sharedReel.id}">
          <img src="${m.sharedReel.thumbnail || '/icons/icon-512.png'}" class="reel-chat-thumb" />
          <div class="reel-chat-info">
            <div class="reel-chat-title">🎬 Reel by @${escapeHtml(m.sharedReel.creatorUsername || 'creator')}</div>
            <div style="font-size:12px; color:var(--muted);">${escapeHtml(m.sharedReel.caption || 'Tap to play')}</div>
          </div>
        </div>
      ` : ''}

      ${m.text ? `<div>${escapeHtml(m.text)}</div>` : ''}

      ${m.attachment ? `
        <div style="margin-top:6px;">
          ${String(m.attachment.type||'').startsWith('audio/') ? `<audio controls preload="metadata" src="${escapeHtml(m.attachment.url)}" aria-label="Voice message"></audio>` : `<a href="${escapeHtml(m.attachment.url)}" target="_blank" rel="noopener noreferrer" style="color:inherit; text-decoration:underline;">📎 ${escapeHtml(m.attachment.name || 'Attachment')}</a>`}
        </div>
      ` : ''}

      <div style="display:flex; justify-content:flex-end; align-items:center; gap:6px; font-size:10px; opacity:0.8; margin-top:4px;">
        ${m.isEdited ? `<span>(edited)</span>` : ''}
        <span>${time}</span>
        <div class="message-action-menu" style="display:inline-flex; gap:4px; margin-left:6px;">
          <button data-action="reply-message" data-message-id="${m.id}" data-text="${escapeHtml(m.text || '')}" data-user="${escapeHtml(m.senderUsername || 'user')}" title="Reply" style="opacity:0.7;"><i data-lucide="corner-up-left" style="width:12px;height:12px;"></i></button>
          <button data-action="react-heart" data-message-id="${m.id}" title="Love" style="opacity:0.7;"><i data-lucide="heart" style="width:12px;height:12px;"></i></button>
          ${isMine && isWithin15Min ? `
            <button data-action="edit-message" data-message-id="${m.id}" data-text="${escapeHtml(m.text || '')}" title="Edit" style="opacity:0.7;"><i data-lucide="edit-2" style="width:12px;height:12px;"></i></button>
          ` : ''}
          ${isMine ? `
            <button data-action="delete-message" data-message-id="${m.id}" title="Delete" style="opacity:0.7;"><i data-lucide="trash-2" style="width:12px;height:12px;"></i></button>
          ` : ''}
        </div>
      </div>

      ${m.reactions && Object.keys(m.reactions).length > 0 ? `
        <div class="message-reactions">
          ${Object.entries(m.reactions).map(([emoji, users]) => `
            <span class="reaction-pill">${emoji} ${users.length}</span>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}
