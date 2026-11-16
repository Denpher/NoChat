/**
 * NoChat v4 - Desktop Sidebar (240px)
 */

import { escapeHtml } from '../utils/dom.js';

export function renderSidebar(user, currentRoute = 'home', unreadCount = 0) {
  const isFounder = Boolean(
    user && (
      user.username === 'denpher' ||
      (user.email && user.email.toLowerCase() === 'denpherai@gmail.com') ||
      user.id === 'denpher-official-founder-id'
    )
  );

  return `
    <aside class="sidebar">
      <a href="#/" class="sidebar-logo" style="display:flex; align-items:center; gap:10px; text-decoration:none;">
        <img src="/icons/nochat-logo.jpg" alt="NoChat" style="width:34px; height:34px; border-radius:10px; object-fit:cover; box-shadow:0 0 10px rgba(0,149,246,0.3);" />
        <span style="font-weight:800; font-size:20px; letter-spacing:-0.5px; color:#fff;">NoChat</span>
      </a>
      
      <nav class="side-nav">
        <a href="#/home" class="nav-item ${currentRoute === 'home' ? 'active' : ''}" data-route="home">
          <i data-lucide="home"></i>
          <span>Home</span>
        </a>
        
        <a href="#/reels" class="nav-item ${currentRoute === 'reels' ? 'active' : ''}" data-route="reels">
          <i data-lucide="clapperboard"></i>
          <span>Reels</span>
        </a>
        
        <a href="#/chat" class="nav-item ${currentRoute === 'chat' ? 'active' : ''}" data-route="chat">
          <i data-lucide="message-circle"></i>
          <span>Chat</span>
          ${unreadCount > 0 ? `<span class="badge badge-red unread-badge">${unreadCount}</span>` : ''}
        </a>
        
        <a href="#/videos" class="nav-item ${currentRoute === 'videos' ? 'active' : ''}" data-route="videos">
          <i data-lucide="tv"></i>
          <span>Watch</span>
        </a>
        
        <a href="#/profile" class="nav-item ${currentRoute === 'profile' ? 'active' : ''}" data-route="profile">
          <i data-lucide="user"></i>
          <span>Profile</span>
        </a>
        
        ${isFounder ? `
          <a href="#/admin" class="nav-item ${currentRoute === 'admin' ? 'active' : ''}" data-route="admin">
            <i data-lucide="shield"></i>
            <span>Admin</span>
          </a>
        ` : ''}
      </nav>

      <div class="sidebar-footer">
        <button class="btn btn-ghost btn-sm" data-action="logout" style="width:100%; justify-content:flex-start;">
          <i data-lucide="log-out"></i>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  `;
}
