/**
 * NoChat v4 - Ultimate Banger Edition
 * Main Application Orchestrator & Router
 * Modular, Premium-Level, Real Data Only, No AI Slop
 */

import { api } from '../services/api.js';
import { getCurrentUser, fetchMe, loginUser, registerUser, logoutUser, subscribeAuth } from '../services/auth.js';
import { getSocket, onSocketEvent, emitSocketEvent } from '../services/socket.js';
import { startCamera, flipCamera, toggleMuteMic, toggleMuteVideo, stopCamera } from '../services/webrtc.js';
import { $, $$, escapeHtml, toast, refreshIcons } from '../utils/dom.js';
import { attachDoubleTap } from '../hooks/useDoubleTap.js';
import { getCachedMessages, setCachedMessages, appendCachedMessage } from '../utils/cache.js';
import { formatTimeAgo } from '../utils/formatters.js';
import { parseYouTubeId, playerMarkup, activatePlayer, mountYouTubeReels } from './player-v2.js';
import { installActionsV3 } from './actions-v3.js';
import { ensureNoChatFixStyles, installNoChatInteractionLayer } from './app-nochat-fix.js';

// Components
import { renderSidebar } from '../components/Sidebar.js';
import { renderBottomNav } from '../components/BottomNav.js';
import { renderCommentSheet } from '../components/CommentSheet.js';
import { renderChatWindow } from '../components/ChatWindow.js';
import { renderChatList } from '../components/ChatList.js';
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
import { renderTrustSafetyPage } from '../pages/TrustSafetyPage.js';

/* ---------- Global Application State ---------- */
const state = {
  user: null,
  route: 'home',
  posts: [],
  reels: [],
  users: [],
  recommendedUsers: [],
  conversations: [],
  activeConvo: null,
  messages: [],
  videos: [],
  announcement: null,
  onlineUsers: new Set(),
  reviewReels: [],
  activeWatchCategory: 'All',
  replyingToMessage: null,
  editingMessageId: null,
  unreadTotal: 0,
  notifications: [],
  unreadNotifications: 0,
  stories: [],
  activeStoryIndex: 0,
  activeStoryList: [],
  globalSoundEnabled: false,
  canManageVideos: false,
  videoStorageReady: false
};
let wiredRealtimeSocket=null;
let feedMediaObserver=null;
let reelsMediaObserver=null;
const realtimeMessageIds=new Set();

/* ---------- Initialization ---------- */
async function initApp() {
  if (window.__nochat_init) return;
  window.__nochat_init = true;
  const dispatchActionsV3 = installActionsV3({ getState: () => state, toast, onDelete: id => { state.posts=state.posts.filter(x=>String(x.id)!==String(id)); state.reels=state.reels.filter(x=>String(x.id)!==String(id)); }, onAvatarUpdated: user => { state.user=user; state.profileUser=user; if(state.route==='profile')renderApp(); }, onChatDeleted: id => { if(String(state.activeConvo?.id)===String(id)){state.messages=[];setCachedMessages(id,[]);} renderApp(); } });
  installNoChatInteractionLayer((event, button, action) => {
    handleDelegatedAction(event, button, action);
    handleFeedbackAction(event, button);
    void dispatchActionsV3?.(event, button);
  });
  window.addEventListener('nochat:refresh-chat',renderChatWindowArea);
  document.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.matches('[data-post-media]')) return;
    const container = image.closest('.post-media-container');
    if (!container || container.dataset.mediaFallback === 'shown') return;
    container.dataset.mediaFallback = 'shown';
    const fallback = document.createElement('div');
    fallback.className = 'post-media-fallback';
    const title = document.createElement('strong');
    title.textContent = 'Media unavailable';
    const detail = document.createElement('span');
    detail.textContent = 'This post image could not be loaded. Please try again later.';
    fallback.append(title, detail);
    image.replaceWith(fallback);
  }, true);
  document.addEventListener('submit', handleStorySubmit);
  document.addEventListener('submit', handlePostSubmit);
  document.addEventListener('submit', handleCommentSubmit);
  document.addEventListener('submit', handleVideoCatalogSubmit);
  document.addEventListener('submit', handleAnnouncementSubmit);
  document.addEventListener('submit', handleFeedbackSubmit);
  document.addEventListener('keydown', handleAppEscape);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('.post-video,.reel-video').forEach(video=>{video.pause();video.muted=true;});});
  window.addEventListener('online', flushOfflineLikes);
  wireStoryPreview();
  window.addEventListener('hashchange', handleRouteChange);

  // Subscribe to auth updates
  subscribeAuth((user) => {
    state.user = user;
    if(user)setupGlobalRealtime();
    loadV4Notifications();
    renderApp();
  });

  // Initial user check
  await fetchMe();
  setupGlobalRealtime();

  const savedTheme=localStorage.getItem('nochat:theme'); if(savedTheme) document.querySelector('.shell')?.setAttribute('data-theme',savedTheme);
  loadV4Notifications(); await loadV4Stories();
  // Load initial route
  handleRouteChange();
  scheduleFeedbackPrompt();
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
  const socket=getSocket();
  if(!socket||wiredRealtimeSocket===socket)return;
  wiredRealtimeSocket=socket;
  onSocketEvent('presence:update', ({ userId, isOnline }) => {
    if (isOnline) state.onlineUsers.add(String(userId));
    else state.onlineUsers.delete(String(userId));
    updatePresenceBadges();
  });
  onSocketEvent('presence:snapshot', ({ userIds = [] } = {}) => {
    state.onlineUsers = new Set(userIds.map(String));
    state.conversations.forEach(convo => {
      const id=convo.otherUser?.id;
      if(id!=null) convo.isOnline=state.onlineUsers.has(String(id));
    });
    updatePresenceBadges();
  });

  onSocketEvent('message:new', (message) => {
    appendCachedMessage(message.conversationId, message);
    if (state.activeConvo && String(state.activeConvo.id) === String(message.conversationId)) {
      if (!state.messages.some(item => String(item.id) === String(message.id))) state.messages.push(message);
      renderChatWindowArea();
    }
    // Update conversation snippet
    const convo = state.conversations.find(c => String(c.id) === String(message.conversationId));
    if (convo) {
      convo.lastMessage = message;
      convo.lastAt=message.createdAt||new Date().toISOString();
      if ((!state.activeConvo || String(state.activeConvo.id) !== String(message.conversationId)) && String(message.senderId)!==String(state.user?.id) && !realtimeMessageIds.has(String(message.id))) {
        convo.unreadCount = (convo.unreadCount || 0) + 1;
        state.unreadTotal++;
        realtimeMessageIds.add(String(message.id));
      }
      updateChatPreview(convo);
    }
  });

  onSocketEvent('typing:active', ({ conversationId, username }) => {
    if (!state.activeConvo || String(state.activeConvo.id) !== String(conversationId)) return;
    showTypingDots(username);
  });
  onSocketEvent('typing:inactive', ({ conversationId }) => {
    if (state.activeConvo && String(state.activeConvo.id) === String(conversationId)) hideTypingDots();
  });
  onSocketEvent('messages:read', ({ conversationId, userId }) => {
    if (String(userId) === String(state.user?.id)) return;
    if (state.activeConvo && String(state.activeConvo.id) === String(conversationId)) refreshActiveMessages();
  });
  onSocketEvent('message:edited', ({ conversationId }) => {
    if (state.activeConvo && String(state.activeConvo.id) === String(conversationId)) refreshActiveMessages();
  });
  onSocketEvent('conversation:update', payload => { void handleConversationUpdate(payload); });
  onSocketEvent('connect', joinAllConversations);
  onSocketEvent('message:reaction', ({ conversationId, messageId, reactions }) => {
    if (state.activeConvo && state.activeConvo.id === conversationId) {
      const msg = state.messages.find(m => m.id === messageId);
      if (msg) {
        msg.reactions = reactions;
        renderChatWindowArea();
      }
    }
  });
  onSocketEvent('message:edited',({conversationId,messageId,text,isEdited,editedAt})=>{if(String(state.activeConvo?.id)!==String(conversationId))return;const message=state.messages.find(m=>String(m.id)===String(messageId));if(message){message.text=text;message.isEdited=isEdited;message.editedAt=editedAt;setCachedMessages(conversationId,state.messages);renderChatWindowArea();}});
  onSocketEvent('message:deleted',({conversationId,messageId})=>{if(String(state.activeConvo?.id)!==String(conversationId))return;state.messages=state.messages.filter(m=>String(m.id)!==String(messageId));setCachedMessages(conversationId,state.messages);renderChatWindowArea();});

  onSocketEvent('post:new', post => { state.posts.unshift(post); state.reels.unshift(post); if(state.route==='home') renderApp(); });
  onSocketEvent('reel:new', reel => { state.reels.unshift(reel); state.posts.unshift(reel); if(String(reel.userId)!==String(state.user?.id)) addV4Notification({text:`New reel from ${reel.user?.displayName||reel.user?.username||'a creator'}`,avatar:reel.user?.profilePicture,userId:reel.userId}); if(state.route==='home') renderApp(); });
  onSocketEvent('reel:moderation-updated', ({reelId,status}) => {
    if(status==='blocked') { state.reels=state.reels.filter(reel=>String(reel.id)!==String(reelId));state.posts=state.posts.filter(post=>String(post.id)!==String(reelId)); }
    if(['home','reels','profile'].includes(state.route)) { void loadReelsData().then(()=>{state.posts=state.reels;if(state.route==='home'||state.route==='reels'||state.route==='profile')renderApp();}); }
  });
  onSocketEvent('story:new',story=>{if(!state.stories.some(item=>String(item.id)===String(story.id)))state.stories.push(story);if(state.route==='home')renderApp();});
  onSocketEvent('reel:liked', ({ user, reelId }) => { if(String(state.reels.find(r=>r.id===reelId)?.userId)===String(state.user?.id)) addV4Notification({text:`${user?.displayName||user?.username||'Someone'} liked your post`,avatar:user?.profilePicture,userId:user?.id}); });
  onSocketEvent('user:subscribed', ({ subscriber }) => addV4Notification({text:`${subscriber?.displayName||subscriber?.username||'Someone'} started following you`,avatar:subscriber?.profilePicture,userId:subscriber?.id}));
  onSocketEvent('message:new', (message) => { if(String(message.senderId)!==String(state.user?.id)) addV4Notification({text:`${message.senderDisplayName||message.senderUsername||'Someone'} sent you a message`,avatar:message.senderAvatar}); });
  onSocketEvent('call:incoming', payload => showIncomingCall(payload));
  onSocketEvent('call:accepted', async payload => { if(activeCall && payload.conversationId===activeCall.conversationId) await sendCallOffer(); });
  onSocketEvent('call:declined', () => { toast('Call declined'); endPeerCall(false); });
  onSocketEvent('call:offer', async payload => { if(!activeCall || payload.conversationId!==activeCall.conversationId) return; try { await activeCall.pc.setRemoteDescription(payload.signal); await flushCallIce(); const answer=await activeCall.pc.createAnswer(); await activeCall.pc.setLocalDescription(answer); emitSocketEvent('call:answer',{conversationId:activeCall.conversationId,targetUserId:activeCall.peerId,signal:activeCall.pc.localDescription}); } catch(e) { toast('Could not connect call: '+e.message); endPeerCall(true); } });
  onSocketEvent('call:answer', async payload => { if(activeCall && payload.conversationId===activeCall.conversationId) { try { await activeCall.pc.setRemoteDescription(payload.signal); await flushCallIce(); } catch(e) { toast('Call connection failed'); endPeerCall(true); } } });
  onSocketEvent('call:ice', async payload => {
    const convoId=String(payload.conversationId||'');
    if(activeCall && String(activeCall.conversationId)===convoId) {
      if(activeCall.pc?.remoteDescription) activeCall.pc.addIceCandidate(payload.signal).catch(()=>{});
      else activeCall.pendingIce.push(payload.signal);
      return;
    }
    const queued=pendingCallIce.get(convoId)||[];
    if(queued.length<64){queued.push(payload.signal);pendingCallIce.set(convoId,queued);}
  });
  onSocketEvent('call:end', payload => { if(activeCall && payload.conversationId===activeCall.conversationId) { toast('Call ended'); endPeerCall(false); } });
  onSocketEvent('announcement:new', (announcement) => {
    state.announcement = announcement;
    if (String(announcement.actorId) !== String(state.user?.id)) toast(`📢 New Announcement: ${announcement.title}`);
    if (state.route === 'home') renderApp();
  });
}

let typingDotsTimer = null;
function showTypingDots(name) {
  const area = document.querySelector(".messages-area");
  if (!area || !area.parentNode) return;
  if (!document.getElementById("nc-typing-style")) {
    const st = document.createElement("style");
    st.id = "nc-typing-style";
    st.textContent = ".nc-typing{display:flex;align-items:center;gap:8px;padding:4px 24px 8px;color:var(--muted);font-size:12px}.nc-typing[hidden]{display:none}.nc-dots{display:inline-flex;gap:3px}.nc-dots i{width:6px;height:6px;border-radius:50%;background:var(--muted);display:inline-block;animation:ncTyping 1.2s infinite ease-in-out}.nc-dots i:nth-child(2){animation-delay:.15s}.nc-dots i:nth-child(3){animation-delay:.3s}@keyframes ncTyping{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-4px);opacity:1}}.nc-seen{margin-left:6px;color:var(--accent-blue);font-size:11px;font-weight:600}";
    document.head.appendChild(st);
  }
  let el = document.getElementById("nc-typing");
  if (!el) {
    el = document.createElement("div");
    el.id = "nc-typing";
    el.className = "nc-typing";
    area.parentNode.insertBefore(el, area.nextSibling);
  }
  el.innerHTML = "<span>" + escapeHtml(name || "Someone") + " is typing</span><span class=\"nc-dots\"><i></i><i></i><i></i></span>";
  el.hidden = false;
  clearTimeout(typingDotsTimer);
  typingDotsTimer = setTimeout(hideTypingDots, 4000);
}
function hideTypingDots() {
  clearTimeout(typingDotsTimer);
  const el = document.getElementById("nc-typing");
  if (el) el.hidden = true;
}
async function refreshActiveMessages() {
  if (!state.activeConvo) return;
  try {
    const res = await api.get("/api/conversations/" + encodeURIComponent(state.activeConvo.id) + "/messages");
    state.messages = res.messages || [];
    setCachedMessages(state.activeConvo.id, state.messages);
    renderChatWindowArea();
  } catch (e) { /* keep what is on screen */ }
}
// Server delivers message events only to sockets inside the conversation room.
// Join every conversation so messages from any chat (not just the open one) arrive live.
function joinAllConversations() {
  const s = getSocket();
  if (!s || !s.connected) return;
  state.conversations.forEach(c => { if (c && c.id) s.emit("conversation:join", c.id); });
  if (state.activeConvo && state.activeConvo.id) s.emit("conversation:join", state.activeConvo.id);
}

function updatePresenceBadges() {
  $$('.chat-row').forEach(row => {
    const cid = row.dataset.convoId;
    const convo = state.conversations.find(c => String(c.id) === String(cid));
    const otherId = convo?.otherUser?.id;
    const dot = row.querySelector('.online-dot');
    if (otherId != null && state.onlineUsers.has(String(otherId))) {
      if (!dot) {
        const wrap = row.querySelector('.chat-avatar-wrap');
        wrap?.insertAdjacentHTML('beforeend', '<div class="online-dot"></div>');
      }
    } else {
      dot?.remove();
    }
  });
  const label=$('.chat-presence-label');
  const otherId=state.activeConvo?.otherUser?.id;
  if(label&&otherId!=null){const online=state.onlineUsers.has(String(otherId));label.textContent=online?'Online now':'Offline';label.classList.toggle('is-online',online);}
}

function updateChatPreview(convo) {
  if(!convo?.id)return;
  let row=document.querySelector(`.chat-row[data-convo-id="${CSS.escape(String(convo.id))}"]`);
  if(!row){if(state.route==='chat')renderChatListOnly();return;}
  const last=convo.lastMessage;
  const snippet=typeof last==='string'?last:last?(last.text||(last.sharedReel?'Shared a reel':'Attachment')):'Start chatting';
  const snippetNode=row.querySelector('.chat-row-snippet');if(snippetNode)snippetNode.textContent=snippet;
  const timeNode=row.querySelector('.chat-row-time');if(timeNode&&convo.lastAt)timeNode.textContent=formatTimeAgo(convo.lastAt);
  const info=row.querySelector('.chat-row-info');
  const badge=row.querySelector('.badge-red');
  if(Number(convo.unreadCount)>0){const count=badge||document.createElement('span');count.className='badge badge-red';count.textContent=String(convo.unreadCount);info?.lastElementChild?.append(count);}
  else badge?.remove();
  row.parentElement?.prepend(row);
}

function renderChatListOnly() {
  const list=$('.chat-list');
  if(!list)return;
  list.innerHTML=renderChatList(state.conversations,state.activeConvo?.id,state.onlineUsers,state.user?.id);
  bindChatEvents();
  refreshIcons();
}

async function handleConversationUpdate(payload={}) {
  const {conversationId,message}=payload;
  if(!conversationId||!message)return;
  let convo=state.conversations.find(item=>String(item.id)===String(conversationId));
  if(!convo){
    if(state.route!=='chat')return;
    const result=await api.get('/api/conversations').catch(()=>({conversations:[]}));
    state.conversations=(result.conversations||[]).map(item=>({...item,otherUser:item.user||item.otherUser||null}));
    renderChatListOnly();
    return;
  }
  convo.lastMessage=message;convo.lastAt=message.createdAt||new Date().toISOString();
  if(String(message.senderId)!==String(state.user?.id)&&String(state.activeConvo?.id)!==String(conversationId)&&!realtimeMessageIds.has(String(message.id))){
    convo.unreadCount=(convo.unreadCount||0)+1;state.unreadTotal++;realtimeMessageIds.add(String(message.id));
  }
  updateChatPreview(convo);
}

/* ---------- Landing member count animation ---------- */
function startLandingMemberCount(root) {
  const counters = root.querySelectorAll('[data-member-counter]');
  counters.forEach(counter => {
    if (counter.__memberCountTimer) clearInterval(counter.__memberCountTimer);
    const target = 40;
    const suffix = counter.dataset.suffix || '';
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      counter.textContent = `${target}${suffix}`;
      return;
    }
    let value = 0;
    counter.textContent = `0${suffix}`;
    counter.__memberCountTimer = setInterval(() => {
      value = Math.min(target, value + 1);
      counter.textContent = `${value}${suffix}`;
      if (value >= target) {
        clearInterval(counter.__memberCountTimer);
        counter.__memberCountTimer = null;
      }
    }, 32);
  });
}

/* ---------- Landing welcome terminal ---------- */
function startLandingTerminalAnimation(root) {
  const output = root.querySelector('[data-landing-terminal]');
  if (!output) return;
  if (window.__nochatLandingTerminalTimer) {
    clearInterval(window.__nochatLandingTerminalTimer);
    window.__nochatLandingTerminalTimer = null;
  }
  const message = Array.from("Welcome to NoChat🤗 | India's first teen developed video sharing Platform");
  let index = 0;
  let pauseTicks = 0;
  output.textContent = '';
  window.__nochatLandingTerminalTimer = setInterval(() => {
    if (!output.isConnected) {
      clearInterval(window.__nochatLandingTerminalTimer);
      window.__nochatLandingTerminalTimer = null;
      return;
    }
    if (index < message.length) {
      output.textContent += message[index++];
      return;
    }
    pauseTicks += 1;
    if (pauseTicks >= 22) {
      output.textContent = '';
      index = 0;
      pauseTicks = 0;
    }
  }, 48);
}

/* ---------- Main Render Dispatcher ---------- */
async function renderApp() {
  const app = $('#app');
  if (!app) return;

  const route = state.route;

  // 1. Unauthenticated or Landing/Legal Pages
  if (!state.user && !['privacy', 'terms', 'about', 'contact', 'trust-safety'].includes(route)) {
    loadVideosCatalog();
    app.innerHTML = renderLandingPage(state.user, state.videos);
    startLandingTerminalAnimation(app);
    startLandingMemberCount(app);
    decorateLandingVersion();
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
  if (route === 'trust-safety') {
    app.innerHTML = renderLegalShell(renderTrustSafetyPage());
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
      <button type="button" class="v4-menu-scrim" data-action="toggle-mobile-menu" aria-label="Close navigation"></button>
      <main class="main-content" id="main-content-scroll">
        <header class="topbar">
          <h1>${formatTopBarTitle(route)}</h1>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-icon v4-mobile-menu-trigger" data-action="toggle-mobile-menu" aria-label="Open navigation menu"><i data-lucide="menu"></i></button>
            ${route === 'home' ? `<button type="button" class="btn-icon v4-bell-button" data-action="notifications" aria-label="Notifications" title="Notifications"><i data-lucide="bell"></i><span class="v4-notification-count ${state.unreadNotifications ? '' : 'hidden'}" data-bell-count>${state.unreadNotifications || ''}</span></button>` : ''}
            ${route === 'home' ? `<button type="button" class="btn-icon" data-action="toggle-global-sound" aria-label="Toggle feed video sound" title="Toggle feed video sound"><i data-lucide="${state.globalSoundEnabled?'volume-2':'volume-x'}"></i></button>` : ''}
            <button type="button" class="btn-icon" data-action="theme-toggle" aria-label="Toggle light and dark theme" title="Toggle theme">◐</button>
            <button type="button" class="btn-icon v4-create-trigger" data-action="toggle-create-menu" title="Create"><i data-lucide="plus"></i></button><div class="v4-create-menu hidden"><button type="button" data-action="open-upload-modal">Create Reel</button><button type="button" data-action="open-post-upload">Create Post</button><button type="button" data-action="add-story">Add Story</button></div>
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

  const savedTheme=localStorage.getItem('nochat:theme'); if(savedTheme) document.querySelector('.shell')?.setAttribute('data-theme',savedTheme);
  decorateNavigationButtons();
  refreshIcons();
  bindCommonEvents();

  // Load Route Content
  const container = $('#route-container');
  if (!container) return;

  switch (route) {
    case 'home':
      await loadHomeData();
      await loadV4Stories();
      container.innerHTML = renderHomePage({
        posts: state.posts,
        users: state.users,
        stories: state.stories,
        currentUser: state.user,
        announcement: state.announcement
      });
      const feed=container.querySelector('.feed-container'); if(feed) feed.insertAdjacentHTML('beforeend', renderDiscoveryPanel(state.recommendedUsers));
      bindDiscoveryEvents(container);
      decorateYourStory(container);
      wireStoryScroller(container);
      if(state.routeParam) document.querySelector(`[data-post-id="${CSS.escape(state.routeParam)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});
      bindHomeEvents();
      break;

    case 'discover':
      await loadHomeData();
      container.innerHTML='<div class="v4-discover-page"><header><span>NOCHAT COMMUNITY</span><h2>Discover real people</h2><p>Find creators, follow their work, and connect with humans.</p></header>'+renderDiscoveryPanel(state.recommendedUsers)+'</div>';
      bindDiscoveryEvents(container);
      break;

    case 'reels':
      await loadReelsData();
      // Keep a reel selected from a profile available even when it is outside the main feed page.
      if (state.routeParam && Array.isArray(state.profileReels)) {
        const selectedProfileReel = state.profileReels.find(r => String(r.id) === String(state.routeParam) && r.videoUrl && r.isPost !== true);
        if (selectedProfileReel && !state.reels.some(r => String(r.id) === String(state.routeParam))) {
          state.reels = [selectedProfileReel, ...state.reels];
        }
      }
      container.innerHTML = renderReelsPage({
        reels: state.reels.filter(r=>r.videoUrl && r.isPost !== true),
        currentUser: state.user,
        followingIds: new Set()
      });
      bindReelsEvents();
      mountYouTubeReels(container);
      if (state.routeParam) document.querySelector(`[data-reel-id="${CSS.escape(state.routeParam)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});
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
      await loadWatchVideosCatalog();
      container.innerHTML = renderWatchPartyPage({
        videos: state.videos,
        activeCategory: state.activeWatchCategory,
        canManageVideos: state.canManageVideos,
        videoStorageReady: state.videoStorageReady
      });
      bindWatchPartyEvents();
      break;

    case 'profile':
      await loadProfileData(state.routeParam);
      container.innerHTML = renderProfilePage({
        profileUser: state.profileUser || state.user,
        currentUser: state.user,
        posts: (state.profileReels||state.posts).filter(p => String(p.userId) === String(state.profileUser?.id || state.user?.id) && p.isPost === true),
        reels: (state.profileReels||state.reels).filter(r => String(r.userId) === String(state.profileUser?.id || state.user?.id) && r.isPost !== true),
        savedPosts: state.reels.filter(r => (JSON.parse(localStorage.getItem('nochat:saved-reels')||'[]').map(String)).includes(String(r.id))),
        activeTab: state.profileTab || 'posts'
      });
      bindProfileEvents();
      break;

    case 'admin':
      await loadAdminData();
      container.innerHTML = renderAdminPage({
        users: state.users,
        reviewReels: state.reviewReels,
        currentUser: state.user
      });
      bindAdminEvents();
      break;

    default:
      window.location.hash = '#/home';
      break;
  }

  decorateV3Actions();
  decorateSidebarStoryAction();
  refreshIcons();
}


function decorateLandingVersion() {
  const logo=document.querySelector('.landing-nav .logo');
  if(logo && !logo.querySelector('.v4-version')) { const tag=document.createElement('small'); tag.className='v4-version'; tag.textContent='v4'; logo.append(tag); }
  const wordmark=document.querySelector('.landing-footer-wordmark');
  if(wordmark&&!wordmark.dataset.revealBound){wordmark.dataset.revealBound='true';if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){wordmark.classList.add('is-revealed');observer.disconnect();}},{threshold:.2});observer.observe(wordmark);}else wordmark.classList.add('is-revealed');}
}
function decorateSidebarStoryAction() {
  const footer=document.querySelector('.sidebar-footer');
  if(footer && !footer.querySelector('[data-action="add-story"]')) { const b=document.createElement('button'); b.type='button'; b.className='btn btn-ghost btn-sm v4-sidebar-story'; b.dataset.action='add-story'; b.innerHTML='<i data-lucide="circle-plus"></i><span>Add Story</span>'; footer.prepend(b); }
}
function v4StorageKey(suffix) { return 'nochat:v4:'+String(state.user?.id||'guest')+':'+suffix; }
function loadV4Notifications() { try { state.notifications=JSON.parse(localStorage.getItem(v4StorageKey('notifications'))||'[]'); state.unreadNotifications=state.notifications.filter(n=>!n.read).length; } catch { state.notifications=[];state.unreadNotifications=0; } }
function saveV4Notifications() { localStorage.setItem(v4StorageKey('notifications'),JSON.stringify(state.notifications.slice(0,80))); }
function addV4Notification(item) { if(!item?.text) return; state.notifications.unshift({id:crypto.randomUUID?.()||String(Date.now()),createdAt:Date.now(),read:false,...item}); state.unreadNotifications=state.notifications.filter(n=>!n.read).length; saveV4Notifications(); updateV4Bell(); document.querySelector('.v4-bell-button')?.classList.add('v4-bell-shake'); setTimeout(()=>document.querySelector('.v4-bell-button')?.classList.remove('v4-bell-shake'),700); if(navigator.vibrate) navigator.vibrate(50); }
function updateV4Bell() { const b=document.querySelector('[data-bell-count]'); if(!b) return; b.textContent=state.unreadNotifications||''; b.classList.toggle('hidden',state.unreadNotifications===0); }
function notificationPanel() { document.querySelector('.v4-notification-panel')?.remove(); const rows=state.notifications.map(n=>'<article class="v4-notification-row"><img src="'+escapeHtml(n.avatar||'/icons/nochat-mark.svg')+'" alt=""><div class="v4-notification-copy"><strong>'+escapeHtml(n.text)+'</strong><small>'+escapeHtml(n.time||'Just now')+'</small></div>'+(n.userId?'<button type="button" data-action="toggle-follow" data-user-id="'+escapeHtml(n.userId)+'">Follow</button>':'')+'</article>').join(''); const panel=document.createElement('section'); panel.className='v4-notification-panel'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Notifications'); panel.innerHTML='<header><strong>Notifications</strong><button type="button" data-action="close-notifications" aria-label="Close">×</button></header>'+(rows||'<p class="v4-notification-empty">You’re all caught up.</p>'); document.querySelector('.topbar')?.append(panel); state.notifications=state.notifications.map(n=>({...n,read:true})); state.unreadNotifications=0; saveV4Notifications(); updateV4Bell(); }
function closeV4Notifications() { document.querySelector('.v4-notification-panel')?.remove(); }
function scheduleFeedbackPrompt(){if(!state.user)return;let last=0;try{last=Number(localStorage.getItem('nochat:feedback:last')||0);}catch{}if(Date.now()-last<7*86400000)return;setTimeout(()=>{if(document.hidden||!state.user||document.querySelector('.v4-feedback-modal'))return;document.body.insertAdjacentHTML('beforeend','<div class="v4-feedback-modal" role="dialog" aria-modal="true" aria-labelledby="v4-feedback-title"><form class="v4-feedback-form"><button type="button" class="v4-feedback-close" data-action="dismiss-feedback" aria-label="Close">×</button><span class="v4-feedback-kicker">Help shape NoChat</span><h2 id="v4-feedback-title">How can we improve?</h2><p>Your feedback helps us make the app better for everyone.</p><label>Email for a follow-up<input name="email" type="email" maxlength="100" required value="'+escapeHtml(state.user.email||'')+'" placeholder="you@example.com"></label><label>What should we improve?<textarea name="message" rows="4" maxlength="1500" required placeholder="Tell us what works or what needs fixing…"></textarea></label><button type="submit" class="btn btn-primary">Send feedback</button><button type="button" class="v4-feedback-later" data-action="dismiss-feedback">Maybe later</button></form></div>');try{localStorage.setItem('nochat:feedback:last',String(Date.now()));}catch{}},45000);}
function handleFeedbackAction(event){if(!event.target.closest('[data-action="dismiss-feedback"]'))return;document.querySelector('.v4-feedback-modal')?.remove();}
function openAnnouncementModal() {
  document.querySelector('.v4-announcement-modal')?.remove();
  document.body.insertAdjacentHTML('beforeend', '<div class="v4-announcement-modal" role="dialog" aria-modal="true" aria-labelledby="v4-announcement-title"><form class="v4-announcement-form"><header><h2 id="v4-announcement-title">Post announcement</h2><button type="button" data-action="close-announcement-modal" aria-label="Close">×</button></header><label>Title<input name="title" type="text" maxlength="100" placeholder="Announcement title"></label><label>Message<textarea name="message" rows="5" maxlength="500" required placeholder="Write an update for NoChat users…"></textarea></label><p class="v4-announcement-error" data-announcement-error hidden></p><footer><button type="button" class="btn btn-secondary" data-action="close-announcement-modal">Cancel</button><button type="submit" class="btn btn-primary">Post to everyone</button></footer></form></div>');
  const modal=document.querySelector('.v4-announcement-modal');
  modal?.addEventListener('click',event=>{if(event.target===modal)modal.remove();});
  modal?.querySelector('[name="title"]')?.focus();
}
async function handleAnnouncementSubmit(event) {
  const form=event.target;
  if(!form.matches('.v4-announcement-form'))return;
  event.preventDefault();
  const submit=form.querySelector('[type="submit"]');
  const errorEl=form.querySelector('[data-announcement-error]');
  if(submit)submit.disabled=true;
  if(errorEl){errorEl.hidden=true;errorEl.textContent='';}
  try {
    const result=await api.post('/api/admin/announcements',{title:form.elements.namedItem('title').value.trim(),message:form.elements.namedItem('message').value.trim()});
    state.announcement=result.announcement||null;
    document.querySelector('.v4-announcement-modal')?.remove();
    toast('Announcement posted to NoChat');
    if(state.route==='home')renderApp();
  } catch(error) {
    const message=error.status===401?'Login again':error.message||'Announcement could not be posted.';
    if(errorEl){errorEl.textContent=message;errorEl.hidden=false;}
    toast(message);
  } finally {if(submit?.isConnected)submit.disabled=false;}
}
function handleAppEscape(event) {
  if(event.key!=='Escape')return;
  const player=$('#video-player-modal');
  if(player&&!player.classList.contains('hidden')){closeWatchVideo();return;}
  const announcement=document.querySelector('.v4-announcement-modal');if(announcement){announcement.remove();return;}
  const libraryUpload=document.querySelector('[data-video-upload-modal]:not([hidden])');if(libraryUpload){libraryUpload.setAttribute('hidden','');return;}
  const storyViewer=document.querySelector('.v4-story-viewer');if(storyViewer){closeV4StoryViewer();return;}
  const storyComposer=document.querySelector('.v4-story-modal');if(storyComposer){storyComposer.remove();return;}
  const comments=$('#comment-sheet');if(comments){comments.remove();return;}
  document.querySelector('.v3-action-backdrop')?.remove();
}
async function handleFeedbackSubmit(event){if(!event.target.matches('.v4-feedback-form'))return;event.preventDefault();const form=event.target;const btn=form.querySelector('[type="submit"]');btn.disabled=true;try{const name=state.user?.displayName||state.user?.username||'NoChat user';await api.post('/api/contact',{name,email:form.email.value.trim(),message:`App feedback: ${form.message.value.trim()}`});form.innerHTML='<div class="v4-feedback-success"><span>✓</span><h2>Thanks for helping improve NoChat.</h2><p>Your feedback was received.</p></div>';setTimeout(()=>document.querySelector('.v4-feedback-modal')?.remove(),1800);}catch(error){toast('Feedback could not send: '+error.message);btn.disabled=false;}}
async function loadV4Stories() { try { const r=await api.get('/api/stories'); state.stories=r.stories||[]; } catch(e) { state.stories=[]; } }
function decorateYourStory(root) { const row=root.querySelector('.stories-bar'); if(!row) return; const circles=[...row.querySelectorAll('.story-circle')]; const old=circles[0]; if(old) { const own=state.stories.filter(s=>String(s.userId)===String(state.user?.id)); const story=own.at(-1); const avatar=state.user?.profilePicture||'/icons/nochat-mark.svg'; const box=document.createElement('div'); box.className='story-circle v4-your-story'; box.dataset.action=story?'view-own-story':'add-story'; box.innerHTML='<div class="story-ring '+(story?'v4-story-ring-live':'v4-story-ring-empty')+'"><img src="'+escapeHtml(avatar)+'" alt="Your Story" class="story-avatar"></div><button type="button" class="v4-story-plus" data-action="add-story" aria-label="Add story">+</button><span class="story-username">Your Story</span><small class="v4-add-story-label">'+(story?'Add story':'Add Story')+'</small>'; old.replaceWith(box); }
  row.querySelectorAll('.story-circle:not(.v4-your-story)').forEach(circle=>{const story=state.stories.find(x=>String(x.userId)===String(circle.dataset.userId));if(story){circle.dataset.action='view-user-story';circle.dataset.storyId=story.id;circle.dataset.storyUserId=story.userId;circle.classList.add('v4-has-story');}});
}
function showV4StoryModal() { document.querySelector('.v4-story-modal')?.remove(); document.body.insertAdjacentHTML('beforeend','<div class="v4-story-modal" role="dialog" aria-modal="true"><section><header><strong>Create Story</strong><button type="button" data-action="close-story">×</button></header><div class="v4-story-preview" data-story-preview>Choose a photo or video to preview in 9:16</div><div class="v4-story-source-buttons"><button type="button" data-action="choose-story-photo">Choose Photo</button><button type="button" data-action="take-story-photo">Take Photo</button><button type="button" data-action="choose-story-video">Choose Video</button><input hidden type="file" accept="image/*" data-story-file><input hidden type="file" accept="video/*" data-story-video></div><label>Caption<input type="text" maxlength="220" data-story-caption placeholder="Add a caption…"></label><label class="v4-close-friends"><input type="checkbox" data-story-close-friends> Close Friends Only</label><button type="button" class="btn btn-primary" data-action="publish-story">Post Story</button></section></div>'); }
function openV4StoryViewer(userId) { const list=state.stories.filter(story=>String(story.userId)===String(userId));if(!list.length){toast('No active story');return;}state.activeStoryList=list;state.activeStoryIndex=0;showV4StoryAt(0); }
function closeV4StoryViewer(){const old=document.querySelector('.v4-story-viewer');if(old?.dataset.timer)clearTimeout(Number(old.dataset.timer));old?.remove();}
function showV4StoryAt(index) { const story=state.activeStoryList[index];if(!story){closeV4StoryViewer();return;}state.activeStoryIndex=index;closeV4StoryViewer();const view=document.createElement('div');view.className='v4-story-viewer';view.innerHTML='<div class="v4-story-progress"><i></i></div><button class="v4-story-sound" data-action="v4-story-sound">Sound Off</button><button class="v4-story-close" data-action="close-story" aria-label="Close">×</button><div class="v4-story-tap-left" data-action="story-prev"></div><div class="v4-story-tap-right" data-action="story-next"></div><div class="v4-story-content">'+(String(story.mediaType||'').startsWith('video/')?'<video autoplay muted controls playsinline src="'+escapeHtml(story.mediaUrl)+'"></video>':'<img src="'+escapeHtml(story.mediaUrl)+'" alt="Story">')+(story.caption?'<p>'+escapeHtml(story.caption)+'</p>':'')+'</div><form class="v4-story-reply"><input name="reply" placeholder="Reply to story…"><button type="submit">Send</button></form>';document.body.append(view);view.querySelector('.v4-story-progress i').style.animationDuration='5s';view.dataset.timer=setTimeout(()=>showV4StoryAt(index+1),5000); }
function handleStorySubmit(event) { if(!event.target.matches('.v4-story-reply'))return;event.preventDefault();const text=event.target.reply.value.trim();if(!text)return;const story=state.activeStoryList[state.activeStoryIndex];const convo=state.conversations.find(c=>String(c.otherUser?.id)===String(story?.userId));if(convo)api.post('/api/conversations/'+encodeURIComponent(convo.id)+'/messages',{text:'Story reply: '+text}).then(()=>toast('Reply sent')).catch(e=>toast('Reply failed: '+e.message));else toast('Open a chat with this creator to reply');event.target.reset(); }
async function normalizeStoryImage(file) {
  if (file.type === 'image/gif' || file.type.startsWith('video/') || /\.(?:mp4|mov|webm)$/i.test(file.name)) return file;
  if (!file.type.startsWith('image/')) throw new Error('Choose a supported photo or video.');
  let image, objectUrl = '';
  try {
    if (typeof createImageBitmap === 'function') {
      try { image = await createImageBitmap(file); } catch { /* Try browser image decoding below. */ }
    }
    if (!image) {
      objectUrl = URL.createObjectURL(file);
      image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('This photo format cannot be opened by this browser. Please save it as JPG or PNG and retry.'));
        img.src = objectUrl;
      });
    }
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare this photo.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
    if (!blob) throw new Error('Could not convert this photo. Please use JPG or PNG.');
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], baseName + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } catch (error) {
    image?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw error;
  }
}
async function publishV4Story() { const modal=document.querySelector('.v4-story-modal');let file=modal?.querySelector('[data-story-file]')?.files?.[0]||modal?.querySelector('[data-story-video]')?.files?.[0];if(!file){toast('Choose a photo or video first');return;}const submit=modal.querySelector('[data-action="publish-story"]');if(submit)submit.disabled=true;try{file=await normalizeStoryImage(file);const form=new FormData();form.append('media',file,file.name);form.append('caption',modal.querySelector('[data-story-caption]')?.value.trim()||'');form.append('closeFriendsOnly',String(!!modal.querySelector('[data-story-close-friends]')?.checked));const result=await api.post('/api/stories',form);if(!state.stories.some(item=>String(item.id)===String(result.story.id)))state.stories.push(result.story);modal.remove();toast('Story posted for 24 hours');if(state.route==='home')renderApp();}catch(e){toast(e.status===401?'Login again':'Story upload failed: '+e.message);}finally{if(submit?.isConnected)submit.disabled=false;} }
function wireStoryPreview() { document.addEventListener('change',event=>{const input=event.target;if(!input.matches('[data-story-file],[data-story-video]')||!input.files?.[0])return;const file=input.files[0],url=URL.createObjectURL(file),preview=document.querySelector('[data-story-preview]'),isVideo=file.type.startsWith('video/')||/\.(?:mp4|mov|webm)$/i.test(file.name);if(preview)preview.innerHTML=isVideo?'<video controls playsinline src="'+url+'"></video>':'<img src="'+url+'" alt="Story preview">';}); }
function showPostUploadModal() { document.querySelector('.v4-post-modal')?.remove();document.body.insertAdjacentHTML('beforeend','<div class="v4-story-modal v4-post-modal" role="dialog" aria-modal="true"><form class="v4-post-upload-form"><header><strong>Create Post</strong><button type="button" data-action="close-story">×</button></header><label>Photo or video<input type="file" name="media" accept="image/*,video/mp4,video/webm,video/quicktime" required></label><label>Caption<textarea name="caption" rows="3" maxlength="2200" placeholder="Write a caption…"></textarea></label><button class="btn btn-primary" type="submit">Share Post</button></form></div>'); }
async function handlePostSubmit(event) { if(!event.target.matches('.v4-post-upload-form'))return;event.preventDefault();const form=event.target;let file=form.media.files?.[0];if(!file)return;const data=new FormData();const button=form.querySelector('[type="submit"]');button.disabled=true;try{file=await normalizeStoryImage(file);data.append('media',file,file.name);data.append('caption',form.caption.value);const result=await api.post('/api/posts',data);if(result.post?.moderationStatus==='approved'){state.posts.unshift(result.post);state.reels=state.reels.filter(item=>String(item.id)!==String(result.post.id));toast('Post shared');}else toast('Post uploaded and is waiting for review');form.closest('.v4-post-modal').remove();if(state.route==='home')renderApp();}catch(e){toast(e.status===401?'Login again':'Post upload failed: '+e.message);}finally{button.disabled=false;} }
function handleV4Action(event) { const b=event.target.closest('[data-action]'); if(!b)return; const a=b.dataset.action; if(a==='toggle-global-sound'){state.globalSoundEnabled=!state.globalSoundEnabled;document.querySelectorAll('.post-video,.reel-video').forEach(video=>{const rect=video.getBoundingClientRect(),visible=rect.bottom>0&&rect.top<innerHeight;if(visible)video.muted=!state.globalSoundEnabled;const control=video.closest('.post-card,.reel-item')?.querySelector('[data-action="toggle-reel-sound"]');if(control){control.dataset.muted=String(!state.globalSoundEnabled);control.textContent=state.globalSoundEnabled?'Sound On':'Sound Off';control.setAttribute('aria-pressed',String(state.globalSoundEnabled));}});b.innerHTML='<i data-lucide="'+(state.globalSoundEnabled?'volume-2':'volume-x')+'"></i>';refreshIcons();return;} if(a==='toggle-mobile-menu'){document.querySelector('.shell')?.classList.toggle('v4-menu-open');return;} if(a==='toggle-create-menu'){document.querySelector('.v4-create-menu')?.classList.toggle('hidden');return;} if(a==='open-post-upload'){document.querySelector('.v4-create-menu')?.classList.add('hidden');showPostUploadModal();return;} if(a==='new-chat'){openNewChatPicker();return;} if(a==='select-new-chat'){startNewChat(b.dataset.userId);return;} if(a==='close-new-chat'){document.querySelector('.v4-chat-picker')?.remove();return;} if(a==='mobile-chat-back'){state.activeConvo=null;state.messages=[];renderApp();return;} if(a.startsWith('call-')) { handleCallAction(a); return; } if(a==='notifications'){ event.preventDefault(); notificationPanel(); } else if(a==='close-notifications'){closeV4Notifications();} else if(a==='add-story'){event.preventDefault();showV4StoryModal();} else if(a==='close-story'){document.querySelector('.v4-story-modal')?.remove();closeV4StoryViewer();} else if(a==='view-own-story'){openV4StoryViewer(state.user?.id);} else if(a==='view-user-story'){openV4StoryViewer(b.dataset.storyUserId);} else if(a==='choose-story-photo'){document.querySelector('[data-story-file]')?.click();} else if(a==='take-story-photo'){const i=document.querySelector('[data-story-file]'); if(i){i.setAttribute('capture','environment');i.click();}} else if(a==='choose-story-video'){document.querySelector('[data-story-video]')?.click();} else if(a==='story-next'){showV4StoryAt(state.activeStoryIndex+1);} else if(a==='story-prev'){showV4StoryAt(Math.max(0,state.activeStoryIndex-1));} else if(a==='publish-story'){publishV4Story();} }
function openNewChatPicker(){document.querySelector('.v4-chat-picker')?.remove();document.body.insertAdjacentHTML('beforeend','<div class="v4-chat-picker" role="dialog" aria-modal="true"><section><header><h2>New message</h2><button type="button" data-action="close-new-chat" aria-label="Close">×</button></header><input type="search" data-new-chat-search placeholder="Search people…" aria-label="Search people"><div class="v4-chat-picker-results">Loading people…</div></section></div>');const input=document.querySelector('[data-new-chat-search]');let timer;const search=async()=>{try{const result=await api.get('/api/users/search?q='+encodeURIComponent(input.value.trim()));const box=document.querySelector('.v4-chat-picker-results');const users=(result.users||[]).filter(u=>String(u.id)!==String(state.user?.id));box.innerHTML=users.length?users.map(u=>'<button type="button" data-action="select-new-chat" data-user-id="'+escapeHtml(u.id)+'"><img src="'+escapeHtml(u.profilePicture||'/icons/nochat-mark.svg')+'" alt=""><span><strong>'+escapeHtml(u.displayName||u.username)+'</strong><small>@'+escapeHtml(u.username)+'</small></span><i data-lucide="message-circle"></i></button>').join(''):'<p>No people found.</p>';refreshIcons();}catch(error){document.querySelector('.v4-chat-picker-results').textContent='Could not load people: '+error.message;}};input.oninput=()=>{clearTimeout(timer);timer=setTimeout(search,220);};search();input.focus();}
async function startNewChat(userId){if(!userId)return;try{const opened=await api.post('/api/conversations',{userId});const all=await api.get('/api/conversations');state.conversations=(all.conversations||[]).map(c=>({...c,otherUser:c.user||c.otherUser||null}));state.activeConvo=state.conversations.find(c=>String(c.id)===String(opened.conversation.id))||{...opened.conversation,otherUser:opened.user};const result=await api.get('/api/conversations/'+encodeURIComponent(state.activeConvo.id)+'/messages');state.messages=result.messages||[];getSocket()?.emit('conversation:join',state.activeConvo.id);document.querySelector('.v4-chat-picker')?.remove();window.location.hash='#/chat';renderApp();}catch(error){toast(error.status===401?'Login again':'Could not start chat: '+error.message);}}
function renderDiscoveryPanel(users=[]) {
  const list=users.filter(u=>String(u.id)!==String(state.user?.id));
  const suggested=list.slice(0,4);
  const active=[...list].sort((a,b)=>(Number(b.postsCount)||0)-(Number(a.postsCount)||0)||(Number(b.followersCount)||0)-(Number(a.followersCount)||0)).slice(0,3);
  return '<aside class="v3-discover-panel"><section class="v3-discover-card"><header class="v3-discover-heading"><h3>Suggested for you</h3><a href="#/discover">See all</a></header><input class="v3-discover-search" type="search" placeholder="Search people…" aria-label="Search people"><div class="v3-creator-list">'+renderCreatorRows(suggested)+'</div></section><section class="v3-discover-card"><header class="v3-discover-heading"><h3>Creators active on NoChat</h3><a href="#/reels">Reels</a></header><div class="v3-creator-list">'+renderCreatorRows(active)+'</div></section></aside>';
}
function renderCreatorRows(users=[]) {
  if(!users.length) return '<p class="v3-empty-discovery">No creator matches yet.</p>';
  return users.map(u=>'<article class="v3-creator-row"><img loading="lazy" src="'+escapeHtml(u.profilePicture||('/icons/nochat-mark.svg'))+'" alt=""><div class="v3-creator-copy"><a href="#/profile/'+encodeURIComponent(u.id)+'">'+escapeHtml(u.displayName||u.username||'NoChat member')+'</a><small>@'+escapeHtml(u.username||'human')+'</small><span class="v3-creator-reason">'+escapeHtml(u.recommendationReason||((Number(u.postsCount)||0)>0?'Sharing on NoChat':'Suggested for you'))+' · #'+escapeHtml(u.memberNumber||'—')+'</span></div><div class="v3-creator-actions"><button type="button" class="'+(u.isSubscribed?'btn-secondary':'btn-primary')+'" data-action="toggle-follow" data-user-id="'+escapeHtml(u.id)+'" aria-label="'+(u.isSubscribed?'Unfollow ':'Follow ')+escapeHtml(u.username||'person')+'">'+(u.isSubscribed?'Following':'Follow')+'</button><button type="button" class="v3-close-friend-button" data-action="v3-close-friend" data-user-id="'+escapeHtml(u.id)+'" aria-label="Toggle close friends" title="Close Friends">☆</button></div></article>').join('');
}
function bindDiscoveryEvents(root) {
  const input=root.querySelector('.v3-discover-search'); if(!input) return;
  let timer; input.addEventListener('input',()=>{ clearTimeout(timer); const q=input.value.trim(); timer=setTimeout(async()=>{ try { const r=await api.get('/api/users/search?q='+encodeURIComponent(q)); const list=root.querySelector('.v3-creator-list'); if(list) list.innerHTML=renderCreatorRows(r.users||[]); decorateV3Actions(); refreshIcons(); } catch(e) { toast(e.status===401?'Login again':'Creator search failed'); } },250); });
}

function decorateV3Actions() {
  document.querySelectorAll('.post-card').forEach(card => {
    if(card.querySelector('.post-video') && !card.querySelector('[data-action="toggle-reel-sound"]')) { const sound=document.createElement('button'); sound.type='button'; sound.className='post-action-btn v4-sound-button'; sound.dataset.action='toggle-reel-sound'; sound.textContent='Sound Off'; sound.setAttribute('aria-label','Toggle video sound'); sound.dataset.muted='true'; card.querySelector('.post-actions .post-action-group')?.append(sound); }
    const post=state.posts.find(p=>String(p.id)===String(card.dataset.postId));
    const save=card.querySelector('[data-action="bookmark-post"]'); if(save) save.type='button';
    if(post && String(post.userId)===String(state.user?.id) && !card.querySelector('[data-action="delete-post"]')) { const b=document.createElement('button'); b.type='button'; b.className='v3-delete-button'; b.dataset.action='delete-post'; b.setAttribute('aria-label','Delete post'); b.textContent='Delete'; card.querySelector('.post-header')?.append(b); }
  });
  document.querySelectorAll('.reel-item').forEach(card => {
    if(!card.querySelector('[data-action="toggle-reel-sound"]')) { const sound=document.createElement('button'); sound.type='button'; sound.className='reel-action-btn v4-sound-button'; sound.dataset.action='toggle-reel-sound'; sound.textContent='Sound Off'; sound.setAttribute('aria-label','Toggle reel sound'); if(card.querySelector('iframe')) sound.dataset.muted='true'; card.querySelector('.reel-actions-column')?.append(sound); }
    const reel=state.reels.find(p=>String(p.id)===String(card.dataset.reelId));
    if(reel && String(reel.userId)===String(state.user?.id) && !card.querySelector('[data-action="delete-reel"]')) { const b=document.createElement('button'); b.type='button'; b.className='reel-action-btn v3-delete-button'; b.dataset.action='delete-reel'; b.setAttribute('aria-label','Delete reel'); b.textContent='Delete'; card.querySelector('.reel-actions-column')?.append(b); }
  });
  const ownAvatar=document.querySelector('.profile-avatar-wrap');
  document.querySelectorAll('[data-action="open-edit-profile"]').forEach(b=>{b.dataset.action='v3-edit-profile';b.textContent='Edit profile';});
  if(ownAvatar && String(state.profileUser?.id||state.user?.id)===String(state.user?.id) && !ownAvatar.querySelector('[data-action="v3-avatar-open"]')) { const b=document.createElement('button'); b.type='button'; b.dataset.action='v3-avatar-open'; b.className='v3-avatar-edit'; b.textContent='Edit photo'; ownAvatar.append(b); }
  document.querySelectorAll('button').forEach(b=>{if(!b.type)b.type='button';});
  if(document.querySelector('.chat-header') && !document.querySelector('[data-action="v3-hug"]')) { const controls=document.createElement('div'); controls.className='v3-chat-extras'; controls.innerHTML='<button type="button" data-action="v3-hug" aria-label="Send a hug">💚 Hug</button><button type="button" data-action="v3-voice-record" aria-label="Record voice note">🎙 Voice</button>'; document.querySelector('.chat-header')?.append(controls); }
  if(document.querySelector('.profile-details') && !document.querySelector('.v3-mood-picker')) { const wrap=document.createElement('div'); wrap.className='v3-mood-picker'; wrap.innerHTML='<span>Mood</span><button type="button" data-action="v3-mood" data-mood="Happy">Happy</button><button type="button" data-action="v3-mood" data-mood="Chill">Chill</button><button type="button" data-action="v3-mood" data-mood="Tired">Tired</button><button type="button" data-action="v3-mood" data-mood="Excited">Excited</button>'; document.querySelector('.profile-details')?.append(wrap); }
}

function formatTopBarTitle(route) {
  switch (route) {
    case 'home': return 'Home';
    case 'discover': return 'Discover';
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
    const [reelsRes, usersRes, recommendationsRes, annRes] = await Promise.all([
      api.get('/api/reels').catch(() => ({ reels: [] })),
      api.get('/api/users/search?q=').catch(() => ({ users: [] })),
      api.get('/api/recommendations').catch(() => ({ users: [] })),
      api.get('/api/announcements').catch(() => ({ announcement: null }))
    ]);
    state.reels = reelsRes.reels || [];
    state.posts = state.reels; // In NoChat, user-uploaded reels are the core visual feed
    state.users = usersRes.users || [];
    state.recommendedUsers = recommendationsRes.users || [];
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
    state.conversations = (res.conversations || []).map(c => ({...c, otherUser: c.user || c.otherUser || null}));
    joinAllConversations();
    state.conversations.forEach(convo => {
      const id=convo.otherUser?.id;
      if(id==null)return;
      if(convo.isOnline)state.onlineUsers.add(String(id));
      else state.onlineUsers.delete(String(id));
    });
    if (!state.activeConvo && state.conversations.length > 0) {
      state.activeConvo = state.conversations[0];
    }
    if (state.activeConvo) {
      getSocket()?.emit('conversation:join', state.activeConvo.id);
      const msgRes = await api.get(`/api/conversations/${encodeURIComponent(state.activeConvo.id)}/messages`);
      state.messages = msgRes.messages || [];
      setCachedMessages(state.activeConvo.id, state.messages);
    }
  } catch (e) {
    console.error('Chat load failed:',e);
    state.conversations = [];
    state.messages = [];
    toast('Chats could not load: '+e.message);
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

async function loadWatchVideosCatalog() {
  try {
    const result = await api.get('/api/videos?page=1&limit=48');
    state.videos = result.videos || [];
    state.canManageVideos = Boolean(result.canManage);
    state.videoStorageReady = Boolean(result.viewsPersistent);
  } catch (error) {
    state.canManageVideos = false;
    state.videoStorageReady = false;
    try {
      const fallback = await api.get('/api/videos-catalog');
      state.videos = fallback.videos || [];
    } catch {
      state.videos = [];
      toast(error.status === 401 ? 'Login again' : 'NoChat videos could not load: ' + error.message);
    }
  }
}

async function loadProfileData(userId) {
  try {
    const targetId=userId||state.user?.id;
    const [res,allReels]=await Promise.all([
      targetId?api.get(`/api/users/profile/${encodeURIComponent(targetId)}`):api.get('/api/me'),
      api.get('/api/reels').catch(()=>({reels:[]}))
    ]);
    state.profileUser = res.user || null;
    state.profileReels=Array.isArray(res.reels)?res.reels:(allReels.reels||[]).filter(r=>String(r.userId)===String(targetId));
  } catch (e) {
    console.error('Profile load failed:',e);
    state.profileUser = state.user;
    state.profileReels=(state.reels||[]).filter(r=>String(r.userId)===String(state.user?.id));
  }
}

async function loadAdminData() {
  try {
    const [users, review] = await Promise.all([api.get('/api/admin/users'),api.get('/api/admin/review')]);
    state.users = users.users || [];
    state.reviewReels = review.reels || [];
  } catch (e) {
    state.users=[];state.reviewReels=[];
    toast(e.message || 'Restricted to founder denpherai@gmail.com');
  }
}

async function moderateQueuedReel(button) {
  const id=button.dataset.reelId,status=button.dataset.status;
  if(!id||!['approved','blocked'].includes(status))return;
  button.disabled=true;
  try {
    await api.post(`/api/admin/reels/${encodeURIComponent(id)}/review`,{status});
    state.reviewReels=state.reviewReels.filter(reel=>String(reel.id)!==String(id));
    if(status==='blocked'){state.reels=state.reels.filter(reel=>String(reel.id)!==String(id));state.posts=state.posts.filter(reel=>String(reel.id)!==String(id));}
    else await loadReelsData();
    toast(status==='approved'?'Reel approved and visible to the community':'Reel blocked');
    renderApp();
  } catch(error) {
    button.disabled=false;
    toast(error.status===401?'Login again':`Moderation failed: ${error.message}`);
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
(function ncMediaAndMobileFix() {
  if (document.getElementById("nc-media-fix")) return;
  const st = document.createElement("style");
  st.id = "nc-media-fix";
  st.textContent = ".message-bubble audio,.m-audio,.voice-note audio{display:block;width:min(260px,64vw);max-width:100%;height:40px;margin-top:4px;pointer-events:auto}" +
    "@media (max-width:760px){.chat-layout{height:calc(100dvh - var(--navbar-height) - 60px)!important}.chat-input-bar{padding-bottom:max(10px,env(safe-area-inset-bottom))!important}}";
  document.head.appendChild(st);
  // Native audio/video controls need the browser default action. Stop ancestor handlers
  // (bubble double-tap, action layer) from seeing clicks that start inside a media element.
  ["pointerdown", "mousedown", "touchstart", "click"].forEach(function (type) {
    document.addEventListener(type, function (e) {
      const t = e.target;
      if (t && t.closest && t.closest("audio,video")) e.stopPropagation();
    }, true);
  });
})();

(function ncMobileChatFix() {
  if (document.getElementById("nc-mobile-chat-fix")) return;
  const st = document.createElement("style");
  st.id = "nc-mobile-chat-fix";
  st.textContent = "@media (max-width:760px){.topbar{min-width:0;gap:8px}.topbar h1{font-size:18px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1 1 auto}.chat-main-area{display:flex!important;flex-direction:column;min-height:0;height:100%!important}.chat-main{display:flex!important;flex-direction:column;flex:1 1 auto;min-height:0;height:100%}.chat-header{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;flex:0 0 auto}.chat-recipient{flex:1 1 auto;min-width:0;overflow:hidden}.chat-recipient *{min-width:0}.chat-header-actions{flex:0 0 auto;gap:2px}.chat-header-actions button{min-width:34px!important;min-height:34px!important;width:34px;height:34px}.messages-area{flex:1 1 auto;min-height:0;overflow-y:auto}.chat-input-bar{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:8px 10px max(10px,env(safe-area-inset-bottom));background:var(--bg,#0a0a0a)}.chat-input-bar .chat-input{flex:1 1 auto;min-width:0}}";
  document.head.appendChild(st);
})();

(function ncMobileChatFix2() {
  if (document.getElementById("nc-mobile-chat-fix2")) return;
  const st = document.createElement("style");
  st.id = "nc-mobile-chat-fix2";
  st.textContent = "@media (max-width:760px){.topbar h1{font-size:16px}.main-content:has(.chat-layout){height:100dvh!important;display:flex!important;flex-direction:column!important;padding-bottom:60px!important;box-sizing:border-box!important;overflow:hidden!important}.main-content:has(.chat-layout) > .topbar{flex:0 0 auto}.main-content:has(.chat-layout) #route-container{flex:1 1 auto!important;min-height:0!important;display:flex!important;flex-direction:column!important}.main-content:has(.chat-layout) .chat-layout{flex:1 1 auto!important;height:auto!important;min-height:0!important;max-height:none!important}.main-content:has(.chat-layout) .chat-main-area{height:100%!important;min-height:0!important}}";
  document.head.appendChild(st);
})();

function bindCommonEvents() {
  // Shared NoChat action delegation handles app and landing action buttons.
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
  const postVideos=$$('.post-video');
  feedMediaObserver?.disconnect();feedMediaObserver=null;
  if(postVideos.length&&'IntersectionObserver'in window){
    feedMediaObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting){entry.target.pause();entry.target.muted=true;const btn=entry.target.closest('.post-card')?.querySelector('[data-action="toggle-reel-sound"]');if(btn){btn.dataset.muted='true';btn.textContent='Sound Off';btn.setAttribute('aria-pressed','false');}}else{entry.target.muted=!state.globalSoundEnabled;entry.target.play().catch(()=>{});}}),{threshold:.25});
    postVideos.forEach(video=>feedMediaObserver.observe(video));
  }
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

  // Data-action clicks are handled once by the shared document dispatcher.
}

function bindReelsEvents() {
  const container = $('#reels-snap-feed');
  if (!container) return;

  // Autoplay visible video only
  const videos = $$('.reel-video', container);
  reelsMediaObserver?.disconnect();
  reelsMediaObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.muted = !state.globalSoundEnabled;
        entry.target.play().catch(() => {});
      } else {
        entry.target.pause();
        entry.target.muted = true;
        const soundButton=entry.target.closest('.reel-item')?.querySelector('[data-action="toggle-reel-sound"]');
        if(soundButton){soundButton.dataset.muted='true';soundButton.textContent='Sound Off';soundButton.setAttribute('aria-pressed','false');}
      }
    });
  }, { threshold: 0.6 });

  videos.forEach(v => reelsMediaObserver.observe(v));

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

  // Reel actions are handled by the shared document dispatcher.
}

async function openCommentsDrawer(reelId) {
  const openSheet = document.querySelector('#comment-sheet');
  if (openSheet && String(openSheet.dataset.reelId) === String(reelId)) {
    openSheet.querySelector('[name="text"]')?.focus({ preventScroll: true });
    return;
  }
  let comments = [];
  try {
    const res = await api.get(`/api/reels/${reelId}/comments`);
    comments = res.comments || [];
  } catch (e) {
    comments = [];
    toast(e.status===401 ? 'Login again' : 'Comments could not be loaded: '+e.message);
  }

  $('#comment-sheet')?.remove();
  document.body.insertAdjacentHTML('beforeend', renderCommentSheet(comments.map(c=>({...c,text:c.content||c.text})), 'Reel Comments'));
  const sheetRoot = $('#comment-sheet');
  if (sheetRoot) sheetRoot.dataset.reelId = String(reelId);
  $('.comment-item').forEach((item,i)=>{ const c=comments[i]; item.dataset.commentId=c?.id||''; item.dataset.reelId=reelId; if(c?.canDelete && !item.querySelector('[data-action="delete-comment"]')) { const b=document.createElement('button'); b.type='button'; b.dataset.action='delete-comment'; b.textContent='Delete'; b.className='v3-comment-delete'; item.append(b); } });
  refreshIcons();
  requestAnimationFrame(() => sheetRoot?.querySelector('[name="text"]')?.focus({ preventScroll: true }));
}

function makeCommentNode(comment) {
  const node = document.createElement('article');
  node.className = 'comment-item';
  node.dataset.commentId = String(comment.id || '');
  node.dataset.reelId = String(comment.reelId || '');
  const avatar = document.createElement('img');
  avatar.src = comment.user?.profilePicture || '/icons/nochat-mark.svg';
  avatar.alt = '';
  avatar.loading = 'lazy';
  avatar.className = 'comment-avatar';
  const copy = document.createElement('div');
  copy.className = 'comment-copy';
  const text = document.createElement('p');
  const username = document.createElement('strong');
  username.textContent = comment.user?.username || 'human';
  const body = document.createElement('span');
  body.textContent = comment.content || comment.text || '';
  text.append(username, document.createTextNode(' '), body);
  const time = document.createElement('small');
  time.textContent = 'Just now';
  copy.append(text, time);
  node.append(avatar, copy);
  if (comment.canDelete) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.action = 'delete-comment';
    remove.textContent = 'Delete';
    remove.className = 'v3-comment-delete';
    node.append(remove);
  }
  return node;
}

async function handleCommentSubmit(event) {
  const form = event.target;
  if (!form.matches('#comment-form')) return;
  event.preventDefault();
  if (form.dataset.submitting === 'true') return;
  const sheet = form.closest('#comment-sheet');
  const reelId = sheet?.dataset.reelId;
  const input = form.elements.namedItem('text');
  const content = input?.value.trim();
  if (!reelId || !content) return;
  form.dataset.submitting = 'true';
  const submit = form.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const result = await api.post(`/api/reels/${encodeURIComponent(reelId)}/comments`, { content });
    const list = sheet.querySelector('#sheet-comments-list');
    list?.querySelector('.v4-no-comments')?.remove();
    const comment = result.comment || { reelId, content, user: state.user, canDelete: true };
    comment.reelId ||= reelId;
    comment.user ||= state.user;
    comment.canDelete = true;
    list?.append(makeCommentNode(comment));
    if (list) list.scrollTop = list.scrollHeight;
    input.value = '';
    const reel = state.reels.find(item => String(item.id) === String(reelId));
    const post = state.posts.find(item => String(item.id) === String(reelId));
    if (reel) reel.commentsCount = (Number(reel.commentsCount) || 0) + 1;
    if (post && post !== reel) post.commentsCount = (Number(post.commentsCount) || 0) + 1;
    document.querySelectorAll(`.reel-item[data-reel-id="${CSS.escape(String(reelId))}"] [data-action="reel-comment"] span`).forEach(el => { if (reel) el.textContent = String(reel.commentsCount); });
    document.querySelectorAll(`.post-card[data-post-id="${CSS.escape(String(reelId))}"] .post-comments-link`).forEach(el => { if (post) el.textContent = `View all ${post.commentsCount} comments`; });
    toast('Comment posted');
    input.focus({ preventScroll: true });
  } catch (error) {
    toast(error.status === 401 ? 'Login again' : 'Comment failed: ' + error.message);
  } finally {
    form.dataset.submitting = 'false';
    if (submit?.isConnected) submit.disabled = false;
  }
}

function bindChatEvents() {
  // Switch conversation
  $$('.chat-row').forEach(row => {
    row.onclick = async () => {
      const cid = row.dataset.convoId;
      state.activeConvo = state.conversations.find(c => String(c.id) === String(cid));
      getSocket()?.emit('conversation:join', cid);
      state.messages = [];
      const msgRes = await api.get(`/api/conversations/${encodeURIComponent(cid)}/messages`).catch(error => { toast('Messages could not load: '+error.message); return { messages: [] }; });
      state.messages = msgRes.messages || [];
      setCachedMessages(cid, state.messages);
      renderApp();
    };
  });

  // Typing indicator: start (throttled) and stop after 2.5s idle
  const typingBox = $("#chat-message-input");
  if (typingBox && state.activeConvo) {
    const convoId = state.activeConvo.id;
    let lastSent = 0, stopTimer = null;
    typingBox.addEventListener("input", () => {
      const sock = getSocket();
      if (!sock || !sock.connected) return;
      const now = Date.now();
      if (now - lastSent > 2000) { sock.emit("typing:start", { conversationId: convoId }); lastSent = now; }
      clearTimeout(stopTimer);
      stopTimer = setTimeout(() => sock.emit("typing:stop", { conversationId: convoId }), 2500);
    });
  }

  // Send message form
  const sendForm = $('#chat-send-form');
  if (sendForm) {
    sendForm.onsubmit = async (e) => {
      e.preventDefault();
      const input = $('#chat-message-input');
      const text = input.value.trim();
      if (!text || !state.activeConvo) return;

      const conversationId=String(state.activeConvo.id);
      const body = { text };
      if (state.replyingToMessage) {
        body.replyToId = state.replyingToMessage.id;
        state.replyingToMessage = null;
        $('#reply-bar')?.classList.add('hidden');
      }

      const optimistic={id:`local-${Date.now()}-${Math.random().toString(36).slice(2)}`,conversationId,senderId:state.user.id,senderUsername:state.user.username,senderDisplayName:state.user.displayName||state.user.username,text,createdAt:new Date().toISOString(),pending:true};
      state.messages.push(optimistic);
      input.value='';
      setCachedMessages(conversationId,state.messages);
      renderChatWindowArea();
      $('#chat-message-input')?.focus({preventScroll:true});
      try {
        const result=await api.post(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, body);
        const cached=getCachedMessages(conversationId)||[];
        const committed=cached.filter(item=>String(item.id)!==String(optimistic.id));
        if(result.message&&!committed.some(item=>String(item.id)===String(result.message.id)))committed.push(result.message);
        setCachedMessages(conversationId,committed);
        if(String(state.activeConvo?.id)===conversationId){state.messages=committed;renderChatWindowArea();}
      } catch (err) {
        const cached=(getCachedMessages(conversationId)||[]).filter(item=>String(item.id)!==String(optimistic.id));
        setCachedMessages(conversationId,cached);
        if(String(state.activeConvo?.id)===conversationId){state.messages=cached;renderChatWindowArea();}
        toast(err.status===401?'Login again':'Message not sent: '+(err.message || 'try again'));
        if(!$('#chat-message-input')?.value)$('#chat-message-input').value=text;
      }
    };
  }

  // Message actions, attachments, and call buttons use the shared action dispatcher.
}

function renderChatWindowArea() {
  const container = $('.chat-main-area');
  if (container) {
    // Refresh only the open conversation. Rendering ChatPage here nests a second
    // chat-layout inside .chat-main-area every time a message arrives or is sent.
    const otherUserId = state.activeConvo?.otherUser?.id;
  const isRecipientOnline = otherUserId != null && state.onlineUsers.has(String(otherUserId));
    const oldInput = $("#chat-message-input");
    const draft = oldInput ? oldInput.value : "";
    const hadFocus = !!oldInput && document.activeElement === oldInput;
    const oldScroll = $("#chat-messages-scroll");
    const atBottom = !oldScroll || (oldScroll.scrollHeight - oldScroll.scrollTop - oldScroll.clientHeight) < 80;
    const prevTop = oldScroll ? oldScroll.scrollTop : 0;
    container.innerHTML = renderChatWindow(state.activeConvo, state.messages, state.user?.id, isRecipientOnline);
    bindChatEvents();
    refreshIcons();
    const newInput = $("#chat-message-input");
    if (newInput && draft) newInput.value = draft;
    if (newInput && hadFocus) newInput.focus();
    const scroll = $("#chat-messages-scroll");
    if (scroll) scroll.scrollTop = atBottom ? scroll.scrollHeight : prevTop;
    // "Seen" under my latest message once the other person has read it
    const lastMine = [...state.messages].reverse().find(m => String(m.senderId) === String(state.user?.id) && !m.pending);
    if (lastMine && lastMine.readBy > 0) {
      const node = document.querySelector("[data-message-id=\"" + CSS.escape(String(lastMine.id)) + "\"]");
      if (node && !node.querySelector(".nc-seen")) node.insertAdjacentHTML("beforeend", "<span class=\"nc-seen\">Seen</span>");
    }
  }
}

let activeCall=null; let incomingCall=null;
const pendingCallIce=new Map();
async function startPeerCall(video) {
  const convo=state.activeConvo; const peerId=convo?.otherUser?.id;
  if(!convo||!peerId) { toast('Open a chat before starting a call'); return; }
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection) { toast('Calls require a secure HTTPS browser with microphone access'); return; }
  try { const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:video?{facingMode:'user'}:false}); activeCall={conversationId:convo.id,peerId,video,stream,pc:null,pendingIce:[],incoming:false}; await createCallPeer(); showCallStage(); emitSocketEvent('call:invite',{conversationId:convo.id,targetUserId:peerId,video},result=>{if(result?.error){toast(result.error);endPeerCall(false);}}); toast('Calling '+(convo.otherUser.displayName||convo.otherUser.username||'human')+'…'); } catch(e) { endPeerCall(false); toast(e.name==='NotAllowedError'?'Allow microphone/camera access to call':'Call failed: '+e.message); }
}
function showIncomingCall(payload) { if(activeCall) { emitSocketEvent('call:decline',{conversationId:payload.conversationId,targetUserId:payload.callerId}); return; } incomingCall=payload; document.querySelector('.v4-incoming-call')?.remove(); document.body.insertAdjacentHTML('beforeend','<div class="v4-incoming-call"><section><h3>Incoming '+(payload.video?'video':'voice')+' call</h3><p>'+escapeHtml(payload.caller?.displayName||payload.caller?.username||'NoChat member')+'</p><button type="button" data-action="call-accept">Accept</button><button type="button" data-action="call-decline">Decline</button></section></div>'); }
async function acceptPeerCall() { const payload=incomingCall;if(!payload)return;document.querySelector('.v4-incoming-call')?.remove();incomingCall=null;try { const convo=state.conversations.find(c=>String(c.id)===String(payload.conversationId));activeCall={conversationId:payload.conversationId,peerId:payload.callerId,video:payload.video,stream:await navigator.mediaDevices.getUserMedia({audio:true,video:payload.video?{facingMode:'user'}:false}),pc:null,pendingIce:pendingCallIce.get(String(payload.conversationId))||[],incoming:true};pendingCallIce.delete(String(payload.conversationId));state.activeConvo=convo||{id:payload.conversationId,otherUser:payload.caller};await createCallPeer();showCallStage();emitSocketEvent('call:accept',{conversationId:payload.conversationId,targetUserId:payload.callerId});}catch(e){emitSocketEvent('call:decline',{conversationId:payload.conversationId,targetUserId:payload.callerId});endPeerCall(false);toast('Could not answer: '+e.message);} }
async function createCallPeer() {
  const config=await api.get('/api/calls/ice').catch(()=>({iceServers:[{urls:['stun:stun.l.google.com:19302']}],turn:{configured:false,status:'unavailable',message:'TURN settings could not load.'}}));
  if(!config.turn?.configured||config.turn.status!=='ready')toast('TURN relay is not ready. Calls may fail on mobile or restricted networks.');
  const pc=new RTCPeerConnection({iceServers:config.iceServers||[{urls:'stun:stun.l.google.com:19302'}],iceTransportPolicy:config.iceTransportPolicy||'all'});
  activeCall.pc=pc;activeCall.turnStatus=config.turn;
  activeCall.stream.getTracks().forEach(t=>pc.addTrack(t,activeCall.stream));
  pc.onicecandidate=e=>{if(e.candidate){if(/\btyp relay\b/.test(e.candidate.candidate||''))activeCall.relaySelected=true;emitSocketEvent('call:ice',{conversationId:activeCall.conversationId,targetUserId:activeCall.peerId,signal:e.candidate});}};
  pc.ontrack=e=>{const remote=document.querySelector('[data-call-remote]');if(remote){remote.srcObject=e.streams[0];remote.play().catch(()=>{});}};
  pc.oniceconnectionstatechange=()=>{const status=document.querySelector('[data-call-status]');if(status){status.textContent=pc.iceConnectionState==='connected'||pc.iceConnectionState==='completed'?(activeCall?.relaySelected?'Connected · relay':'Connected'):`ICE ${pc.iceConnectionState}`;}};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'){toast('Call connection failed. Check TURN relay and network permissions.');setTimeout(()=>{if(activeCall?.pc===pc)endPeerCall(false);},1200);}else if(pc.connectionState==='closed'&&activeCall?.pc===pc){endPeerCall(false);}};
}
async function sendCallOffer() { if(!activeCall?.pc)return;try{const offer=await activeCall.pc.createOffer();await activeCall.pc.setLocalDescription(offer);emitSocketEvent('call:offer',{conversationId:activeCall.conversationId,targetUserId:activeCall.peerId,signal:activeCall.pc.localDescription});}catch(e){toast('Could not start call: '+e.message);endPeerCall(true);} }
async function flushCallIce(){if(!activeCall?.pc?.remoteDescription)return;for(const candidate of activeCall.pendingIce.splice(0))await activeCall.pc.addIceCandidate(candidate).catch(()=>{});}
function showCallStage(){document.querySelector('.v4-call-stage')?.remove();document.body.insertAdjacentHTML('beforeend','<div class="v4-call-stage"><section><header>'+(activeCall.video?'Video call':'Voice call')+'<span data-call-status>Connecting…</span></header><video data-call-remote autoplay playsinline '+(activeCall.video?'':'class="v4-audio-call"')+'></video><video data-call-local autoplay muted playsinline '+(activeCall.video?'':'hidden')+'></video><footer><button type="button" data-action="call-mic">Mute mic</button>'+(activeCall.video?'<button type="button" data-action="call-camera">Turn camera off</button>':'')+'<button type="button" class="v4-call-end" data-action="call-end">End call</button></footer></section></div>');const local=document.querySelector('[data-call-local]');if(local&&activeCall.video){local.srcObject=activeCall.stream;local.play().catch(()=>{});} }
function endPeerCall(notify=true){if(activeCall){pendingCallIce.delete(String(activeCall.conversationId));if(notify)emitSocketEvent('call:end',{conversationId:activeCall.conversationId,targetUserId:activeCall.peerId});activeCall.pc?.close();activeCall.stream?.getTracks().forEach(t=>t.stop());activeCall=null;}document.querySelector('.v4-call-stage')?.remove();}
function handleCallAction(action){if(action==='call-accept')acceptPeerCall();else if(action==='call-decline'){if(incomingCall)emitSocketEvent('call:decline',{conversationId:incomingCall.conversationId,targetUserId:incomingCall.callerId});incomingCall=null;document.querySelector('.v4-incoming-call')?.remove();}else if(action==='call-end')endPeerCall(true);else if(action==='call-mic'&&activeCall){const track=activeCall.stream.getAudioTracks()[0];if(track){track.enabled=!track.enabled;document.querySelector('[data-action="call-mic"]').textContent=track.enabled?'Mute mic':'Unmute mic';}}else if(action==='call-camera'&&activeCall){const track=activeCall.stream.getVideoTracks()[0];if(track){track.enabled=!track.enabled;document.querySelector('[data-action="call-camera"]').textContent=track.enabled?'Turn camera off':'Turn camera on';}}}

function bindWatchPartyEvents() {
  $$('.watch-tab-btn').forEach(btn => btn.onclick = () => { state.activeWatchCategory = btn.dataset.category; renderApp(); });
  const playerModal=$('#video-player-modal');
  if(playerModal&&!playerModal.dataset.backdropReady){playerModal.dataset.backdropReady='true';playerModal.addEventListener('click',event=>{if(event.target===playerModal)closeWatchVideo();});}
  // Video card actions are delegated through the shared NoChat action router.
}

function decorateNavigationButtons() {
  document.querySelectorAll('.sidebar .nav-item, .tabbar .tab').forEach(link => {
    if (link.tagName === 'BUTTON') return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = link.className;
    const route = (link.getAttribute('href') || '').replace(/^#\/?/, '') || 'home';
    button.dataset.route = route; button.dataset.action = route === 'videos' ? 'search' : route;
    button.innerHTML = link.innerHTML; link.replaceWith(button);
  });
}

function bindProfileEvents() {
  $$('.profile-tab').forEach(tab => {
    tab.onclick = () => {
      state.profileTab=tab.dataset.tab||'posts';
      renderApp();
    };
  });

  // Open a selected profile reel directly in the full-screen reels feed.
  $$('.profile-grid .grid-item[data-type="reel"]').forEach(tile => {
    const openReel = () => {
      const reelId = tile.dataset.itemId;
      if (!reelId) return;
      window.location.hash = '#/reels/' + encodeURIComponent(reelId);
    };
    tile.addEventListener('click', openReel);
    tile.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openReel();
      }
    });
  });
}

function bindAdminEvents() {
  $$('[data-action="admin-ban-user"]').forEach(btn => {
    btn.onclick = async () => {
      const uid = btn.dataset.userId;
      const name = btn.dataset.username || "this user";
      const reason = window.prompt("Reason for banning @" + name + ":");
      if (!reason || !reason.trim()) return;
      if (!window.confirm("Ban @" + name + "? They will be signed out and cannot log in.")) return;
      try {
        await api.post("/api/admin/users/" + encodeURIComponent(uid) + "/action", {
          action: "ban",
          reason: reason.trim(),
          confirm: name
        });
        toast("@" + name + " has been banned");
        renderApp();
      } catch (err) {
        toast(err.message || "Could not ban this user.");
      }
    };
  });

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
        const result = await api.post('/api/reels', formData);
        clearInterval(timer);
        if (progressBar) progressBar.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';
        const status = result.reel?.moderationStatus || 'approved';
        if (status === 'blocked') {
          toast(`Reel wasn't published: ${result.reel?.moderationReason || 'It did not pass NoChat review.'}`);
          submitBtn.disabled = false;
          progressWrap?.classList.add('hidden');
          return;
        }
        toast(status === 'pending' ? 'Reel uploaded. It is under review and visible to you in Reels.' : 'Reel shared successfully!');
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

const pendingLikes = new Map();
const likeQueues = new Map();

function handleDelegatedAction(event, button, action) {
  if (!button) return;
  if (action === 'open-upload-modal') { event.preventDefault(); openReelUploadModal(); return; }
  if (action === 'logout') { event.preventDefault(); showSignOutModal(); return; }
  if (action === 'open-auth') { event.preventDefault(); $('#auth-modal')?.classList.remove('hidden'); refreshIcons(); return; }
  if (action === 'close-auth') { event.preventDefault(); $('#auth-modal')?.classList.add('hidden'); return; }
  if (action === 'close-modal') { event.preventDefault(); button.closest('.modal-overlay')?.classList.add('hidden'); return; }
  if (action === 'open-announcement-modal') { event.preventDefault(); openAnnouncementModal(); return; }
  if (action === 'close-announcement-modal') { event.preventDefault(); button.closest('.v4-announcement-modal')?.remove(); return; }
  if (action === 'toggle-like' || action === 'reel-like') { event.preventDefault(); toggleLikeOptimistically(button); return; }
  if (action === 'open-comments' || action === 'reel-comment') { event.preventDefault(); const owner=button.closest('[data-post-id],[data-reel-id]'); const id=owner?.dataset.postId||owner?.dataset.reelId; if(id) void openCommentsDrawer(id); return; }
  if (action === 'close-sheet') { event.preventDefault(); button.closest('#comment-sheet')?.remove(); return; }
  if (action === 'start-video-call') { event.preventDefault(); void startPeerCall(true); return; }
  if (action === 'start-voice-call') { event.preventDefault(); void startPeerCall(false); return; }
  if (action === 'moderate-reel') { event.preventDefault(); void moderateQueuedReel(button); return; }
  if (action === 'attach-file' || action === 'delete-message' || action === 'edit-message' || action === 'cancel-reply' || action === 'reply-message' || action === 'react-heart') { event.preventDefault(); void handleChatAction(action, button); return; }
  if (action === 'stories-scroll-left' || action === 'stories-scroll-right') {
    event.preventDefault();
    const row=button.closest('.stories-shell')?.querySelector('.stories-bar');
    row?.scrollBy({ left: (action === 'stories-scroll-left' ? -1 : 1) * Math.max(230, row.clientWidth * .72), behavior: 'smooth' });
    return;
  }
  if (action === 'watch-video' || action === 'watch-trailer') { event.preventDefault(); openWatchVideo(button); return; }
  if (action === 'close-video-modal') { event.preventDefault(); closeWatchVideo(); return; }
  if (action === 'watch-toggle-sound') { event.preventDefault(); const video=$('#video-player-modal video'); if(video){video.muted=!video.muted;button.textContent=video.muted?'Sound Off':'Sound On';} return; }
  if (action === 'open-video-upload') { event.preventDefault(); if(!state.canManageVideos){toast('Only the NoChat founder can add library videos');return;} document.querySelector('[data-video-upload-modal]')?.removeAttribute('hidden'); refreshIcons(); return; }
  if (action === 'close-video-upload') { event.preventDefault(); document.querySelector('[data-video-upload-modal]')?.setAttribute('hidden',''); return; }
  if (action === 'delete-catalog-video') { event.preventDefault(); void deleteCatalogVideo(button); return; }
  if (action === 'discuss-chat') { event.preventDefault(); window.location.hash='#/chat'; toast('Choose a chat to discuss this video'); return; }
  if (action === 'player-load' || button.hasAttribute('data-player-load')) { event.preventDefault(); loadWatchPlayer(button); return; }
  handleV4Action(event);
}

function openReelUploadModal() {
  let modal=$('#reel-upload-modal');
  if(!modal){document.body.insertAdjacentHTML('beforeend',renderReelUploadModal());modal=$('#reel-upload-modal');bindUploadModalEvents();}
  modal?.classList.remove('hidden');
  refreshIcons();
}

function renderLikeState(id, isLiked, likesCount) {
  const models=[...state.posts,...state.reels].filter(item=>String(item.id)===String(id));
  for(const item of models){item.isLiked=isLiked;item.likesCount=likesCount;}
  document.querySelectorAll(`.post-card[data-post-id="${CSS.escape(String(id))}"],.reel-item[data-reel-id="${CSS.escape(String(id))}"]`).forEach(card=>{
    card.querySelectorAll('[data-action="toggle-like"],[data-action="reel-like"]').forEach(button=>{
      button.classList.toggle('liked',isLiked);
      const icon=button.querySelector('svg'); if(icon) icon.style.fill=isLiked?'var(--like-red)':'none';
      const count=button.querySelector('span'); if(count) count.textContent=String(likesCount);
    });
    const likes=card.querySelector('.post-likes'); if(likes) likes.textContent=`${likesCount} likes`;
  });
}

function toggleLikeOptimistically(button) {
  const owner=button.closest('[data-post-id],[data-reel-id]');
  const id=owner?.dataset.postId||owner?.dataset.reelId;
  if(!id)return;
  const model=[...state.posts,...state.reels].find(item=>String(item.id)===String(id));
  const previousLiked=Boolean(model?.isLiked ?? button.classList.contains('liked'));
  const previousCount=Number(model?.likesCount ?? owner.querySelector('.post-likes')?.textContent.match(/\d+/)?.[0] ?? button.querySelector('span')?.textContent ?? 0)||0;
  const nextLiked=!previousLiked;
  const nextCount=Math.max(0,previousCount+(nextLiked?1:-1));
  renderLikeState(id,nextLiked,nextCount);
  const pending=(pendingLikes.get(id)||0)+1; pendingLikes.set(id,pending);
  const previous=likeQueues.get(id)||Promise.resolve();
  const request=previous.catch(()=>{}).then(()=>api.post(`/api/reels/${encodeURIComponent(id)}/like`));
  likeQueues.set(id,request);
  request.then(result=>{
    if(pendingLikes.get(id)===1) renderLikeState(id,Boolean(result.isLiked),Number(result.likesCount)||0);
  }).catch(error=>{
    const offline=!navigator.onLine||!Number(error.status);
    if(offline){queueOfflineLike(id);toast('Like queued — it will sync when you’re back online');}
    else { toast(error.status===401?'Login again':'Like failed: '+error.message); if(pendingLikes.get(id)===1)renderLikeState(id,previousLiked,previousCount); }
  }).finally(()=>{
    const remaining=Math.max(0,(pendingLikes.get(id)||1)-1);
    if(remaining)pendingLikes.set(id,remaining);else pendingLikes.delete(id);
    if(likeQueues.get(id)===request)likeQueues.delete(id);
  });
}

function queueOfflineLike(id) {
  try { const queue=JSON.parse(localStorage.getItem('nochat:pending-likes:v1')||'[]'); queue.push(String(id)); localStorage.setItem('nochat:pending-likes:v1',JSON.stringify(queue.slice(-200))); } catch {}
}

async function flushOfflineLikes() {
  let queue=[]; try { queue=JSON.parse(localStorage.getItem('nochat:pending-likes:v1')||'[]'); } catch { return; }
  while(queue.length){const id=queue[0];try{const result=await api.post(`/api/reels/${encodeURIComponent(id)}/like`);renderLikeState(id,Boolean(result.isLiked),Number(result.likesCount)||0);queue.shift();localStorage.setItem('nochat:pending-likes:v1',JSON.stringify(queue));}catch{return;}}
}

async function handleChatAction(action, button) {
  const conversation=state.activeConvo;
  if(action==='cancel-reply'){state.replyingToMessage=null;$('#reply-bar')?.classList.add('hidden');return;}
  if(action==='reply-message'){const id=button.dataset.messageId,user=button.dataset.user,text=button.dataset.text;state.replyingToMessage={id,user,text};$('#reply-bar-user').textContent=user||'human';$('#reply-bar-text').textContent=text||'';$('#reply-bar')?.classList.remove('hidden');$('#chat-message-input')?.focus();return;}
  if(action==='react-heart'){const id=button.dataset.messageId;if(id&&conversation)await api.post(`/api/conversations/${encodeURIComponent(conversation.id)}/messages/${encodeURIComponent(id)}/react`,{reaction:'❤️'}).catch(error=>toast('Reaction failed: '+error.message));return;}
  if(action==='delete-message'){const id=button.dataset.messageId;if(!id||!conversation||!confirm('Delete this message?'))return;button.disabled=true;try{await api.delete(`/api/conversations/${encodeURIComponent(conversation.id)}/messages/${encodeURIComponent(id)}`);state.messages=state.messages.filter(message=>String(message.id)!==String(id));setCachedMessages(conversation.id,state.messages);renderChatWindowArea();toast('Message deleted');}catch(error){button.disabled=false;toast(error.status===401?'Login again':'Delete failed: '+error.message);}return;}
  if(action==='edit-message'){const id=button.dataset.messageId,old=button.dataset.text||'';if(!id||!conversation)return;const text=prompt('Edit message',old);if(text===null||!text.trim())return;button.disabled=true;try{const result=await api.put(`/api/conversations/${encodeURIComponent(conversation.id)}/messages/${encodeURIComponent(id)}`,{text:text.trim()});const message=state.messages.find(item=>String(item.id)===String(id));if(message){message.text=result.message?.text||text.trim();message.isEdited=true;}setCachedMessages(conversation.id,state.messages);renderChatWindowArea();toast('Message edited');}catch(error){button.disabled=false;toast(error.status===401?'Login again':'Edit failed: '+error.message);}return;}
  if(action==='attach-file'){
    let picker=$('#chat-attachment-picker');
    if(!picker){picker=document.createElement('input');picker.id='chat-attachment-picker';picker.type='file';picker.accept='image/*,video/mp4,video/webm,video/quicktime,audio/*,.pdf,.txt,.doc,.docx';picker.hidden=true;document.body.append(picker);picker.addEventListener('change',async()=>{const file=picker.files?.[0],active=state.activeConvo;if(!file||!active)return;if(file.size>20*1024*1024){toast('Attachments must be 20 MB or smaller');picker.value='';return;}const form=new FormData();form.append('file',file,file.name);try{const result=await api.post(`/api/conversations/${encodeURIComponent(active.id)}/attachments`,form);if(result.message&&!state.messages.some(item=>String(item.id)===String(result.message.id)))state.messages.push(result.message);setCachedMessages(active.id,state.messages);renderChatWindowArea();toast('Attachment sent');}catch(error){toast(error.status===401?'Login again':'Attachment failed: '+error.message);}finally{picker.value='';}});}
    picker.click();
  }
}

function openWatchVideo(button) {
  const modal=$('#video-player-modal'),box=modal?.querySelector('.modal-box');
  if(!modal||!box)return;
  const title=button.dataset.title||'NoChat video';
  const provider=button.dataset.provider||'youtube';
  if(provider==='upload'){
    const src=button.dataset.videoUrl;
    if(!src){toast('This video file is unavailable');return;}
    box.innerHTML='<header class="v2-modal-header"><h3 id="video-player-title"></h3><button type="button" class="btn-icon" data-action="close-video-modal" aria-label="Close video">×</button></header><div class="v2-player-frame"><video controls autoplay muted playsinline preload="metadata" src="'+escapeHtml(src)+'"></video></div><div class="v2-player-controls"><button type="button" data-action="watch-toggle-sound">Sound Off</button><span>Uploaded to NoChat</span></div>';
  }else if(provider==='vimeo'){
    const id=button.dataset.embedId||'';
    if(!/^\d{6,12}$/.test(id)){toast('Invalid video link');return;}
    const src='https://player.vimeo.com/video/'+id+'?dnt=1&title=0&byline=0';
    box.innerHTML='<header class="v2-modal-header"><h3 id="video-player-title"></h3><button type="button" class="btn-icon" data-action="close-video-modal" aria-label="Close video">×</button></header><div class="v2-player-frame"><iframe title="Vimeo video player" src="'+src+'" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><div class="v2-player-controls"><span>Vimeo · Official video</span><a href="https://vimeo.com/'+id+'" target="_blank" rel="noopener noreferrer">Open in Vimeo</a></div>';
  }else{
    const id=parseYouTubeId('https://youtu.be/'+(button.dataset.embedId||''))||(/^[A-Za-z0-9_-]{11}$/.test(button.dataset.embedId||'')?button.dataset.embedId:'');
    if(!id){toast('Invalid video link');return;}
    box.innerHTML='<header class="v2-modal-header"><h3 id="video-player-title"></h3><button type="button" class="btn-icon" data-action="close-video-modal" aria-label="Close video">×</button></header>'+playerMarkup(id,title);
    activatePlayer(box,id);
  }
  const titleEl=$('#video-player-title');if(titleEl)titleEl.textContent=title;
  modal.classList.remove('hidden');
  const videoId=button.dataset.videoId;if(videoId)api.post(`/api/videos/${encodeURIComponent(videoId)}/view`,{}).then(result=>{const item=state.videos.find(video=>String(video.id)===String(videoId));if(item&&result.views!=null)item.views=result.views;}).catch(()=>{});
}

function closeWatchVideo(){const modal=$('#video-player-modal');if(!modal)return;modal.classList.add('hidden');modal.querySelectorAll('video').forEach(video=>{video.pause();video.removeAttribute('src');video.load();});modal.querySelectorAll('iframe').forEach(frame=>frame.setAttribute('src',''));}

function loadWatchPlayer(button){const input=button.closest('.v2-player-error')?.querySelector('[data-player-url]');const id=parseYouTubeId(input?.value||'');const modal=$('#video-player-modal'),box=modal?.querySelector('.modal-box');if(!id){toast('Paste a valid YouTube link');return;}if(box){box.innerHTML=playerMarkup(id,'NoChat video');activatePlayer(box,id);}}

async function deleteCatalogVideo(button){const id=button.dataset.videoId;if(!id||!state.canManageVideos||!confirm('Delete this NoChat video?'))return;button.disabled=true;try{await api.delete(`/api/videos/${encodeURIComponent(id)}`);state.videos=state.videos.filter(video=>String(video.id)!==String(id));toast('Video deleted');renderApp();}catch(error){button.disabled=false;toast(error.status===401?'Login again':'Video delete failed: '+error.message);}}

async function handleVideoCatalogSubmit(event){const form=event.target;if(!form.matches('[data-video-upload-form]'))return;event.preventDefault();if(!state.canManageVideos){toast('Only the NoChat founder can add library videos');return;}const file=form.elements.namedItem('video')?.files?.[0];if(!file){toast('Choose a video file');return;}if(file.size>100*1024*1024){toast('Video files must be 100 MB or smaller');return;}const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;const data=new FormData(form);try{const result=await api.post('/api/videos/upload',data);if(result.video)state.videos.unshift(result.video);document.querySelector('[data-video-upload-modal]')?.setAttribute('hidden','');toast('Video uploaded to NoChat');renderApp();}catch(error){const message=error.code==='VIDEO_SCHEMA_MISSING'?'Video storage is not enabled on this server yet. Reel uploads are still available.':error.status===401?'Login again':error.message;toast('Video upload failed: '+message);}finally{if(submit?.isConnected)submit.disabled=false;}}

function wireStoryScroller(root) {
  const row=root.querySelector('.stories-bar');
  if(!row||row.dataset.storyScrollReady)return;
  row.dataset.storyScrollReady='true';
  const left=root.querySelector('.story-scroll-left'),right=root.querySelector('.story-scroll-right');
  const update=()=>{
    const overflow=row.scrollWidth>row.clientWidth+2;
    if(left)left.hidden=!overflow||row.scrollLeft<=2;
    if(right)right.hidden=!overflow||row.scrollLeft+row.clientWidth>=row.scrollWidth-2;
  };
  row.addEventListener('scroll',update,{passive:true});
  row.addEventListener('wheel',event=>{
    if(row.scrollWidth<=row.clientWidth+2)return;
    const delta=Math.abs(event.deltaY)>Math.abs(event.deltaX)?event.deltaY:event.deltaX;
    if(delta){event.preventDefault();row.scrollLeft+=delta;}
  },{passive:false});
  let drag=null;
  row.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='mouse'||event.button!==0)return;
    drag={pointerId:event.pointerId,startX:event.clientX,startLeft:row.scrollLeft,moved:false};
  });
  row.addEventListener('pointermove',event=>{
    if(!drag||drag.pointerId!==event.pointerId)return;
    const distance=event.clientX-drag.startX;
    if(Math.abs(distance)>4){drag.moved=true;row.classList.add('is-dragging');row.setPointerCapture?.(event.pointerId);event.preventDefault();}
    if(drag.moved)row.scrollLeft=drag.startLeft-distance;
  });
  const endDrag=event=>{
    if(!drag||drag.pointerId!==event.pointerId)return;
    if(drag.moved){row.dataset.suppressStoryClick='true';setTimeout(()=>{delete row.dataset.suppressStoryClick;},500);}
    drag=null;row.classList.remove('is-dragging');
  };
  row.addEventListener('pointerup',endDrag);
  row.addEventListener('pointercancel',endDrag);
  row.addEventListener('click',event=>{
    if(row.dataset.suppressStoryClick!=='true')return;
    event.preventDefault();event.stopPropagation();delete row.dataset.suppressStoryClick;
  },true);
  if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(update);observer.observe(row);row._storyResizeObserver=observer;}
  requestAnimationFrame(update);
}

// Kick off app on load
window.addEventListener('DOMContentLoaded', initApp);

