/**
 * NoChat v4 - Chat Page (DM Split-Screen)
 */

import { renderChatList } from '../components/ChatList.js';
import { renderChatWindow } from '../components/ChatWindow.js';

export function renderChatPage({
  conversations = [],
  activeConversation = null,
  messages = [],
  currentUser = null,
  onlineUserIds = new Set()
}) {
  const isConvoOpen = Boolean(activeConversation);
  const otherUserId = activeConversation?.otherUser?.id;
  const isRecipientOnline = otherUserId ? onlineUserIds.has(otherUserId) : false;

  return `
    <div class="chat-layout">
      <!-- Conversation Sidebar (360px desktop, full width on mobile if no convo selected) -->
      <aside class="chat-sidebar ${isConvoOpen ? 'mobile-hide' : ''}">
        <div class="chat-sidebar-header">
          <div style="font-size:16px; font-weight:700;">${currentUser?.username ? `@${currentUser.username}` : 'Messages'}</div>
          <button class="btn-icon" data-action="new-chat" title="New Message"><i data-lucide="edit"></i></button>
        </div>

        <div class="chat-list">
          ${renderChatList(conversations, activeConversation?.id, onlineUserIds, currentUser?.id)}
        </div>
      </aside>

      <!-- Active Message Window -->
      <section class="chat-main-area ${!isConvoOpen ? 'mobile-hide' : ''}" style="height:100%;">
        ${renderChatWindow(activeConversation, messages, currentUser?.id, isRecipientOnline)}
      </section>
    </div>
  `;
}
