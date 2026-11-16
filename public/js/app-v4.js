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
import { parseYouTubeId, playerMarkup, activatePlayer, mountYouTubeReels } from './player-v2.js';
import { installActionsV3 } from './actions-v3.js';

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
  unreadTotal: 0,
  notifications: [],
  unreadNotifications: 0,
  stories: [],
  activeStoryIndex: 0,
  activeStoryList: []
};

/* ---------- Initialization ---------- */
async function initApp() {
  installActionsV3({ getState: () => state, toast, onDelete: id => { state.posts=state.posts.filter(x=>String(x.id)!==String(id)); state.reels=state.reels.filter(x=>String(x.id)!==String(id)); }, onAvatarUpdated: user => { state.user=user; state.profileUser=user; }, onChatDeleted: id => { state.conversations=state.conversations.filter(c=>String(c.id)!==String(id)); if(String(state.activeConvo?.id)===String(id)){state.activeConvo=null;state.messages=[];} renderApp(); } });
  document.addEventListener('click', handleV4Action);
  document.addEventListener('submit', handleStorySubmit);
  document.addEventListener('submit', handlePostSubmit);
  wireStoryPreview();
  // Delegated navigation survives rerenders and works when the icon itself is clicked.
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const route = target.dataset.route || ({ home: 'home', reels: 'reels', chat: 'chat', profile: 'profile', search: 'home', create: 'reels' }[target.dataset.action]);
    if (route) window.location.hash = `#/${route}`;
  });
  window.addEventListener('hashchange', handleRouteChange);

  // Subscribe to auth updates
  subscribeAuth((user) => {
    state.user = user;
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

  onSocketEvent('conversation:update', async () => { if(state.route!=='chat') return; const r=await api.get('/api/conversations').catch(()=>({conversations:[]})); state.conversations=(r.conversations||[]).map(c=>({...c,otherUser:c.user||c.otherUser||null})); if(!state.activeConvo || !state.conversations.some(c=>c.id===state.activeConvo.id)) state.activeConvo=state.conversations[0]||null; renderApp(); });
  onSocketEvent('message:reaction', ({ conversationId, messageId, reactions }) => {
    if (state.activeConvo && state.activeConvo.id === conversationId) {
      const msg = state.messages.find(m => m.id === messageId);
      if (msg) {
        msg.reactions = reactions;
        renderChatWindowArea();
      }
    }
  });

  onSocketEvent('post:new', post => { state.posts.unshift(post); state.reels.unshift(post); if(state.route==='home') renderApp(); });
  onSocketEvent('reel:new', reel => { state.reels.unshift(reel); state.posts.unshift(reel); if(String(reel.userId)!==String(state.user?.id)) addV4Notification({text:`New reel from ${reel.user?.displayName||reel.user?.username||'a creator'}`,avatar:reel.user?.profilePicture,userId:reel.userId}); if(state.route==='home') renderApp(); });
  onSocketEvent('reel:liked', ({ user, reelId }) => { if(String(state.reels.find(r=>r.id===reelId)?.userId)===String(state.user?.id)) addV4Notification({text:`${user?.displayName||user?.username||'Someone'} liked your post`,avatar:user?.profilePicture,userId:user?.id}); });
  onSocketEvent('user:subscribed', ({ subscriber }) => addV4Notification({text:`${subscriber?.displayName||subscriber?.username||'Someone'} started following you`,avatar:subscriber?.profilePicture,userId:subscriber?.id}));
  onSocketEvent('message:new', (message) => { if(String(message.senderId)!==String(state.user?.id)) addV4Notification({text:`${message.senderDisplayName||message.senderUsername||'Someone'} sent you a message`,avatar:message.senderAvatar}); });
  onSocketEvent('call:incoming', payload => showIncomingCall(payload));
  onSocketEvent('call:accepted', async payload => { if(activeCall && payload.conversationId===activeCall.conversationId) await sendCallOffer(); });
  onSocketEvent('call:declined', () => { toast('Call declined'); endPeerCall(false); });
  onSocketEvent('call:offer', async payload => { if(!activeCall || payload.conversationId!==activeCall.conversationId) return; try { await activeCall.pc.setRemoteDescription(payload.signal); await flushCallIce(); const answer=await activeCall.pc.createAnswer(); await activeCall.pc.setLocalDescription(answer); emitSocketEvent('call:answer',{conversationId:activeCall.conversationId,targetUserId:activeCall.peerId,signal:activeCall.pc.localDescription}); } catch(e) { toast('Could not connect call: '+e.message); endPeerCall(true); } });
  onSocketEvent('call:answer', async payload => { if(activeCall && payload.conversationId===activeCall.conversationId) { try { await activeCall.pc.setRemoteDescription(payload.signal); await flushCallIce(); } catch(e) { toast('Call connection failed'); endPeerCall(true); } } });
  onSocketEvent('call:ice', async payload => { if(!activeCall || payload.conversationId!==activeCall.conversationId) return; if(activeCall.pc.remoteDescription) activeCall.pc.addIceCandidate(payload.signal).catch(()=>{}); else activeCall.pendingIce.push(payload.signal); });
  onSocketEvent('call:end', payload => { if(activeCall && payload.conversationId===activeCall.conversationId) { toast('Call ended'); endPeerCall(false); } });
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

  // 2. Authenticated App Shell with 240px Sidebar + Content + BottomNav
  const sidebarHtml = renderSidebar(state.user, route, state.unreadTotal);
  const bottomNavHtml = renderBottomNav(route, state.unreadTotal);

  app.innerHTML = `
    <div class="shell">
      ${sidebarHtml}
      <main class="main-content" id="main-content-scroll">
        <header class="topbar">
          <h1><img src="/icons/icon-192.png" alt="NoChat" class="v3-header-mark">${formatTopBarTitle(route)}</h1>
          <div style="display:flex; gap:8px;">
            ${route === 'home' ? `<button type="button" class="btn-icon v4-bell-button" data-action="notifications" aria-label="Notifications" title="Notifications"><i data-lucide="bell"></i><span class="v4-notification-count ${state.unreadNotifications ? '' : 'hidden'}" data-bell-count>${state.unreadNotifications || ''}</span></button>` : ''}
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
        currentUser: state.user,
        announcement: state.announcement
      });
      const feed=container.querySelector('.feed-container'); if(feed) feed.insertAdjacentHTML('beforeend', renderDiscoveryPanel(state.users));
      bindDiscoveryEvents(container);
      decorateYourStory(container);
      if(state.routeParam) document.querySelector(`[data-post-id="${CSS.escape(state.routeParam)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});
      bindHomeEvents();
      break;

    case 'reels':
      await loadReelsData();
      container.innerHTML = renderReelsPage({
        reels: state.reels.filter(r=>r.videoUrl),
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
        posts: (state.profileReels||state.posts).filter(p => p.userId === (state.profileUser?.id || state.user?.id)),
        reels: (state.profileReels||state.reels).filter(r => r.userId === (state.profileUser?.id || state.user?.id)),
        savedPosts: state.reels.filter(r => JSON.parse(localStorage.getItem('nochat:saved-reels')||'[]').includes(String(r.id))),
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

  decorateV3Actions();
  decorateSidebarStoryAction();
  refreshIcons();
}


function decorateLandingVersion() {
  const logo=document.querySelector('.landing-nav .logo');
  if(logo && !logo.querySelector('.v4-version')) { const tag=document.createElement('small'); tag.className='v4-version'; tag.textContent='v4'; logo.append(tag); }
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
function notificationPanel() { document.querySelector('.v4-notification-panel')?.remove(); const rows=state.notifications.map(n=>'<article class="v4-notification-row"><img src="'+escapeHtml(n.avatar||'/icons/icon-192.png')+'" alt=""><div class="v4-notification-copy"><strong>'+escapeHtml(n.text)+'</strong><small>'+escapeHtml(n.time||'Just now')+'</small></div>'+(n.userId?'<button type="button" data-action="toggle-follow" data-user-id="'+escapeHtml(n.userId)+'">Follow</button>':'')+'</article>').join(''); const panel=document.createElement('section'); panel.className='v4-notification-panel'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Notifications'); panel.innerHTML='<header><strong>Notifications</strong><button type="button" data-action="close-notifications" aria-label="Close">×</button></header>'+(rows||'<p class="v4-notification-empty">You’re all caught up.</p>'); document.querySelector('.topbar')?.append(panel); state.notifications=state.notifications.map(n=>({...n,read:true})); state.unreadNotifications=0; saveV4Notifications(); updateV4Bell(); }
function closeV4Notifications() { document.querySelector('.v4-notification-panel')?.remove(); }
async function loadV4Stories() { try { const r=await api.get('/api/stories'); state.stories=r.stories||[]; } catch(e) { state.stories=[]; } }
function decorateYourStory(root) { const row=root.querySelector('.stories-bar'); if(!row) return; const circles=[...row.querySelectorAll('.story-circle')]; const old=circles[0]; if(old) { const own=state.stories.filter(s=>String(s.userId)===String(state.user?.id)); const story=own.at(-1); const avatar=state.user?.profilePicture||'/icons/icon-192.png'; const box=document.createElement('div'); box.className='story-circle v4-your-story'; box.dataset.action=story?'view-own-story':'add-story'; box.innerHTML='<div class="story-ring '+(story?'v4-story-ring-live':'v4-story-ring-empty')+'"><img src="'+escapeHtml(avatar)+'" alt="Your Story" class="story-avatar"></div><button type="button" class="v4-story-plus" data-action="add-story" aria-label="Add story">+</button><span class="story-username">Your Story</span><small class="v4-add-story-label">'+(story?'Add story':'Add Story')+'</small>'; old.replaceWith(box); }
  row.querySelectorAll('.story-circle:not(.v4-your-story)').forEach(circle=>{const story=state.stories.find(x=>String(x.userId)===String(circle.dataset.userId));if(story){circle.dataset.action='view-user-story';circle.dataset.storyId=story.id;circle.dataset.storyUserId=story.userId;circle.classList.add('v4-has-story');}});
}
function showV4StoryModal() { document.querySelector('.v4-story-modal')?.remove(); document.body.insertAdjacentHTML('beforeend','<div class="v4-story-modal" role="dialog" aria-modal="true"><section><header><strong>Create Story</strong><button type="button" data-action="close-story">×</button></header><div class="v4-story-preview" data-story-preview>Choose a photo or video to preview in 9:16</div><div class="v4-story-source-buttons"><button type="button" data-action="choose-story-photo">Choose Photo</button><button type="button" data-action="take-story-photo">Take Photo</button><button type="button" data-action="choose-story-video">Choose Video</button><input hidden type="file" accept="image/*" data-story-file><input hidden type="file" accept="video/*" data-story-video></div><label>Caption<input type="text" maxlength="220" data-story-caption placeholder="Add a caption…"></label><label class="v4-close-friends"><input type="checkbox" data-story-close-friends> Close Friends Only</label><button type="button" class="btn btn-primary" data-action="publish-story">Post Story</button></section></div>'); }
function openV4StoryViewer(userId) { const list=state.stories.filter(story=>String(story.userId)===String(userId));if(!list.length){toast('No active story');return;}state.activeStoryList=list;state.activeStoryIndex=0;showV4StoryAt(0); }
function closeV4StoryViewer(){const old=document.querySelector('.v4-story-viewer');if(old?.dataset.timer)clearTimeout(Number(old.dataset.timer));old?.remove();}
function showV4StoryAt(index) { const story=state.activeStoryList[index];if(!story){closeV4StoryViewer();return;}state.activeStoryIndex=index;closeV4StoryViewer();const view=document.createElement('div');view.className='v4-story-viewer';view.innerHTML='<div class="v4-story-progress"><i></i></div><button class="v4-story-sound" data-action="v4-story-sound">Sound Off</button><button class="v4-story-close" data-action="close-story" aria-label="Close">×</button><div class="v4-story-tap-left" data-action="story-prev"></div><div class="v4-story-tap-right" data-action="story-next"></div><div class="v4-story-content">'+(String(story.mediaType||'').startsWith('video/')?'<video autoplay muted controls playsinline src="'+escapeHtml(story.mediaUrl)+'"></video>':'<img src="'+escapeHtml(story.mediaUrl)+'" alt="Story">')+(story.caption?'<p>'+escapeHtml(story.caption)+'</p>':'')+'</div><form class="v4-story-reply"><input name="reply" placeholder="Reply to story…"><button type="submit">Send</button></form>';document.body.append(view);view.querySelector('.v4-story-progress i').style.animationDuration='5s';view.dataset.timer=setTimeout(()=>showV4StoryAt(index+1),5000); }
function handleStorySubmit(event) { if(!event.target.matches('.v4-story-reply'))return;event.preventDefault();const text=event.target.reply.value.trim();if(!text)return;const story=state.activeStoryList[state.activeStoryIndex];const convo=state.conversations.find(c=>String(c.otherUser?.id)===String(story?.userId));if(convo)api.post('/api/conversations/'+encodeURIComponent(convo.id)+'/messages',{text:'Story reply: '+text}).then(()=>toast('Reply sent')).catch(e=>toast('Reply failed: '+e.message));else toast('Open a chat with this creator to reply');event.target.reset(); }
async function publishV4Story() { const modal=document.querySelector('.v4-story-modal');const file=modal?.querySelector('[data-story-file]')?.files?.[0]||modal?.querySelector('[data-story-video]')?.files?.[0];if(!file){toast('Choose a photo or video first');return;}const form=new FormData();form.append('media',file);form.append('caption',modal.querySelector('[data-story-caption]')?.value.trim()||'');form.append('closeFriendsOnly',String(!!modal.querySelector('[data-story-close-friends]')?.checked));try{const result=await api.post('/api/stories',form);state.stories.push(result.story);modal.remove();toast('Story posted for 24 hours');if(state.route==='home')renderApp();}catch(e){toast(e.status===401?'Login again':'Story upload failed: '+e.message);} }
function wireStoryPreview() { document.addEventListener('change',event=>{const input=event.target;if(!input.matches('[data-story-file],[data-story-video]')||!input.files?.[0])return;const file=input.files[0],url=URL.createObjectURL(file),preview=document.querySelector('[data-story-preview]');if(preview)preview.innerHTML=file.type.startsWith('video/')?'<video controls playsinline src="'+url+'"></video>':'<img src="'+url+'" alt="Story preview">';}); }
function showPostUploadModal() { document.querySelector('.v4-post-modal')?.remove();document.body.insertAdjacentHTML('beforeend','<div class="v4-story-modal v4-post-modal" role="dialog" aria-modal="true"><form class="v4-post-upload-form"><header><strong>Create Post</strong><button type="button" data-action="close-story">×</button></header><label>Photo or video<input type="file" name="media" accept="image/*,video/mp4,video/webm,video/quicktime" required></label><label>Caption<textarea name="caption" rows="3" maxlength="2200" placeholder="Write a caption…"></textarea></label><button class="btn btn-primary" type="submit">Share Post</button></form></div>'); }
async function handlePostSubmit(event) { if(!event.target.matches('.v4-post-upload-form'))return;event.preventDefault();const form=event.target;const file=form.media.files?.[0];if(!file)return;const data=new FormData();data.append('media',file);data.append('caption',form.caption.value);const button=form.querySelector('[type="submit"]');button.disabled=true;try{const result=await api.post('/api/posts',data);if(result.post?.moderationStatus==='approved'){state.posts.unshift(result.post);state.reels.unshift(result.post);toast('Post shared');}else toast('Post uploaded and is waiting for review');form.closest('.v4-post-modal').remove();if(state.route==='home')renderApp();}catch(e){toast(e.status===401?'Login again':'Post upload failed: '+e.message);}finally{button.disabled=false;} }
function handleV4Action(event) { const b=event.target.closest('[data-action]'); if(!b)return; const a=b.dataset.action; if(a==='toggle-create-menu'){document.querySelector('.v4-create-menu')?.classList.toggle('hidden');return;} if(a==='open-post-upload'){document.querySelector('.v4-create-menu')?.classList.add('hidden');showPostUploadModal();return;} if(a.startsWith('call-')) { handleCallAction(a); return; } if(a==='notifications'){ event.preventDefault(); notificationPanel(); } else if(a==='close-notifications'){closeV4Notifications();} else if(a==='add-story'){event.preventDefault();showV4StoryModal();} else if(a==='close-story'){document.querySelector('.v4-story-modal')?.remove();closeV4StoryViewer();} else if(a==='view-own-story'){openV4StoryViewer(state.user?.id);} else if(a==='view-user-story'){openV4StoryViewer(b.dataset.storyUserId);} else if(a==='choose-story-photo'){document.querySelector('[data-story-file]')?.click();} else if(a==='take-story-photo'){const i=document.querySelector('[data-story-file]'); if(i){i.setAttribute('capture','environment');i.click();}} else if(a==='choose-story-video'){document.querySelector('[data-story-video]')?.click();} else if(a==='story-next'){showV4StoryAt(state.activeStoryIndex+1);} else if(a==='story-prev'){showV4StoryAt(Math.max(0,state.activeStoryIndex-1));} else if(a==='publish-story'){publishV4Story();} }
function renderDiscoveryPanel(users=[]) {
  const list=users.filter(u=>String(u.id)!==String(state.user?.id)).slice(0,6);
  return '<aside class="v3-discover-panel"><section class="v3-discover-card"><h3>Discover Creators</h3><input class="v3-discover-search" type="search" placeholder="Search humans…" aria-label="Search creators"><div class="v3-creator-list">'+renderCreatorRows(list)+'</div></section><section class="v3-discover-card"><h3>Creator picks</h3><p>Find real people, follow creators, and see their latest reels in your feed.</p><a href="#/reels" class="btn btn-secondary btn-sm">Explore Reels</a></section></aside>';
}
function renderCreatorRows(users=[]) {
  if(!users.length) return '<p class="v3-empty-discovery">No creator matches yet.</p>';
  return users.map(u=>'<div class="v3-creator-row"><img loading="lazy" src="'+escapeHtml(u.profilePicture||('/icons/icon-192.png'))+'" alt=""><a href="#/profile/'+encodeURIComponent(u.id)+'">@'+escapeHtml(u.username||'human')+'</a><button type="button" data-action="toggle-follow" data-user-id="'+escapeHtml(u.id)+'">Follow</button><button type="button" data-action="v3-close-friend" data-user-id="'+escapeHtml(u.id)+'" aria-label="Toggle Close Friend">☆</button></div>').join('');
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
  document.querySelectorAll('[data-action="open-edit-profile"]').forEach(b=>{b.dataset.action='v3-avatar-open';b.textContent='Edit photo';});
  if(ownAvatar && String(state.profileUser?.id||state.user?.id)===String(state.user?.id) && !ownAvatar.querySelector('[data-action="v3-avatar-open"]')) { const b=document.createElement('button'); b.type='button'; b.dataset.action='v3-avatar-open'; b.className='v3-avatar-edit'; b.textContent='Edit photo'; ownAvatar.append(b); }
  document.querySelectorAll('button').forEach(b=>{if(!b.type)b.type='button';});
  if(document.querySelector('.chat-header') && !document.querySelector('[data-action="v3-hug"]')) { const controls=document.createElement('div'); controls.className='v3-chat-extras'; controls.innerHTML='<button type="button" data-action="v3-hug" aria-label="Send a hug">💚 Hug</button><button type="button" data-action="v3-voice-record" aria-label="Record voice note">🎙 Voice</button>'; document.querySelector('.chat-header')?.append(controls); }
  if(document.querySelector('.profile-details') && !document.querySelector('.v3-mood-picker')) { const wrap=document.createElement('div'); wrap.className='v3-mood-picker'; wrap.innerHTML='<span>Mood</span><button type="button" data-action="v3-mood" data-mood="Happy">Happy</button><button type="button" data-action="v3-mood" data-mood="Chill">Chill</button><button type="button" data-action="v3-mood" data-mood="Tired">Tired</button><button type="button" data-action="v3-mood" data-mood="Excited">Excited</button>'; document.querySelector('.profile-details')?.append(wrap); }
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
    state.conversations = (res.conversations || []).map(c => ({...c, otherUser: c.user || c.otherUser || null}));
    if (!state.activeConvo && state.conversations.length > 0) {
      state.activeConvo = state.conversations[0];
    }
    if (state.activeConvo) {
      getSocket()?.emit('conversation:join', state.activeConvo.id);
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
    if(Array.isArray(res.reels)) state.profileReels=res.reels;
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
    toast(e.status===401 ? 'Login again' : 'Comments could not be loaded: '+e.message);
  }

  $('#comment-sheet')?.remove();
  document.body.insertAdjacentHTML('beforeend', renderCommentSheet(comments.map(c=>({...c,text:c.content||c.text})), 'Reel Comments'));
  $('.comment-item').forEach((item,i)=>{ const c=comments[i]; item.dataset.commentId=c?.id||''; item.dataset.reelId=reelId; if(c?.canDelete && !item.querySelector('[data-action="delete-comment"]')) { const b=document.createElement('button'); b.type='button'; b.dataset.action='delete-comment'; b.textContent='Delete'; b.className='v3-comment-delete'; item.append(b); } });
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
        const res = await api.post(`/api/reels/${reelId}/comments`, { content: text });
        form.reset();
        openCommentsDrawer(reelId); // refresh
      } catch (err) {
        toast(err.status===401 ? 'Login again' : (err.message || 'Could not post comment.'));
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
      getSocket()?.emit('conversation:join', cid);
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
  $('[data-action="start-video-call"]').forEach(btn => btn.onclick = () => startPeerCall(true));
  $('[data-action="start-voice-call"]').forEach(btn => btn.onclick = () => startPeerCall(false));

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

let activeCall=null; let incomingCall=null;
async function startPeerCall(video) {
  const convo=state.activeConvo; const peerId=convo?.otherUser?.id;
  if(!convo||!peerId) { toast('Open a chat before starting a call'); return; }
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection) { toast('Calls require a secure HTTPS browser with microphone access'); return; }
  try { const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:video?{facingMode:'user'}:false}); activeCall={conversationId:convo.id,peerId,video,stream,pc:null,pendingIce:[],incoming:false}; await createCallPeer(); showCallStage(); emitSocketEvent('call:invite',{conversationId:convo.id,targetUserId:peerId,video}); toast('Calling '+(convo.otherUser.displayName||convo.otherUser.username||'human')+'…'); } catch(e) { endPeerCall(false); toast(e.name==='NotAllowedError'?'Allow microphone/camera access to call':'Call failed: '+e.message); }
}
function showIncomingCall(payload) { if(activeCall) { emitSocketEvent('call:decline',{conversationId:payload.conversationId,targetUserId:payload.callerId}); return; } incomingCall=payload; document.querySelector('.v4-incoming-call')?.remove(); document.body.insertAdjacentHTML('beforeend','<div class="v4-incoming-call"><section><h3>Incoming '+(payload.video?'video':'voice')+' call</h3><p>'+escapeHtml(payload.caller?.displayName||payload.caller?.username||'NoChat member')+'</p><button type="button" data-action="call-accept">Accept</button><button type="button" data-action="call-decline">Decline</button></section></div>'); }
async function acceptPeerCall() { const payload=incomingCall;if(!payload)return;document.querySelector('.v4-incoming-call')?.remove();incomingCall=null;try { const convo=state.conversations.find(c=>c.id===payload.conversationId);activeCall={conversationId:payload.conversationId,peerId:payload.callerId,video:payload.video,stream:await navigator.mediaDevices.getUserMedia({audio:true,video:payload.video?{facingMode:'user'}:false}),pc:null,pendingIce:[],incoming:true};state.activeConvo=convo||{id:payload.conversationId,otherUser:payload.caller};await createCallPeer();showCallStage();emitSocketEvent('call:accept',{conversationId:payload.conversationId,targetUserId:payload.callerId});}catch(e){emitSocketEvent('call:decline',{conversationId:payload.conversationId,targetUserId:payload.callerId});endPeerCall(false);toast('Could not answer: '+e.message);} }
async function createCallPeer() { const config=await api.get('/api/calls/ice').catch(()=>({iceServers:[{urls:['stun:stun.l.google.com:19302']}] }));const pc=new RTCPeerConnection({iceServers:config.iceServers||[{urls:'stun:stun.l.google.com:19302'}],iceTransportPolicy:config.iceTransportPolicy||'all'});activeCall.pc=pc;activeCall.stream.getTracks().forEach(t=>pc.addTrack(t,activeCall.stream));pc.onicecandidate=e=>{if(e.candidate)emitSocketEvent('call:ice',{conversationId:activeCall.conversationId,targetUserId:activeCall.peerId,signal:e.candidate});};pc.ontrack=e=>{const remote=document.querySelector('[data-call-remote]');if(remote){remote.srcObject=e.streams[0];remote.play().catch(()=>{});}};pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(pc.connectionState)){toast('Call connection '+pc.connectionState);endPeerCall(false);}}; }
async function sendCallOffer() { if(!activeCall?.pc)return;try{const offer=await activeCall.pc.createOffer();await activeCall.pc.setLocalDescription(offer);emitSocketEvent('call:offer',{conversationId:activeCall.conversationId,targetUserId:activeCall.peerId,signal:activeCall.pc.localDescription});}catch(e){toast('Could not start call: '+e.message);endPeerCall(true);} }
async function flushCallIce(){if(!activeCall?.pc?.remoteDescription)return;for(const candidate of activeCall.pendingIce.splice(0))await activeCall.pc.addIceCandidate(candidate).catch(()=>{});}
function showCallStage(){document.querySelector('.v4-call-stage')?.remove();document.body.insertAdjacentHTML('beforeend','<div class="v4-call-stage"><section><header>'+(activeCall.video?'Video call':'Voice call')+'<span data-call-status>Connecting…</span></header><video data-call-remote autoplay playsinline '+(activeCall.video?'':'class="v4-audio-call"')+'></video><video data-call-local autoplay muted playsinline '+(activeCall.video?'':'hidden')+'></video><footer><button type="button" data-action="call-mic">Mute mic</button>'+(activeCall.video?'<button type="button" data-action="call-camera">Turn camera off</button>':'')+'<button type="button" class="v4-call-end" data-action="call-end">End call</button></footer></section></div>');const local=document.querySelector('[data-call-local]');if(local&&activeCall.video){local.srcObject=activeCall.stream;local.play().catch(()=>{});} }
function endPeerCall(notify=true){if(activeCall){if(notify)emitSocketEvent('call:end',{conversationId:activeCall.conversationId,targetUserId:activeCall.peerId});activeCall.pc?.close();activeCall.stream?.getTracks().forEach(t=>t.stop());activeCall=null;}document.querySelector('.v4-call-stage')?.remove();}
function handleCallAction(action){if(action==='call-accept')acceptPeerCall();else if(action==='call-decline'){if(incomingCall)emitSocketEvent('call:decline',{conversationId:incomingCall.conversationId,targetUserId:incomingCall.callerId});incomingCall=null;document.querySelector('.v4-incoming-call')?.remove();}else if(action==='call-end')endPeerCall(true);else if(action==='call-mic'&&activeCall){const track=activeCall.stream.getAudioTracks()[0];if(track){track.enabled=!track.enabled;document.querySelector('[data-action="call-mic"]').textContent=track.enabled?'Mute mic':'Unmute mic';}}else if(action==='call-camera'&&activeCall){const track=activeCall.stream.getVideoTracks()[0];if(track){track.enabled=!track.enabled;document.querySelector('[data-action="call-camera"]').textContent=track.enabled?'Turn camera off':'Turn camera on';}}}

function bindWatchPartyEvents() {
  $$('.watch-tab-btn').forEach(btn => btn.onclick = () => { state.activeWatchCategory = btn.dataset.category; renderApp(); });
  $$('[data-action="watch-trailer"]').forEach(btn => btn.onclick = () => {
    const id = parseYouTubeId('https://youtu.be/' + (btn.dataset.embedId || '')) || (/^[A-Za-z0-9_-]{11}$/.test(btn.dataset.embedId || '') ? btn.dataset.embedId : '');
    const modal = $('#video-player-modal');
    const box = modal?.querySelector('.modal-box');
    if (!modal || !box) return;
    const title = btn.dataset.title || 'Watch Party';
    box.innerHTML = '<header class="v2-modal-header"><h3 id="video-player-title"></h3><button type="button" class="btn-icon" data-action="close-video-modal" aria-label="Close">×</button></header>' + playerMarkup(id, title);
    const titleEl = $('#video-player-title'); if (titleEl) titleEl.textContent = title;
    modal.classList.remove('hidden');
    activatePlayer(box, id);
  });
  if (!document.body.dataset.v2PlayerEvents) { document.body.dataset.v2PlayerEvents = '1'; document.addEventListener('click', e => {
    if (e.target.closest('[data-action="close-video-modal"]')) { const modal=$('#video-player-modal'); if(modal) { modal.classList.add('hidden'); modal.querySelector('iframe')?.setAttribute('src',''); } }
    if (e.target.closest('[data-player-load]')) { const input=e.target.closest('.v2-player-error')?.querySelector('[data-player-url]'); const id=parseYouTubeId(input?.value || ''); const modal=$('#video-player-modal'); const box=modal?.querySelector('.modal-box'); if(box) { box.innerHTML=playerMarkup(id, 'Watch Party'); activatePlayer(box,id); } }
  }); }
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

