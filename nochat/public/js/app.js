
/**
 * NoChat v3.3.1 — client
 * Premium dark SPA. Hash routing. Socket.IO for realtime.
 */

const $ = (s, el = document) => el?.querySelector(s) ?? null;
const $$ = (s, el = document) => el ? [...el.querySelectorAll(s)] : [];

const state = {
  user: null,
  conversations: [],
  activeConvo: null,
  messages: new Map(),
  socket: null,
  unread: 0,
  videos: [],
  reels: [],
};

const api = async (path, opts = {}) => {
  const res = await fetch(path, {
    credentials: 'include',
    headers: opts.body && !(opts.body instanceof FormData)
      ? { 'Content-Type': 'application/json', ...opts.headers }
      : opts.headers,
    ...opts,
    body: opts.body && !(opts.body instanceof FormData)
      ? JSON.stringify(opts.body)
      : opts.body,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw Object.assign(
      new Error(data.error || 'Request failed'),
      { status: res.status, code: data.code, data }
    );
  }

  return data;
};

/* ---------- Helpers ---------- */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

function toast(msg, ms = 3200) {
  const t = $('#toast');

  if (!t) {
    console.warn('NoChat: #toast element is missing:', msg);
    return;
  }

  t.textContent = String(msg ?? '');
  t.classList.remove('hidden');

  clearTimeout(t._t);

  t._t = setTimeout(() => {
    t.classList.add('hidden');
  }, ms);
}

function icons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

/* ---------- Auth ---------- */

async function loadMe() {
  try {
    const data = await api('/api/me');

    state.user = data.user || null;

    return !!state.user;
  } catch (error) {
    console.warn('NoChat: Could not load current user:', error.message);
    state.user = null;
    return false;
  }
}

function showLanding() {
  const landing = $('#landing');
  const shell = $('#shell');

  landing?.classList.remove('hidden');
  shell?.classList.add('hidden');

  icons();
  renderLandingWatch();
}

function showShell() {
  const landing = $('#landing');
  const shell = $('#shell');

  landing?.classList.add('hidden');
  shell?.classList.remove('hidden');

  $$('.admin-only').forEach(el => {
    const isFounder = state.user?.username === 'denpher';
    const isOfficial =
      state.user?.isVerified &&
      state.user?.role === 'Founder & Official Creator';

    el.classList.toggle('hidden', !(isFounder || isOfficial));
  });

  connectSocket();
  route();
  icons();
}

function openAuth(mode = 'signin') {
  const modal = $('#auth-modal');

  if (!modal) {
    console.error('NoChat: #auth-modal is missing');
    return;
  }

  modal.classList.remove('hidden');
  setAuthMode(mode);
}

function closeAuth() {
  $('#auth-modal')?.classList.add('hidden');
  $('#auth-error')?.classList.add('hidden');
}

function setAuthMode(mode) {
  $$('.auth-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.auth === mode);
  });

  $$('.signup-only').forEach(el => {
    el.classList.toggle('hidden', mode !== 'signup');
  });

  const form = $('#auth-form');
  const password = $('#auth-password');

  if (form) form.dataset.mode = mode;

  if (password) {
    password.autocomplete =
      mode === 'signup' ? 'new-password' : 'current-password';
  }
}

async function submitAuth(e) {
  e.preventDefault();

  const form = e.currentTarget;
  const mode = form?.dataset.mode || 'signin';
  const err = $('#auth-error');

  err?.classList.add('hidden');

  try {
    const identifier = $('#auth-identifier');
    const username = $('#auth-username');
    const password = $('#auth-password');

    if (!password || !identifier) {
      throw new Error('Login form is incomplete. Please refresh the page.');
    }

    if (mode === 'signup') {
      await api('/api/auth/register', {
        method: 'POST',
        body: {
          username: username?.value.trim() || '',
          email: identifier.value.trim(),
          password: password.value,
        },
      });
    } else {
      await api('/api/auth/login', {
        method: 'POST',
        body: {
          identifier: identifier.value.trim(),
          password: password.value,
        },
      });
    }

    const authenticated = await loadMe();

    if (!authenticated) {
      throw new Error(
        'Login request completed, but your session could not be loaded. Please try again.'
      );
    }

    closeAuth();
    showShell();

    toast(
      mode === 'signup'
        ? `Welcome, Human #${state.user?.memberNumber ?? ''}`
        : 'Welcome back'
    );

  } catch (ex) {
    console.error('NoChat authentication error:', ex);

    if (err) {
      err.textContent =
        ex.message || 'Something went wrong. Please try again.';
      err.classList.remove('hidden');
    } else {
      toast(ex.message || 'Authentication failed');
    }
  }
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.warn('NoChat logout request failed:', error.message);
  }

  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }

  state.user = null;
  state.activeConvo = null;
  state.conversations = [];
  state.messages.clear();

  showLanding();
}

/* ---------- Socket ---------- */

function connectSocket() {
  if (state.socket) return;

  if (typeof window.io !== 'function') {
    console.error('NoChat: Socket.IO client is unavailable');
    return;
  }

  const s = window.io({
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  state.socket = s;

  s.on('connect', () => {});

  s.on('message:new', msg => {
    if (!msg?.conversationId) return;

    const list = state.messages.get(msg.conversationId) || [];

    if (!list.find(m => m.id === msg.id)) {
      list.push(msg);
      state.messages.set(msg.conversationId, list);

      if (state.activeConvo === msg.conversationId) {
        appendMessage(msg);
      } else {
        bumpUnread();
      }
    }
  });

  s.on('message:edited', p => {
    if (!p?.conversationId) return;

    const list = state.messages.get(p.conversationId);
    if (!list) return;

    const message = list.find(x => x.id === p.messageId);

    if (message) {
      message.text = p.text;
      message.isEdited = true;
      message.editedAt = p.editedAt;
    }

    if (state.activeConvo === p.conversationId) {
      renderMessages(p.conversationId);
    }
  });

  s.on('conversation:update', () => loadConversations());
  s.on('presence:update', () => {});
  s.on('disconnect', () => {});
}

function bumpUnread() {
  state.unread++;

  $$('.unread-badge').forEach(badge => {
    badge.textContent = state.unread > 99 ? '99+' : String(state.unread);
    badge.classList.toggle('hidden', state.unread === 0);
  });
}

/* ---------- Routing ---------- */

const routes = {
  '': homeView,
  home: homeView,
  reels: reelsView,
  chat: chatView,
  videos: videosView,
  profile: profileView,
  admin: adminView,
};

function route() {
  const hash = location.hash.replace(/^#\/?/, '') || '';
  const [path, id] = hash.split('/');

  const fn = routes[path] || homeView;

  $$('.nav-item, .tab').forEach(el => {
    el.classList.toggle(
      'active',
      el.dataset.route === (path || 'home')
    );
  });

  const titles = {
    '': 'Home',
    home: 'Home',
    reels: 'Reels',
    chat: 'Chat',
    videos: 'Watch Party',
    profile: 'Profile',
    admin: 'Admin',
  };

  const pageTitle = $('.page-title');

  if (pageTitle) {
    pageTitle.textContent = titles[path] || 'NoChat';
  }

  if (!$('#view')) {
    console.error('NoChat: #view element is missing');
    return;
  }

  try {
    fn(id);
  } catch (error) {
    console.error('NoChat route error:', error);
    toast('Could not open this page');
  }

  icons();
}

window.addEventListener('hashchange', () => {
  if (state.user) route();
});

/* ---------- Views ---------- */

function homeView() {
  const view = $('#view');
  if (!view || !state.user) return;

  view.innerHTML = `
    <div class="view-pad">
      <div class="card" style="margin-bottom:16px">
        <h2 style="font-size:18px;margin-bottom:8px">
          Welcome, ${escapeHtml(state.user.displayName || state.user.username)}
        </h2>
        <p style="color:var(--muted);font-size:14px">
          You are Human #${escapeHtml(state.user.memberNumber)}. No algorithms. Just people.
        </p>
      </div>
      <div class="card">
        <h3 style="font-size:15px;margin-bottom:12px">Quick start</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <a href="#/reels" class="btn btn-secondary btn-sm">Open Reels</a>
          <a href="#/chat" class="btn btn-secondary btn-sm">Messages</a>
          <a href="#/videos" class="btn btn-secondary btn-sm">Watch Party</a>
          <a href="#/profile" class="btn btn-secondary btn-sm">Your profile</a>
        </div>
      </div>
    </div>`;
}

async function reelsView() {
  const view = $('#view');
  if (!view) return;

  view.innerHTML = `
    <div class="empty">
      <div class="skeleton" style="width:120px;height:120px;margin:0 auto 16px;border-radius:50%"></div>
      <p>Loading reels…</p>
    </div>`;

  try {
    const data = await api('/api/reels?limit=12');

    state.reels = data.reels || [];

    if (!state.reels.length) {
      view.innerHTML = `
        <div class="empty">
          <h3>No reels yet</h3>
          <p>Be the first human to post one.</p>
          <button class="btn btn-primary" data-action="open-compose" style="margin-top:16px">
            Upload reel
          </button>
        </div>`;

      icons();
      return;
    }

    view.innerHTML = `
      <div class="reels-feed" id="reels-feed">
        ${state.reels.map(reelSlide).join('')}
      </div>`;

    $$('#reels-feed video').forEach((video, index) => {
      if (index === 0) video.play().catch(() => {});
      video.addEventListener('click', () => {
        video.muted = !video.muted;
      });
    });

    const feed = $('#reels-feed');

    feed?.addEventListener('scroll', () => {
      const slides = $$('.reel-slide', feed);
      const idx = Math.round(feed.scrollTop / window.innerHeight);

      slides.forEach((slide, i) => {
        const video = slide.querySelector('video');
        if (!video) return;

        if (i === idx) video.play().catch(() => {});
        else video.pause();
      });
    }, { passive: true });

  } catch (e) {
    view.innerHTML = `
      <div class="empty">
        <h3>Could not load reels</h3>
        <p>${escapeHtml(e.message)}</p>
      </div>`;
  }

  icons();
}

function reelSlide(r) {
  const user = r.user || {};

  return `
    <div class="reel-slide" data-id="${escapeAttr(r.id)}">
      <video src="${escapeAttr(r.videoUrl)}" playsinline loop muted preload="metadata"></video>
      <div class="reel-actions">
        <button data-like="${escapeAttr(r.id)}" aria-label="Like">
          <i data-lucide="heart"></i>
        </button>
        <button data-comment="${escapeAttr(r.id)}" aria-label="Comment">
          <i data-lucide="message-circle"></i>
        </button>
        <button data-share="${escapeAttr(r.id)}" aria-label="Share">
          <i data-lucide="share-2"></i>
        </button>
      </div>
      <div class="reel-info">
        <div class="user">
          @${escapeHtml(user.username || 'user')}
          ${user.isVerified ? ' <span class="verified-tick"><i data-lucide="badge-check"></i></span>' : ''}
        </div>
        <div class="caption">${escapeHtml(r.caption || '')}</div>
      </div>
    </div>`;
}

async function chatView(convoId) {
  const view = $('#view');
  if (!view) return;

  view.innerHTML = `
    <div class="chat-layout">
      <div class="chat-list" id="chat-list">
        <div class="empty"><p>Loading…</p></div>
      </div>
      <div class="chat-thread" id="chat-thread">
        <div class="empty">
          <h3>Select a conversation</h3>
          <p>Messages stay private. Edit within 15 minutes.</p>
        </div>
      </div>
    </div>`;

  await loadConversations();

  if (convoId) await openConversation(convoId);

  icons();
}

async function loadConversations() {
  try {
    const data = await api('/api/conversations');

    state.conversations = data.conversations || [];

    const list = $('#chat-list');
    if (!list) return;

    if (!state.conversations.length) {
      list.innerHTML = `<div class="empty"><p>No conversations yet</p></div>`;
      return;
    }

    list.innerHTML = state.conversations.map(c => {
      const name = c.group
        ? c.group.name
        : (c.user?.displayName || c.user?.username || 'User');

      const online = c.isOnline || c.onlineCount > 0;

      return `
        <div class="chat-list-item ${state.activeConvo === c.id ? 'active' : ''}" data-convo="${escapeAttr(c.id)}">
          <div class="avatar ${online ? 'online' : ''}" style="background:var(--border)"></div>
          <div class="chat-meta">
            <div class="name">${escapeHtml(name)}</div>
            <div class="preview">${escapeHtml(c.lastMessage || 'No messages')}</div>
          </div>
          ${c.unreadCount ? `<span class="badge">${escapeHtml(c.unreadCount)}</span>` : ''}
        </div>`;
    }).join('');

    $$('[data-convo]').forEach(el => {
      el.addEventListener('click', () => openConversation(el.dataset.convo));
    });

  } catch (e) {
    const list = $('#chat-list');

    if (list) {
      list.innerHTML = `<div class="empty"><p>${escapeHtml(e.message)}</p></div>`;
    }
  }
}

async function openConversation(id) {
  state.activeConvo = id;

  $$('[data-convo]').forEach(el => {
    el.classList.toggle('active', el.dataset.convo === id);
  });

  const thread = $('#chat-thread');
  if (!thread) return;

  const convo = state.conversations.find(c => c.id === id);

  const name = convo?.group
    ? convo.group.name
    : (convo?.user?.displayName || convo?.user?.username || 'Chat');

  thread.innerHTML = `
    <div class="thread-header"><strong>${escapeHtml(name)}</strong></div>
    <div class="messages" id="messages"></div>
    <div class="msg-composer">
      <textarea id="msg-input" rows="1" placeholder="Message…" maxlength="4000"></textarea>
      <button class="btn btn-primary btn-sm" id="msg-send">Send</button>
    </div>`;

  if (state.socket) {
    state.socket.emit('conversation:join', id);
  }

  try {
    const data = await api(`/api/conversations/${encodeURIComponent(id)}/messages`);

    state.messages.set(id, data.messages || []);

    renderMessages(id);

    await api(
      `/api/conversations/${encodeURIComponent(id)}/read`,
      { method: 'POST' }
    );

  } catch (e) {
    const messages = $('#messages');

    if (messages) {
      messages.innerHTML = `<div class="empty"><p>${escapeHtml(e.message)}</p></div>`;
    }
  }

  const input = $('#msg-input');
  const sendButton = $('#msg-send');

  if (input && sendButton) {
    const send = () => sendMessage(id, input);

    sendButton.onclick = send;

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

  icons();
}

function renderMessages(convoId) {
  const box = $('#messages');
  if (!box) return;

  const list = state.messages.get(convoId) || [];

  box.innerHTML = list.map(m => {
    if (m.deletedAt) {
      return `
        <div class="msg ${m.senderId === state.user?.id ? 'mine' : 'theirs'}" style="opacity:0.6">
          Message deleted
        </div>`;
    }

    const mine = m.senderId === state.user?.id;

    return `
      <div class="msg ${mine ? 'mine' : 'theirs'}" data-mid="${escapeAttr(m.id)}">
        ${escapeHtml(m.text || '')}
        ${m.isEdited ? '<span class="edited">Edited</span>' : ''}
      </div>`;
  }).join('');

  box.scrollTop = box.scrollHeight;
}

function appendMessage(msg) {
  const box = $('#messages');
  if (!box) return;

  const mine = msg.senderId === state.user?.id;

  const div = document.createElement('div');
  div.className = `msg ${mine ? 'mine' : 'theirs'}`;
  div.dataset.mid = msg.id;
  div.textContent = msg.text || '';

  box.appendChild(div);

  const nearBottom =
    box.scrollHeight - box.scrollTop - box.clientHeight < 80;

  if (nearBottom) box.scrollTop = box.scrollHeight;
}

async function sendMessage(convoId, input) {
  const text = input?.value.trim();
  if (!text) return;

  input.value = '';

  const optimistic = {
    id: 'tmp-' + Date.now(),
    conversationId: convoId,
    senderId: state.user.id,
    text,
    createdAt: new Date().toISOString(),
  };

  const list = state.messages.get(convoId) || [];

  list.push(optimistic);
  state.messages.set(convoId, list);

  appendMessage(optimistic);

  try {
    const data = await api(
      `/api/conversations/${encodeURIComponent(convoId)}/messages`,
      { method: 'POST', body: { text } }
    );

    const idx = list.findIndex(m => m.id === optimistic.id);

    if (idx >= 0) list[idx] = data.message;

    if (state.socket) {
      state.socket.emit('message:send', {
        conversationId: convoId,
        text,
      }, () => {});
    }

  } catch (e) {
    toast(e.message);
  }
}

async function videosView() {
  const view = $('#view');
  if (!view) return;

  view.innerHTML = `
    <div class="view-pad">
      <div class="skeleton" style="height:180px;margin-bottom:16px"></div>
      <div class="skeleton" style="height:120px"></div>
    </div>`;

  try {
    const data = await api('/api/videos?limit=24');

    state.videos = data.videos || [];

    const cats = data.categories || [];

    view.innerHTML = `
      <div style="padding:16px 20px 0;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary cat-btn active" data-cat="">All</button>
        ${cats.map(c => `
          <button class="btn btn-sm btn-secondary cat-btn" data-cat="${escapeAttr(c)}">
            ${escapeHtml(c)}
          </button>
        `).join('')}
      </div>
      <p style="padding:8px 20px;color:var(--muted);font-size:12px">
        NoChat does not host movies — official trailers only.
      </p>
      <div class="video-grid" id="video-grid">
        ${state.videos.map(videoCard).join('') || '<div class="empty"><p>No videos yet</p></div>'}
      </div>`;

    $$('.cat-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        $$('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const cat = btn.dataset.cat;

        const q = cat
          ? `?category=${encodeURIComponent(cat)}&limit=24`
          : '?limit=24';

        try {
          const d = await api('/api/videos' + q);
          const grid = $('#video-grid');

          if (grid) {
            grid.innerHTML =
              (d.videos || []).map(videoCard).join('') ||
              '<div class="empty"><p>Nothing in this category</p></div>';
          }

          icons();

        } catch (error) {
          toast(error.message);
        }
      });
    });

  } catch (e) {
    view.innerHTML = `
      <div class="empty">
        <h3>Videos unavailable</h3>
        <p>${escapeHtml(e.message)}</p>
      </div>`;
  }

  icons();
}

function videoCard(v) {
  const thumb = v.thumbnail || '';

  return `
    <article class="card video-card" data-vid="${escapeAttr(v.id)}">
      <div class="thumb">
        ${thumb ? `<img src="${escapeAttr(thumb)}" alt="" loading="lazy" />` : ''}
      </div>
      <div class="body">
        <h3>${escapeHtml(v.title)}</h3>
        <div class="meta">
          ${escapeHtml(v.channel || '')} · ${escapeHtml(v.category || '')}
        </div>
        ${v.watchUrl ? `
          <a href="${escapeAttr(v.watchUrl)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="margin-top:8px">
            Where to Watch
          </a>
        ` : ''}
      </div>
    </article>`;
}

async function profileView() {
  const view = $('#view');
  const u = state.user;

  if (!view || !u) return;

  view.innerHTML = `
    <div class="profile-header">
      <img
        class="profile-avatar ${u.isVerified ? 'verified' : ''}"
        src="${escapeAttr(u.profilePicture || '')}"
        alt=""
        onerror="this.style.background='var(--border)'"
      />
      <div class="profile-name">${escapeHtml(u.displayName || u.username)}</div>
      <div class="profile-user">@${escapeHtml(u.username)}</div>
      <div class="member-badge">Human #${escapeHtml(u.memberNumber)}</div>

      ${u.isVerified ? `
        <div style="color:var(--success);font-size:13px;margin-bottom:8px">
          <i data-lucide="badge-check"></i> Verified
        </div>
      ` : ''}

      <p class="profile-bio">${escapeHtml(u.bio || 'No bio yet.')}</p>

      <div class="profile-stats">
        <div><strong>${u.postsCount ?? 0}</strong><span>Posts</span></div>
        <div><strong>${u.followersCount ?? 0}</strong><span>Followers</span></div>
        <div><strong>${u.followingCount ?? 0}</strong><span>Following</span></div>
      </div>

      <button class="btn btn-secondary btn-sm" data-action="edit-profile">
        Edit profile
      </button>
    </div>`;

  icons();
}

async function adminView() {
  const view = $('#view');
  if (!view) return;

  if (state.user?.username !== 'denpher') {
    view.innerHTML = `
      <div class="empty">
        <h3>Not authorized</h3>
        <p>Admin is founder-only.</p>
      </div>`;
    return;
  }

  view.innerHTML = `
    <div class="view-pad">
      <div class="admin-grid">
        <div class="card admin-stat"><strong>—</strong><span>Humans</span></div>
        <div class="card admin-stat"><strong>—</strong><span>Active</span></div>
        <div class="card admin-stat"><strong>—</strong><span>Reels</span></div>
        <div class="card admin-stat"><strong>—</strong><span>Chats</span></div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <h3 style="margin-bottom:12px">Search users</h3>
        <div class="field">
          <input id="admin-q" placeholder="Username or ID" />
        </div>
        <button class="btn btn-primary btn-sm" id="admin-search">Search</button>
        <div id="admin-results" style="margin-top:16px"></div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px">Announcement</h3>
        <div class="field">
          <input id="ann-title" placeholder="Title" maxlength="100" />
        </div>
        <div class="field">
          <textarea id="ann-msg" placeholder="Message" maxlength="500"></textarea>
        </div>
        <button class="btn btn-primary btn-sm" id="ann-send">Post announcement</button>
      </div>
    </div>`;

  const searchButton = $('#admin-search');
  const announcementButton = $('#ann-send');

  if (searchButton) {
    searchButton.onclick = async () => {
      const q = $('#admin-q')?.value.trim() || '';

      try {
        const data = await api(
          '/api/admin/users?q=' + encodeURIComponent(q)
        );

        const results = $('#admin-results');
        if (!results) return;

        results.innerHTML = (data.users || []).map(u => `
          <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong>@${escapeHtml(u.username)}</strong>
              <span style="color:var(--muted);font-size:12px">${escapeHtml(u.status)}</span>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm btn-secondary" data-verify="${escapeAttr(u.id)}">Verify 5d</button>
              <button class="btn btn-sm btn-secondary" data-ban="${escapeAttr(u.id)}">Ban</button>
            </div>
          </div>
        `).join('') || '<p style="color:var(--muted)">No users</p>';

      } catch (e) {
        toast(e.message);
      }
    };
  }

  if (announcementButton) {
    announcementButton.onclick = async () => {
      try {
        await api('/api/admin/announcements', {
          method: 'POST',
          body: {
            title: $('#ann-title')?.value || '',
            message: $('#ann-msg')?.value || '',
          },
        });

        toast('Announcement posted');

      } catch (e) {
        toast(e.message);
      }
    };
  }

  icons();
}

function renderLandingWatch() {
  const el = $('#landing-watch');
  if (!el) return;

  const samples = [
    {
      title: 'Demon Slayer · Infinity Castle',
      ch: 'Crunchyroll',
      img: 'https://i.ytimg.com/vi/wyiZWYMilgk/mqdefault.jpg',
    },
    {
      title: 'Jujutsu Kaisen Trailer',
      ch: 'Crunchyroll',
      img: 'https://i.ytimg.com/vi/pkKu9hLT-t8/mqdefault.jpg',
    },
    {
      title: 'Spy x Family',
      ch: 'Crunchyroll',
      img: 'https://i.ytimg.com/vi/ofXigq9aIpo/mqdefault.jpg',
    },
  ];

  el.innerHTML = samples.map(s => `
    <article class="card watch-card">
      <img src="${escapeAttr(s.img)}" alt="" loading="lazy" />
      <div class="body">
        <h3>${escapeHtml(s.title)}</h3>
        <div class="meta">${escapeHtml(s.ch)}</div>
        <button class="btn btn-secondary btn-sm" data-action="open-auth">
          Discuss in Chat
        </button>
      </div>
    </article>
  `).join('');
}

/* ---------- Events ---------- */

document.addEventListener('click', e => {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;

  if (action === 'open-auth') openAuth('signup');
  if (action === 'close-auth') closeAuth();
  if (action === 'logout') logout();

  if (action === 'open-compose') {
    toast('Reel upload opens the camera / file picker in the full client');
  }

  if (action === 'edit-profile') {
    toast('Profile editor available in Settings');
  }
});

$$('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => setAuthMode(tab.dataset.auth));
});

$('#auth-form')?.addEventListener('submit', submitAuth);

/* ---------- Boot ---------- */

(async () => {
  try {
    const authenticated = await loadMe();

    if (authenticated) {
      showShell();
    } else {
      showLanding();
    }

    icons();

  } catch (error) {
    console.error('NoChat startup error:', error);
    showLanding();
  }
})();
