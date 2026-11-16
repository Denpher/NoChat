/**
 * NoChat v4 - Mobile Bottom Navigation
 */

export function renderBottomNav(currentRoute = 'home', unreadCount = 0) {
  return `
    <nav class="tabbar">
      <a href="#/home" class="tab ${currentRoute === 'home' ? 'active' : ''}">
        <i data-lucide="home"></i>
      </a>
      <a href="#/reels" class="tab ${currentRoute === 'reels' ? 'active' : ''}">
        <i data-lucide="clapperboard"></i>
      </a>
      <a href="#/chat" class="tab ${currentRoute === 'chat' ? 'active' : ''}">
        <i data-lucide="message-circle"></i>
        ${unreadCount > 0 ? `<span class="badge badge-red unread-badge" style="position:absolute;top:6px;right:6px;">${unreadCount}</span>` : ''}
      </a>
      <a href="#/videos" class="tab ${currentRoute === 'videos' ? 'active' : ''}">
        <i data-lucide="tv"></i>
      </a>
      <a href="#/profile" class="tab ${currentRoute === 'profile' ? 'active' : ''}">
        <i data-lucide="user"></i>
      </a>
    </nav>
  `;
}
