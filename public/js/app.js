/**
 * NoChat v4 - Ultimate Banger Edition
 * Main Application Orchestrator & Router
 * Modular, Premium-Level, Real Data Only, No AI Slop
 */

import { api } from '../services/api.js';
import { getCurrentUser, fetchMe, loginUser, registerUser, logoutUser, subscribeAuth } from '../services/auth.js';
import { getSocket, onSocketEvent, emitSocketEvent } from '../services/socket.js';
import { startCamera, flipCamera, toggleMuteMic, toggleMuteVideo, stopCamera } from '../services/webrtc.js';
import { $, $, escapeHtml, toast, refreshIcons as refreshLucideIcons } from '../utils/dom.js';
import { attachDoubleTap } from '../hooks/useDoubleTap.js';
import { getCachedMessages, setCachedMessages, appendCachedMessage } from '../utils/cache.js';

// Components
import { renderSidebar } from '../components/Sidebar.js';
import { renderBottomNav } from '../components/BottomNav.js';
import { renderCommentSheet } from '../components/CommentSheet.js';
import { renderReelUploadModal } from '../components/ReelUploadModal.js';
import { renderWebcamModal } from '../components/WebcamModal.js';

// Pages
import { renderLandingPage } from '../pages/LandingPage.js';
import { renderHomePage } from '../pages/HomePage.js';
import { renderReelsPage } from '../pages/ReelsPage.js';
import { renderChatPage } from '../pages/ChatPage.js';
import { renderProfilePage } from '../pages/ProfilePage.js';
import { renderWatchPartyPage } from '../pages/WatchPartyPage.js';
import { renderAdminPage } from '../pages/AdminPage.js';
import { renderPrivacyPage } from '../pages/PrivacyPage.js';
import { renderTermsPage } from '../pages/TermsPage.js';
import { renderAboutPage } from '../pages/AboutPage.js';
import { renderContactPage } from '../pages/ContactPage.js';

/* ---------- Sidebar Icon Finish ---------- */
function refreshIcons() {
  refreshLucideIcons();
  document.querySelectorAll('.sidebar .side-nav .nav-item svg').forEach((icon) => {
    icon.setAttribute('width', '25');
    icon.setAttribute('height', '25');
    icon.setAttribute('stroke-width', '1.8');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.setAttribute('fill', 'none');
    icon.style.flexShrink = '0';
    icon.style.display = 'block';
  });
}

/* ---------- Global Application State ---------- */
const state = {
  user: null,
  route: 'home',
  posts: [],
  reels: [],
  users: [],
  conversations: [],
  activeConvo: null,
  messages: [],
  videos: [],
  announcement: null,
  onlineUsers: new Set(),
  activeWatchCategory: 'All',
  replyingToMessage: null,
  editingMessageId: null,
  unreadTotal: 0
};

/* ---------- Initialization ---------- */
async function initApp() {
  // Listen to hash changes
  window.addEventListener('hashchange', handleRouteChange);

  // Subscribe to auth updates
  subscribeAuth((user) => {
    state.user = user;
    renderApp();
  });

  // Initial user check
  await fetchMe();
  setupGlobalRealtime();

  // Load initial route
  handleRouteChange();
}

function handleRouteChange() {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0] || '';
  const parts = hash.split('/');
  state.route = parts[0] || (state.user ? 'home' : 'landing');
  state.routeParam = parts[1] || null;

  renderApp();
}

/* ---------- Realtime Setup ---------- */
function setupGlobalRealtime() {
  onSocketEvent('presence:update', ({ userId, isOnline }) => {
    if (isOnline) state.onlineUsers.add(userId);
    else state.onlineUsers.delete(userId);
    updatePresenceBadges();
  });

  onSocketEvent('message:new', (message) => {
    appendCachedMessage(message.conversationId, message);
    if (state.activeConvo && state.activeConvo.id === message.conversationId) {
      state.messages.push(message);
      renderChatWindowArea();
    }
    // Update conversation snippet
    const convo = state.conversations.find(c => c.id === message.conversationId);
    if (convo) {
      convo.lastMessage = message;
      if (!state.activeConvo || state.activeConvo.id !== message.conversationId) {
        convo.unreadCount = (convo.unreadCount || 0) + 1;
        state.unreadTotal++;
      }
    }
  });

  onSocketEvent('message:reaction', ({ conversationId, messageId, reactions }) => {
    if (state.activeConvo && state.activeConvo.id === conversationId) {
      const msg = state.messages.find(m => m.id === messageId);
      if (msg) {
        msg.reactions = reactions;
        renderChatWindowArea();
      }
    }
  });

  onSocketEvent('announcement:new', (announcement) => {
    state.announcement = announcement;
    toast(`📢 New Announcement: ${announcement.title}`);
    if (state.route === 'home') renderApp();
  });
}

function updatePresenceBadges() {
  $$('.chat-row').forEach(row => {
    const cid = row.dataset.convoId;
    const convo = state.conversations.find(c => c.id === cid);
    const otherId = convo?.otherUser?.id;
    const dot = row.querySelector('.online-dot');
    if (otherId && state.onlineUsers.has(otherId)) {
      if (!dot) {
        const wrap = row.querySelector('.chat-avatar-wrap');
        wrap?.insertAdjacentHTML('beforeend', '<div class="online-dot"></div>');
      }
    } else {
      dot?.remove();
    }
  });
}

/* ---------- Main Render Dispatcher ---------- */
async function renderApp() {
  const app = $('#app');
  if (!app) return;

  const route = state.route;

  // 1. Unauthenticated or Landing/Legal Pages
  if (!state.user && !['privacy', 'terms', 'about', 'contact'].includes(route)) {
    loadVideosCatalog();
    app.innerHTML = renderLandingPage(state.user, state.videos);
    bindLandingEvents();
    refreshIcons();
    return;
  }

  // Legal Pages (accessible both logged in and logged out)
  if (route === 'privacy') {
    app.innerHTML = renderLegalShell(renderPrivacyPage());
    bindCommonEvents();
    refreshIcons();
    return;
  }
  if (route === 'terms') {
    app.innerHTML = renderLegalShell(renderTermsPage());
    bindCommonEvents();
    refreshIcons();
    return;
  }
  if (route === 'about') {
    app.innerHTML = renderLegalShell(renderAboutPage());
    bindCommonEvents();
    refreshIcons();
    return;
  }
  if (route === 'contact') {
    app.innerHTML = renderLegalShell(renderContactPage());
    bindContactEvents();
    bindCommonEvents();
    refreshIcons();
    return;
  }

  // 2. Authenticated App Shell with 240px Sidebar + Content + BottomNav
  const sidebarHtml = renderSidebar(state.user, route, state.unreadTotal);
  const bottomNavHtml = renderBottomNav(route, state.unreadTotal);

  app.innerHTML = `
    <div class="shell">
      ${sidebarHtml}
      <main class="main-content" id="main-content-scroll">
        <header class="topbar">
          <h1>${formatTopBarTitle(route)}</h1>
          <div style="display:flex; gap:8px;">
            <button class="btn-icon" data-action="open-upload-modal" title="Create Reel"><i data-lucide="plus"></i></button>
            <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer" class="btn-icon" title="Founder Portfolio"><i data-lucide="globe"></i></a>
          </div>
        </header>
        <div id="route-container">
          <div style="text-align:center; padding:60px 0; color:var(--muted);">Loading authentic feed...</div>
        </div>
      </main>
      ${bottomNavHtml}
    </div>
  `;

  refreshIcons();
  bindCommonEvents();

  // Load Route Content
  const container = $('#route-container');
  if (!container) return;

  switch (route) {
    case 'home':
      await loadHomeData();
      container.innerHTML = renderHomePage({
        posts: state.posts,
        users: state.users,
        currentUser: state.user,
        announcement: state.announcement
      });
      bindHomeEvents();
      break;

    case 'reels':
      await loadReelsData();
      container.innerHTML = renderReelsPage({
        reels: state.reels,
        currentUser: state.user,
        followingIds: new Set()
      });
      bindReelsEvents();
      break;

    case 'chat':
      await loadChatData();
      container.innerHTML = renderChatPage({
        conversations: state.conversations,
        activeConversation: state.activeConvo,
        messages: state.messages,
        currentUser: state.user,
        onlineUserIds: state.onlineUsers
      });
      bindChatEvents();
      break;

    case 'videos':
      await loadVideosCatalog();
      container.innerHTML = renderWatchPartyPage({
        videos: state.videos,
        activeCategory: state.activeWatchCategory
      });
      bindWatchPartyEvents();
      break;

    case 'profile':
      await loadProfileData(state.routeParam);
      container.innerHTML = renderProfilePage({
        profileUser: state.profileUser || state.user,
        currentUser: state.user,
        posts: state.posts.filter(p => p.userId === (state.profileUser?.id || state.user?.id)),
        reels: state.reels.filter(r => r.userId === (state.profileUser?.id || state.user?.id)),
        activeTab: 'posts'
      });
      bindProfileEvents();
      break;

    case 'admin':
      await loadAdminData();
      container.innerHTML = renderAdminPage({
        users: state.users,
        currentUser: state.user
      });
      bindAdminEvents();
      break;

    default:
      window.location.hash = '#/home';
      break;
  }

  refreshIcons();
}

function formatTopBarTitle(route) {
  switch (route) {
    case 'home': return 'Home';
    case 'reels': return 'Reels';
    case 'chat': return 'Direct Messages';
    case 'videos': return 'Watch Party';
    case 'profile': return 'Profile';
    case 'admin': return 'Founder Admin';
    default: return 'NoChat';
  }
}

function renderLegalShell(content) {
  if (state.user) {
    return `
      <div class="shell">
        ${renderSidebar(state.user, state.route, state.unreadTotal)}
        <main class="main-content" style="padding-top:20px;">
          ${content}
        </main>
        ${renderBottomNav(state.route, state.unreadTotal)}
      </div>
    `;
  }
  return content;
}

/* ---------- Data Loaders (Real Data Only) ---------- */
async function loadHomeData() {
  try {
    const [reelsRes, usersRes, annRes] = await Promise.all([
      api.get('/api/reels').catch(() => ({ reels: [] })),
      api.get('/api/users/search?q=').catch(() => ({ users: [] })),
      api.get('/api/announcements').catch(() => ({ announcement: null }))
    ]);
    state.reels = reelsRes.reels || [];
    state.posts = state.reels; // In NoChat, user-uploaded reels are the core visual feed
    state.users = usersRes.users || [];
    state.announcement = annRes.announcement || null;
  } catch (err) {
    console.error('Home load error:', err);
  }
}

async function loadReelsData() {
  try {
    const res = await api.get('/api/reels');
    state.reels = res.reels || [];
  } catch (e) {
    state.reels = [];
  }
}

async function loadChatData() {
  try {
    const res = await api.get('/api/conversations');
    state.conversations = res.conversations || [];
    if (!state.activeConvo && state.conversations.length > 0) {
      state.activeConvo = state.conversations[0];
    }
    if (state.activeConvo) {
      const cached = getCachedMessages(state.activeConvo.id);
      if (cached) {
        state.messages = cached;
      } else {
        const msgRes = await api.get(`/api/conversations/${state.activeConvo.id}/messages`);
        state.messages = msgRes.messages || [];
        setCachedMessages(state.activeConvo.id, state.messages);
      }
    }
  } catch (e) {
    state.conversations = [];
  }
}

async function loadVideosCatalog() {
  try {
    const res = await api.get('/api/videos-catalog').catch(() => null);
    if (res && res.videos) {
      state.videos = res.videos;
    } else {
      // Fallback: seed catalog imported on backend
      const vRes = await api.get('/api/reels').catch(() => ({ reels: [] }));
      state.videos = (vRes.reels || []).filter(r => r.category === 'Full Movies' || r.category === 'Anime');
    }
  } catch (e) {
    state.videos = [];
  }
}

async function loadProfileData(userId) {
  try {
    const target = userId ? `/api/users/profile/${userId}` : '/api/me';
    const res = await api.get(target);
    state.profileUser = res.user || null;
  } catch (e) {
    state.profileUser = state.user;
  }
}

async function loadAdminData() {
  try {
    const res = await api.get('/api/admin/users');
    state.users = res.users || [];
  } catch (e) {
    toast(e.message || 'Restricted to founder denpherai@gmail.com');
  }
}

/* ---------- Sign Out Confirmation Modal ---------- */
function showSignOutModal() {
  // Remove old modal if exists
  const old = document.getElementById('signout-modal');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'signout-modal';
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    background:rgba(0,0,0,0.75); backdrop-filter:blur(8px);
    display:flex; align-items:center; justify-content:center;
    animation: fadeIn 0.2s ease;
  `;

  overlay.innerHTML = `
    <div style="
      background:#121212; border:1px solid #262626; border-radius:16px;
      padding:32px 28px; max-width:360px; width:90%; text-align:center;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
      animation: scaleIn 0.25s cubic-bezier(0.16,1,0.3,1);
    ">
      <div style="
        width:56px; height:56px; border-radius:50%;
        background:rgba(255,48,64,0.1); border:1px solid rgba(255,48,64,0.2);
        display:flex; align-items:center; justify-content:center;
        margin:0 auto 20px;
      ">
        <i data-lucide="log-out" style="width:24px;height:24px;color:#FF3040;"></i>
      </div>
      <h3 style="font-size:18px; font-weight:700; margin-bottom:8px; color:#fff;">Sign Out?</h3>
      <p style="font-size:14px; color:#A8A8A8; margin-bottom:28px; line-height:1.5;">
        Are you sure you want to sign out of NoChat? You'll need to log back in to access your chats and reels.
      </p>
      <div style="display:flex; gap:12px;">
        <button id="signout-cancel" style="
          flex:1; height:44px; border-radius:8px; font-size:14px; font-weight:600;
          background:#262626; color:#fff; border:1px solid #333; cursor:pointer;
          transition: all 0.15s ease;
        ">Cancel</button>
        <button id="signout-confirm" style="
          flex:1; height:44px; border-radius:8px; font-size:14px; font-weight:600;
          background:#FF3040; color:#fff; border:none; cursor:pointer;
          transition: all 0.15s ease;
        ">Sign Out</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  refreshIcons();

  // Close on cancel or overlay click
  document.getElementById('signout-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Sign out on confirm
  document.getElementById('signout-confirm').onclick = async () => {
    const btn = document.getElementById('signout-confirm');
    btn.textContent = 'Signing out...';
    btn.disabled = true;
    await logoutUser();
    overlay.remove();
    window.location.hash = '#/';
  };

  // Hover effects
  const cancelBtn = document.getElementById('signout-cancel');
  cancelBtn.onmouseenter = () => { cancelBtn.style.background = '#333'; };
  cancelBtn.onmouseleave = () => { cancelBtn.style.background = '#262626'; };
  const confirmBtn = document.getElementById('signout-confirm');
  confirmBtn.onmouseenter = () => { confirmBtn.style.background = '#E62B38'; };
  confirmBtn.onmouseleave = () => { confirmBtn.style.background = '#FF3040'; };
}

/* ---------- Event Handlers ---------- */
function bindCommonEvents() {
  // Sign out with confirmation
  $$('[data-action="logout"]').forEach(btn => {
    btn.onclick = () => {
      showSignOutModal();
    };
  });

  // Open reel upload modal
  $$('[data-action="open-upload-modal"]').forEach(btn => {
    btn.onclick = () => {
      let modal = $('#reel-upload-modal');
      if (!modal) {
        document.body.insertAdjacentHTML('beforeend', renderReelUploadModal());
        modal = $('#reel-upload-modal');
        bindUploadModalEvents();
      }
      modal.classList.remove('hidden');
      refreshIcons();
    };
  });

  // Auth Modal Triggers
  $$('[data-action="open-auth"]').forEach(btn => {
    btn.onclick = () => {
      const modal = $('#auth-modal');
      modal?.classList.remove('hidden');
      refreshIcons();
    };
  });
  $$('[data-action="close-auth"]').forEach(btn => {
    btn.onclick = () => {
      $('#auth-modal')?.classList.add('hidden');
    };
  });
}

function bindLandingEvents() {
  bindCommonEvents();
  setupAuthModalForm();
}

function setupAuthModalForm() {
  const form = $('#auth-form');
  const tabs = $$('.auth-tab-btn');
  let isSignup = false;

  tabs.forEach(tab => {
    tab.onclick = (e) => {
      e.preventDefault();
      tabs.forEach(t => {
        t.classList.remove('active');
        t.style.fontWeight = '500';
        t.style.color = 'var(--muted)';
        t.style.borderBottom = 'none';
      });
      tab.classList.add('active');
      tab.style.fontWeight = '700';
      tab.style.color = 'var(--text)';
      tab.style.borderBottom = '2px solid var(--text)';

      isSignup = tab.dataset.authTab === 'register';
      $$('.signup-only').forEach(el => el.classList.toggle('hidden', !isSignup));
      $('#auth-title').textContent = isSignup ? 'Join NoChat (Human #22+)' : 'Welcome Back';
      $('#auth-identifier-label').textContent = isSignup ? 'Choose Username' : 'Username or Email';
    };
  });

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const errEl = $('#auth-error-msg');
      errEl?.classList.add('hidden');
      const submitBtn = $('#auth-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';

      const formData = new FormData(form);
      try {
        if (isSignup) {
          await registerUser({
            username: formData.get('identifier'),
            email: formData.get('email'),
            password: formData.get('password'),
            displayName: formData.get('displayName')
          });
        } else {
          await loginUser(formData.get('identifier'), formData.get('password'));
        }
        $('#auth-modal')?.classList.add('hidden');
        window.location.hash = '#/home';
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || 'Authentication failed.';
          errEl.classList.remove('hidden');
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continue';
      }
    };
  }
}

function bindHomeEvents() {
  // Double-tap heart burst on post cards
  $$('.post-media-container').forEach(container => {
    attachDoubleTap(container, () => {
      const burst = container.querySelector('.heart-burst');
      if (burst) {
        burst.classList.add('active');
        setTimeout(() => burst.classList.remove('active'), 500);
      }
      const postCard = container.closest('.post-card');
      const likeBtn = postCard?.querySelector('[data-action="toggle-like"]');
      likeBtn?.click();
    });
  });

  // Toggle like
  $$('[data-action="toggle-like"]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const postCard = btn.closest('.post-card');
      const postId = postCard?.dataset.postId;
      if (!postId) return;

      btn.classList.toggle('liked');
      try {
        await api.post(`/api/reels/${postId}/like`);
      } catch (err) {
        btn.classList.toggle('liked');
      }
    };
  });

  // Open comments
  $$('[data-action="open-comments"]').forEach(btn => {
    btn.onclick = async () => {
      const postCard = btn.closest('.post-card');
      const postId = postCard?.dataset.postId;
      if (!postId) return;
      openCommentsDrawer(postId);
    };
  });
}

function bindReelsEvents() {
  const container = $('#reels-snap-feed');
  if (!container) return;

  // Autoplay visible video only
  const videos = $$('.reel-video', container);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.play().catch(() => {});
      } else {
        entry.target.pause();
      }
    });
  }, { threshold: 0.6 });

  videos.forEach(v => observer.observe(v));

  // Double-tap heart on reel
  $$('.reel-item').forEach(item => {
    attachDoubleTap(item, () => {
      const burst = item.querySelector('.heart-burst');
      if (burst) {
        burst.classList.add('active');
        setTimeout(() => burst.classList.remove('active'), 500);
      }
      item.querySelector('[data-action="reel-like"]')?.click();
    });
  });

  // Reel actions
  $$('[data-action="reel-like"]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const reelItem = btn.closest('.reel-item');
      const id = reelItem?.dataset.reelId;
      if (!id) return;
      btn.classList.toggle('liked');
      await api.post(`/api/reels/${id}/like`).catch(() => btn.classList.toggle('liked'));
    };
  });

  $$('[data-action="reel-comment"]').forEach(btn => {
    btn.onclick = () => {
      const reelItem = btn.closest('.reel-item');
      const id = reelItem?.dataset.reelId;
      if (id) openCommentsDrawer(id);
    };
  });
}

async function openCommentsDrawer(reelId) {
  let comments = [];
  try {
    const res = await api.get(`/api/reels/${reelId}/comments`);
    comments = res.comments || [];
  } catch (e) {
    comments = [];
  }

  $('#comment-sheet')?.remove();
  document.body.insertAdjacentHTML('beforeend', renderCommentSheet(comments, 'Reel Comments'));
  refreshIcons();

  const sheet = $('#comment-sheet');
  const close = () => sheet?.remove();
  sheet?.querySelectorAll('[data-action="close-sheet"]').forEach(b => b.onclick = close);

  const form = $('#comment-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = form.text.value.trim();
      if (!text) return;
      try {
        const res = await api.post(`/api/reels/${reelId}/comments`, { text });
        form.reset();
        openCommentsDrawer(reelId); // refresh
      } catch (err) {
        toast(err.message || 'Could not post comment.');
      }
    };
  }
}

function bindChatEvents() {
  // Switch conversation
  $$('.chat-row').forEach(row => {
    row.onclick = async () => {
      const cid = row.dataset.convoId;
      state.activeConvo = state.conversations.find(c => c.id === cid);
      state.messages = [];
      const msgRes = await api.get(`/api/conversations/${cid}/messages`).catch(() => ({ messages: [] }));
      state.messages = msgRes.messages || [];
      setCachedMessages(cid, state.messages);
      renderApp();
    };
  });

  // Send message form
  const sendForm = $('#chat-send-form');
  if (sendForm) {
    sendForm.onsubmit = async (e) => {
      e.preventDefault();
      const input = $('#chat-message-input');
      const text = input.value.trim();
      if (!text || !state.activeConvo) return;

      input.value = '';
      const body = { text };
      if (state.replyingToMessage) {
        body.replyToId = state.replyingToMessage.id;
        state.replyingToMessage = null;
        $('#reply-bar')?.classList.add('hidden');
      }

      try {
        await api.post(`/api/conversations/${state.activeConvo.id}/messages`, body);
      } catch (err) {
        toast(err.message || 'Failed to send message.');
      }
    };
  }

  // Webcam Video Call Button
  $$('[data-action="start-video-call"]').forEach(btn => {
    btn.onclick = () => {
      openWebcamCall(state.activeConvo?.otherUser);
    };
  });

  // Reply message
  $$('[data-action="reply-message"]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.messageId;
      const user = btn.dataset.user;
      const text = btn.dataset.text;
      state.replyingToMessage = { id, user, text };
      const bar = $('#reply-bar');
      if (bar) {
        $('#reply-bar-user').textContent = user;
        $('#reply-bar-text').textContent = text;
        bar.classList.remove('hidden');
      }
      $('#chat-message-input')?.focus();
    };
  });

  // Heart reaction on message
  $$('[data-action="react-heart"]').forEach(btn => {
    btn.onclick = async () => {
      const mid = btn.dataset.messageId;
      if (!mid || !state.activeConvo) return;
      await api.post(`/api/conversations/${state.activeConvo.id}/messages/${mid}/react`, { reaction: '❤️' }).catch(() => {});
    };
  });
}

function renderChatWindowArea() {
  const container = $('.chat-main-area');
  if (container) {
    container.innerHTML = renderChatPage({
      conversations: state.conversations,
      activeConversation: state.activeConvo,
      messages: state.messages,
      currentUser: state.user,
      onlineUserIds: state.onlineUsers
    });
    bindChatEvents();
    refreshIcons();
    // Scroll to bottom
    const scroll = $('#chat-messages-scroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }
}

async function openWebcamCall(targetUser) {
  $('#webcam-modal')?.remove();
  document.body.insertAdjacentHTML('beforeend', renderWebcamModal(targetUser));
  refreshIcons();

  const modal = $('#webcam-modal');
  const videoEl = $('#webcam-video');
  const errorEl = $('#camera-error-message');

  const { error } = await startCamera(videoEl, 'user');
  if (error && errorEl) {
    errorEl.classList.remove('hidden');
  }

  // Webcam actions
  $('[data-action="flip-camera"]').onclick = () => flipCamera(videoEl);
  $('[data-action="toggle-mute-mic"]').onclick = () => {
    const isMuted = toggleMuteMic();
    toast(isMuted ? 'Microphone muted' : 'Microphone unmuted');
  };
  $('[data-action="toggle-mute-cam"]').onclick = () => {
    const isCamOff = toggleMuteVideo();
    toast(isCamOff ? 'Camera turned off' : 'Camera turned on');
  };
  $('[data-action="end-call"]').onclick = () => {
    stopCamera();
    modal?.remove();
  };
  $('[data-action="retry-camera"]').onclick = async () => {
    errorEl?.classList.add('hidden');
    const res = await startCamera(videoEl, 'user');
    if (res.error) errorEl?.classList.remove('hidden');
  };
}

function bindWatchPartyEvents() {
  // Category filter tabs
  $$('.watch-tab-btn').forEach(btn => {
    btn.onclick = () => {
      state.activeWatchCategory = btn.dataset.category;
      renderApp();
    };
  });

  // Watch video embed modal
  $$('[data-action="watch-trailer"]').forEach(btn => {
    btn.onclick = () => {
      const embedId = btn.dataset.embedId;
      const title = btn.dataset.title;
      const modal = $('#video-player-modal');
      const iframe = $('#video-player-iframe');
      const titleEl = $('#video-player-title');
      if (modal && iframe) {
        iframe.src = `https://www.youtube-nocookie.com/embed/${embedId}?autoplay=1&modestbranding=1&rel=0`;
        if (titleEl) titleEl.textContent = title;
        modal.classList.remove('hidden');
      }
    };
  });

  $('[data-action="close-video-modal"]').onclick = () => {
    const modal = $('#video-player-modal');
    const iframe = $('#video-player-iframe');
    if (iframe) iframe.src = '';
    modal?.classList.add('hidden');
  };
}

function bindProfileEvents() {
  // Profile tabs (posts / reels / saved)
  $$('.profile-tab').forEach(tab => {
    tab.onclick = () => {
      $$('.profile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // Load corresponding grid
    };
  });
}

function bindAdminEvents() {
  // User search filter
  const searchInput = $('#admin-user-search');
  if (searchInput) {
    searchInput.oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      $$('#admin-users-tbody tr').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    };
  }

  // Grant Verified Modal
  $$('[data-action="admin-verify-user"]').forEach(btn => {
    btn.onclick = () => {
      const uid = btn.dataset.userId;
      $('#verify-target-user-id').value = uid;
      $('#verify-modal')?.classList.remove('hidden');
    };
  });

  $('[data-action="close-verify-modal"]').onclick = () => {
    $('#verify-modal')?.classList.add('hidden');
  };

  const verifyForm = $('#verify-duration-form');
  if (verifyForm) {
    verifyForm.onsubmit = async (e) => {
      e.preventDefault();
      const uid = $('#verify-target-user-id').value;
      const duration = verifyForm.duration.value;
      try {
        await api.post(`/api/admin/users/${uid}/action`, { action: 'verify', duration });
        toast(`Verified badge granted (${duration})`);
        $('#verify-modal')?.classList.add('hidden');
        renderApp();
      } catch (err) {
        toast(err.message || 'Failed to grant verified badge.');
      }
    };
  }
}

function bindContactEvents() {
  const form = $('#contact-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fb = $('#contact-feedback');
      const btn = $('#contact-submit-btn');
      btn.disabled = true;
      btn.textContent = 'Sending...';

      const body = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        message: form.message.value.trim()
      };

      try {
        await api.post('/api/contact', body);
        form.reset();
        if (fb) {
          fb.textContent = '✓ Message received! Denpher will get back to you shortly.';
          fb.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
          fb.style.color = 'var(--verified-mint)';
          fb.classList.remove('hidden');
        }
      } catch (err) {
        if (fb) {
          fb.textContent = err.message || 'Failed to send message.';
          fb.style.backgroundColor = 'rgba(255, 48, 64, 0.15)';
          fb.style.color = 'var(--like-red)';
          fb.classList.remove('hidden');
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send Message';
      }
    };
  }
}

function bindUploadModalEvents() {
  const modal = $('#reel-upload-modal');
  const close = () => modal?.classList.add('hidden');
  modal?.querySelectorAll('[data-action="close-modal"]').forEach(b => b.onclick = close);

  const form = $('#reel-upload-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fileInput = form.video;
      if (!fileInput.files || fileInput.files.length === 0) {
        toast('Please select a video file.');
        return;
      }

      const file = fileInput.files[0];
      const formData = new FormData();
      formData.append('video', file);
      formData.append('caption', form.caption.value.trim());

      const progressWrap = $('#upload-progress-wrap');
      const progressBar = $('#upload-progress-bar');
      const progressPercent = $('#upload-progress-percent');
      const submitBtn = $('#reel-submit-btn');

      progressWrap?.classList.remove('hidden');
      submitBtn.disabled = true;

      // Simulated smooth progress while streaming to server/cloud
      let p = 10;
      const timer = setInterval(() => {
        if (p < 90) {
          p += 15;
          if (progressBar) progressBar.style.width = `${p}%`;
          if (progressPercent) progressPercent.textContent = `${p}%`;
        }
      }, 200);

      try {
        await api.post('/api/reels', formData);
        clearInterval(timer);
        if (progressBar) progressBar.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';
        toast('🎬 Reel shared successfully!');
        setTimeout(() => {
          modal?.classList.add('hidden');
          form.reset();
          submitBtn.disabled = false;
          progressWrap?.classList.add('hidden');
          window.location.hash = '#/reels';
        }, 400);
      } catch (err) {
        clearInterval(timer);
        toast(err.message || 'Upload failed. Check daily limit.');
        submitBtn.disabled = false;
        progressWrap?.classList.add('hidden');
      }
    };
  }
}

// Kick off app on load
window.addEventListener('DOMContentLoaded', initApp);
