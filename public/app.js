/* =========================================================
   NoChat — browser app
   Vanilla JS, talks to the Express API (cookie session) and
   Socket.IO for live chat, presence and notifications.
   ========================================================= */
(function () {
  "use strict";

  /* ---------------- tiny helpers ---------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtCount = (n) => {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
    return String(n);
  };
  function timeAgo(iso) {
    const d = new Date(iso); const s = Math.max(1, (Date.now() - d.getTime()) / 1000);
    if (s < 60) return "now";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    if (s < 604800) return Math.floor(s / 86400) + "d";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  const clock = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  function dayLabel(iso) {
    const d = new Date(iso); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------------- icons (Lucide paths) ---------------- */
  const ICONS = {
    film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M3 7.5h4M3 12h18M3 16.5h4M17 3v18M17 7.5h4M17 16.5h4"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
    trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    "volume-x": '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    "arrow-left": '<path d="m12 19-7-7 7-7M19 12H5"/>',
    "arrow-up": '<path d="m5 12 7-7 7 7M12 19V5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    "user-plus": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    "user-check": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
    "user-minus": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'
  };
  Object.assign(ICONS, {
    tv: '<rect width="20" height="15" x="2" y="7" rx="2"/><path d="m17 2-5 5-5-5"/>',
    "user-plus": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zM5 20h14"/>',
    wifi: '<path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.86a10 10 0 0 1 14 0M8.5 16.43a5 5 0 0 1 7 0"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    "group": '<circle cx="9" cy="7" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20v-1.5A4.5 4.5 0 0 1 6.5 14h5a4.5 4.5 0 0 1 4.5 4.5V20M16.5 14.2A3.5 3.5 0 0 1 22 17v3"/>'
  });
  const icon = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  function hydrateIcons(root = document) {
    $$("i[data-icon]", root).forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
  }
  Object.assign(ICONS, {
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>',
    video: '<path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    "phone-off": '<path d="M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19 19 0 0 1-3.3-2.7M5.3 15.6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8M22 2 2 22"/>'
  });
  const VERIFIED = '<span class="verified" title="Verified"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 1.8 3-.2 1 2.8 2.6 1.6-.9 2.9.9 2.9-2.6 1.6-1 2.8-3-.2L12 22l-2.4-1.8-3 .2-1-2.8L3 16l.9-2.9L3 10.2l2.6-1.6 1-2.8 3 .2z"/><path d="m8.5 12.2 2.3 2.3 4.7-4.8" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  const verified = (u) => (u && u.isVerified ? VERIFIED : "");

  function avatar(user, size = "md", online) {
    const name = (user && (user.displayName || user.username)) || "?";
    const inner = user && user.profilePicture
      ? `<img src="${esc(user.profilePicture)}" alt="" loading="lazy">`
      : esc(name.charAt(0).toUpperCase());
    const dot = online === undefined ? "" : `<span class="dot ${online ? "on" : ""}"></span>`;
    return `<span class="avatar ${size}">${inner}${dot}</span>`;
  }

  /* ---------------- toasts ---------------- */
  function toast(msg, type = "info") {
    if (!msg) return;
    const stack = $("#toastStack");
    const el = document.createElement("div");
    el.className = "toast " + type;
    const ic = type === "success" ? "check" : type === "error" ? "alert" : "bell";
    el.innerHTML = icon(ic) + `<span>${esc(msg)}</span>`;
    stack.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); }, 3400);
  }

  /* ---------------- API ---------------- */
  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== "string") {
      opts.body = JSON.stringify(opts.body);
    }
    if (opts.body && !(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
    const res = await fetch(path, { credentials: "include", ...opts, headers });
    let data = {};
    try { data = await res.json(); } catch (_) { /* empty body */ }
    if (!res.ok) {
      const err = new Error(data.error || "Something went wrong. Please try again.");
      err.status = res.status; err.code = data.code;
      err.canAppeal = data.canAppeal === true;
      if (res.status === 401 && !path.startsWith("/api/auth")) {
        err.silent = true; // never show raw auth errors in lists or toasts
        if (state.me) handleSignedOut(true);
      }
      if (res.status === 403 && /^ACCOUNT_/.test(data.code || "") && !path.startsWith("/api/auth")) {
        err.silent = true;
        if (state.me) { handleSignedOut(false); toast(data.error, "error"); }
      }
      throw err;
    }
    return data;
  }

  /* ---------------- state ---------------- */
  const state = {
    me: null,
    stats: {},
    muted: true,
    socket: null,
    reels: [],
    conversations: [],
    activeConvoId: null,
    activePartner: null,
    messages: [],
    online: new Set(),
    friends: [],
    requests: { incoming: [], outgoing: [] },
    peopleTab: "friends",
    commentsReelId: null,
    viewerOpen: false
  };

  /* ---------------- modals ---------------- */
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove("hidden");
    m._prevFocus = document.activeElement;
    setTimeout(() => { const f = m.querySelector("input:not([type=file]):not([type=hidden]), button:not([data-close])"); f && f.focus({ preventScroll: true }); }, 50);
  }
  function closeModal(id) {
    const m = typeof id === "string" ? document.getElementById(id) : id;
    if (!m || m.classList.contains("hidden")) return;
    m.classList.add("hidden");
    m.dispatchEvent(new CustomEvent("closed"));
    if (m._prevFocus && m._prevFocus.focus) m._prevFocus.focus({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const closer = e.target.closest("[data-close]");
    if (closer) { closeModal(closer.closest(".modal")); return; }
    if (e.target.classList && e.target.classList.contains("modal")) closeModal(e.target);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const open = $$(".modal:not(.hidden)").pop();
      if (open) closeModal(open);
      $("#emojiPicker")?.classList.add("hidden");
    }
  });

  function confirmDialog(title, text, yes = "Confirm") {
    return new Promise((resolve) => {
      $("#confirmTitle").textContent = title;
      $("#confirmText").textContent = text;
      $("#confirmYes").textContent = yes;
      openModal("confirmModal");
      const m = $("#confirmModal");
      const done = (v) => { cleanup(); closeModal(m); resolve(v); };
      const onYes = () => done(true);
      const onNo = () => done(false);
      const onClosed = () => { cleanup(); resolve(false); };
      function cleanup() {
        $("#confirmYes").removeEventListener("click", onYes);
        $("#confirmNo").removeEventListener("click", onNo);
        m.removeEventListener("closed", onClosed);
      }
      $("#confirmYes").addEventListener("click", onYes);
      $("#confirmNo").addEventListener("click", onNo);
      m.addEventListener("closed", onClosed);
    });
  }

  /* =========================================================
     AUTH
     ========================================================= */
  function setAuthTab(tab) {
    $$("[data-auth-tab]").forEach((b) => { const on = b.dataset.authTab === tab; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
    $("#loginForm").classList.toggle("hidden", tab !== "login");
    $("#registerForm").classList.toggle("hidden", tab !== "register");
    $("#loginError").classList.add("hidden");
    $("#registerError").classList.add("hidden");
    setTimeout(() => (tab === "login" ? $("#loginIdentifier") : $("#regDisplayName")).focus(), 30);
  }
  $$("[data-auth-tab]").forEach((b) => b.addEventListener("click", () => setAuthTab(b.dataset.authTab)));
  $$("[data-toggle-password]").forEach((b) => b.addEventListener("click", () => {
    const input = document.getElementById(b.dataset.togglePassword);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    b.textContent = show ? "Hide" : "Show";
  }));
  $("#regUsername").addEventListener("input", (e) => {
    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    if (v !== e.target.value) e.target.value = v;
  });
  $("#regPassword").addEventListener("input", (e) => {
    const v = e.target.value; let score = 0;
    if (v.length >= 6) score++; if (v.length >= 10) score++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++; if (/\d/.test(v) || /[^A-Za-z0-9]/.test(v)) score++;
    $("#strengthBar").style.width = (score / 4) * 100 + "%";
  });

  function showFormError(id, msg) { const el = $(id); el.textContent = msg; el.classList.remove("hidden"); }
  async function withBusy(btn, label, fn) {
    const prev = btn.textContent; btn.disabled = true; btn.textContent = label;
    try { return await fn(); } finally { btn.disabled = false; btn.textContent = prev; }
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#loginError").classList.add("hidden"); $("#loginAppealBtn").classList.add("hidden");
    const identifier = $("#loginIdentifier").value.trim();
    const password = $("#loginPassword").value;
    if (!identifier) return showFormError("#loginError", "Enter your username or email.");
    if (!password) return showFormError("#loginError", "Enter your password.");
    await withBusy($("#loginSubmit"), "Signing in…", async () => {
      try {
        const data = await api("/api/auth/login", { method: "POST", body: { identifier, password } });
        $("#loginPassword").value = "";
        await enterApp();
        toast(data.message || "Welcome back!", "success");
      } catch (err) {
        if (err.code === "NOT_FOUND") {
          showFormError("#loginError", "No account with that name yet — create one below.");
          $("#regUsername").value = identifier.includes("@") ? identifier.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") : identifier.toLowerCase().replace(/[^a-z0-9_]/g, "");
          if (identifier.includes("@")) $("#regEmail").value = identifier;
          setTimeout(() => setAuthTab("register"), 900);
        } else {
          showFormError("#loginError", err.message);
          if (err.canAppeal) $("#loginAppealBtn").classList.remove("hidden");
        }
      }
    });
  });
  $("#loginAppealBtn").addEventListener("click", () => openAppeal({ type: "account", text: "Explain why your account should be restored. Your username and password are used only to confirm it's you." }));

  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#registerError").classList.add("hidden");
    const body = {
      displayName: $("#regDisplayName").value.trim(),
      username: $("#regUsername").value.trim(),
      email: $("#regEmail").value.trim(),
      password: $("#regPassword").value
    };
    if (body.username.length < 3) return showFormError("#registerError", "Usernames need at least 3 characters.");
    if (body.password.length < 6) return showFormError("#registerError", "Passwords need at least 6 characters.");
    await withBusy($("#registerSubmit"), "Creating account…", async () => {
      try {
        await api("/api/auth/register", { method: "POST", body });
        $("#regPassword").value = "";
        await enterApp();
        toast("Welcome to NoChat! Upload your first reel or find friends.", "success");
      } catch (err) { showFormError("#registerError", err.message); }
    });
  });

  function showAuth() {
    $("#bootSplash").classList.add("hidden");
    $("#appShell").classList.add("hidden");
    $("#authView").classList.remove("hidden");
    setTimeout(() => $("#loginIdentifier").focus(), 50);
  }

  function handleSignedOut(fromServer) {
    if (handleSignedOut.busy) return; handleSignedOut.busy = true;
    setTimeout(() => { handleSignedOut.busy = false; }, 1500);
    state.calls?.end();
    state.me = null;
    currentView = null;
    state.reels = []; state.conversations = []; state.friends = []; state.requests = { incoming: [], outgoing: [] };
    closeChat(false);
    $$(".reel", feed).forEach((n) => n.remove());
    $("#meReelGrid").innerHTML = "";
    if (state.socket) { state.socket.disconnect(); state.socket = null; }
    $$(".modal").forEach((m) => m.classList.add("hidden"));
    $$("video").forEach((v) => v.pause());
    showAuth();
    if (fromServer) toast("Welcome back — please sign in to continue.");
  }

  async function enterApp() {
    const data = await api("/api/me");
    state.me = data.user;
    state.stats = data.stats || {};
    state.muted = !state.me.soundEnabled;
    renderMe();
    updateSoundUI();
    setBadge("unread", state.stats.unreadMessagesCount || 0);
    setBadge("requests", state.stats.pendingRequestsCount || 0);
    $("#bootSplash").classList.add("hidden");
    $("#authView").classList.add("hidden");
    $("#appShell").classList.remove("hidden");
    connectSocket();
    loadFeed();
    route();
    loadMyRestrictions();
  }

  $("#logoutBtn").addEventListener("click", async () => {
    const ok = await confirmDialog("Log out?", "You can sign back in any time with your username and password.", "Log out");
    if (!ok) return;
    try { await api("/api/auth/logout", { method: "POST" }); } catch (_) {}
    handleSignedOut();
    history.replaceState(null, "", "#/reels");
    toast("You're logged out.");
  });

  /* =========================================================
     ME / BADGES
     ========================================================= */
  function renderMe() {
    const u = state.me; if (!u) return;
    $$("[data-me-avatar]").forEach((el) => {
      const size = ["xs", "sm", "md", "lg", "xl"].find((s) => el.classList.contains(s)) || "md";
      const ringCls = u.isVerified ? " verified-ring" : "";
      el.outerHTML = avatar(u, size).replace('class="avatar', `data-me-avatar class="avatar${ringCls}`);
    });
    $$("[data-me-name]").forEach((el) => (el.textContent = u.displayName || u.username));
    $$("[data-me-username]").forEach((el) => (el.textContent = "@" + u.username));
    $$("[data-me-verified]").forEach((el) => (el.innerHTML = verified(u)));
    $("#meBio").textContent = u.bio || "";
    $("#meBio").classList.toggle("hidden", !u.bio);
    $("#meEmail").textContent = u.email || "Not added";
    
    // Member number badge
    if ($("#meMemberBadge")) {
      $("#meMemberBadge").textContent = "Human #" + (u.memberNumber || 21);
    }

    // Live verified countdown badge
    const vCount = $("#meVerifiedCountdown");
    if (vCount) {
      if (u.isVerified && u.verifiedUntil) {
        const ms = new Date(u.verifiedUntil).getTime() - Date.now();
        const days = Math.max(1, Math.ceil(ms / (24 * 3600 * 1000)));
        vCount.textContent = `Verified • ${days} day${days > 1 ? "s" : ""} left`;
        vCount.classList.remove("hidden");
      } else if (u.isVerified) {
        vCount.textContent = "Verified • Permanent";
        vCount.classList.remove("hidden");
      } else {
        vCount.classList.add("hidden");
      }
    }

    // Joined date
    if ($("#meJoinedDate")) {
      const dt = u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "Nov 2026";
      $("#meJoinedDate").innerHTML = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> <span>Joined ${dt}</span>`;
    }

    // Clean Posts / Followers / Following row
    $("#meReelsCount").textContent = fmtCount(u.postsCount ?? state.stats.reelsCount ?? 0);
    if ($("#meFollowersCount")) $("#meFollowersCount").textContent = fmtCount(u.followersCount ?? state.stats.subscribersCount ?? 0);
    if ($("#meFollowingCount")) $("#meFollowingCount").textContent = fmtCount(u.followingCount ?? state.stats.friendsCount ?? 0);
    $("#meSubsCount").textContent = fmtCount(u.subscribersCount ?? state.stats.subscribersCount);

    // 24h Welcome Banner
    const welcome = $("#welcomeBanner");
    if (welcome) {
      const isNew = u.createdAt && (Date.now() - new Date(u.createdAt).getTime() < 24 * 3600 * 1000);
      const dismissed = localStorage.getItem("nc_welcome_dismissed_" + u.id);
      if (isNew && !dismissed) {
        $("#welcomeBadge").textContent = `Human #${u.memberNumber || 21}`;
        $("#welcomeText").textContent = `Welcome ${u.displayName || u.username}, you are Human #${u.memberNumber || 21}`;
        welcome.classList.remove("hidden");
      } else {
        welcome.classList.add("hidden");
      }
    }

    $("#editDisplayName").value = u.displayName || "";
    $("#editBio").value = u.bio || "";
    $("#bioCount").textContent = (u.bio || "").length;
    $("#editSound").checked = u.soundEnabled !== false;
    $("#editReadReceipts").checked = u.readReceiptsEnabled !== false;
    $("#adminRow").classList.toggle("hidden",!u.isAdmin);
    $("#currentPasswordField").classList.toggle("hidden", u.hasPassword === false);
  }

  async function refreshMe() {
    try {
      const data = await api("/api/me");
      state.me = { ...state.me, ...data.user };
      state.stats = data.stats || state.stats;
      renderMe();
      setBadge("unread", state.stats.unreadMessagesCount || 0);
      setBadge("requests", state.stats.pendingRequestsCount || 0);
    } catch (_) {}
  }

  function setBadge(kind, n) {
    $$(`[data-badge="${kind}"]`).forEach((b) => { b.textContent = n > 99 ? "99+" : n; b.classList.toggle("hidden", !n); });
    const total = (Number($('[data-badge="unread"]')?.textContent) || 0);
    document.title = (total ? `(${total}) ` : "") + "NoChat — Reels, friends and private chat";
  }

  /* =========================================================
     ROUTER (#/reels, #/messages/:id, #/people, #/profile)
     ========================================================= */
  const VIEWS = ["reels", "videos", "messages", "people", "profile"];
  function parseHash() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const view = VIEWS.includes(parts[0]) ? parts[0] : "reels";
    return { view, id: parts[1] ? decodeURIComponent(parts[1]) : null };
  }
  let currentView = null;
  function route() {
    if (!state.me) return;
    const { view, id } = parseHash();
    $("#appShell").dataset.view = view;
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    $$("[data-nav]").forEach((n) => n.classList.toggle("active", n.dataset.nav === view));
    const changed = currentView !== view;
    currentView = view;

    if (view !== "reels") pauseAllReels(); else if (changed) setTimeout(playVisibleReel, 60);
    if (view !== "messages" || !id) closeChat(view === "messages");

    window.NoChatVideos?.route(view === "videos", view === "videos" ? id : null, changed);
    if (view === "reels" && id) scrollToReel(id);
    if (view === "messages") { loadConversations().then(() => { if (id) openChat(id); }); }
    if (view === "people" && changed) loadPeople();
    if (view === "profile" && changed) loadMyReels();
  }
  window.addEventListener("hashchange", route);
  const go = (path) => { if (location.hash !== "#/" + path) location.hash = "#/" + path; else route(); };

  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]");
    if (!a) return;
    const act = a.dataset.action;
    if (act === "open-upload") openUpload();
    else if (act === "toggle-sound") toggleSound();
    else if (act === "open-avatar") openAvatar();
    else if (act === "new-chat") openPicker();
  });

  /* =========================================================
     SOCKET
     ========================================================= */
  function connectSocket() {
    if (typeof io !== "function") return;
    if (state.socket) state.socket.disconnect();
    const s = io({ withCredentials: true });
    state.socket = s;
    state.calls = window.NoChatCalls(s,api,toast);
    window.NoChatGroups?.bindSocket(s);
    s.on('messages:read',({conversationId,userId,lastRead})=>{if(conversationId!==state.activeConvoId)return;if(state.activeGroup){refreshGroupReceipts();return;}state.messages.forEach(m=>{if(m.senderId!==userId && lastRead && m.createdAt<=lastRead)m.seenAt=lastRead;});renderMessages(false);});
    s.on('message:deleted',({conversationId,messageId})=>{if(conversationId!==state.activeConvoId)return;const m=state.messages.find(m=>m.id===messageId);if(m){m.deletedAt=new Date().toISOString();m.text='';m.attachment=null;renderMessages(false);}});

    s.on("connect", () => { if (state.activeConvoId) s.emit("conversation:join", state.activeConvoId); });
    // Socket.IO does not auto-retry after an auth (middleware) rejection. Check the
    // session over HTTP and retry, so a brief server restart never breaks live chat.
    let retryTimer = null;
    s.on("connect_error", (err) => {
      if (!err || err.message !== "Unauthorized" || retryTimer) return;
      retryTimer = setTimeout(async () => {
        retryTimer = null;
        try { await api("/api/me"); if (state.socket === s) s.connect(); } catch (_) { /* api() handles sign-out */ }
      }, 3000);
    });

    s.on("presence:update", ({ userId, isOnline }) => {
      if (isOnline) state.online.add(userId); else state.online.delete(userId);
      if (state.activePartner && state.activePartner.id === userId) { state.activePartner.isOnline = isOnline; renderChatHeader(); }
      const c = state.conversations.find((c) => c.user && c.user.id === userId);
      if (c) { c.isOnline = isOnline; renderConversations(); }
    });

    s.on("message:new", (m) => {
      if (m.conversationId !== state.activeConvoId) return;
      if (state.messages.some((x) => x.id === m.id)) return;
      // replace optimistic copy if this is our own message
      if (m.senderId === state.me.id) {
        const idx = state.messages.findIndex((x) => x.pending && x.text === m.text);
        if (idx !== -1) { state.messages[idx] = m; renderMessages(); return; }
      }
      state.messages.push(m);
      renderMessages(true);
      if (m.senderId !== state.me.id && !document.hidden && currentView === "messages" && state.me.readReceiptsEnabled !== false) { hideTyping(); api(`/api/conversations/${m.conversationId}/read`, { method: "POST" }).catch(() => {}); }
    });

    s.on("message:edited", ({ conversationId, message }) => {
      if (conversationId !== state.activeConvoId) return;
      const idx = state.messages.findIndex((x) => x.id === message.id);
      if (idx !== -1) {
        state.messages[idx] = { ...state.messages[idx], text: message.text, isEdited: true, editedAt: message.editedAt };
        renderMessages(false);
      }
    });

    s.on("conversation:update", ({ conversationId, message }) => {
      const viewing = currentView === "messages" && state.activeConvoId === conversationId && !document.hidden;
      if (!viewing) {
        const g = state.conversations.find((c) => c.id === conversationId && c.group);
        const who = message.system ? "" : `${message.senderDisplayName || message.senderUsername || ""}: `;
        toast(g ? `${g.group.name} · ${who}${(message.text || message.attachment?.name || "").slice(0, 60)}` : `${message.senderDisplayName}: ${(message.text || message.attachment?.name || "").slice(0, 60)}`);
      }
      loadConversations(true);
    });

    s.on("typing:active", ({ conversationId }) => { if (conversationId === state.activeConvoId) showTyping(); });
    s.on("typing:inactive", ({ conversationId }) => { if (conversationId === state.activeConvoId) hideTyping(); });

    s.on("friend:request", ({ fromUser }) => {
      toast(`${fromUser.displayName} sent you a friend request`);
      refreshMe(); if (currentView === "people") loadPeople();
    });
    s.on("friend:accepted", ({ user }) => {
      toast(`You and ${user.displayName} are now friends`, "success");
      refreshMe(); if (currentView === "people") loadPeople();
    });
    s.on("friend:removed", () => { refreshMe(); if (currentView === "people") loadPeople(); });
    s.on("user:subscribed", ({ subscriber }) => { toast(`${subscriber.displayName} subscribed to you`); refreshMe(); });
    s.on("reel:liked", ({ user }) => toast(`${user.displayName} liked your reel`));

    s.on("reel:new", (reel) => {
      if (reel.userId === state.me.id) return;
      if (state.reels.some((r) => r.id === reel.id)) return;
      $("#newReelsPill").classList.remove("hidden");
    });
    s.on("reel:deleted", ({ id }) => removeReelEverywhere(id));
    s.on("reel:like_update", ({ reelId, likesCount }) => {
      const r = state.reels.find((x) => x.id === reelId); if (r) r.likesCount = likesCount;
      $$(`[data-reel="${reelId}"] [data-like-count]`).forEach((el) => (el.textContent = fmtCount(likesCount)));
    });
    s.on("reel:comment_new", ({ reelId, comment }) => {
      bumpCommentCount(reelId, +1);
      if (state.commentsReelId === reelId && !$(`#commentList [data-comment="${comment.id}"]`)) appendComment(comment, true);
    });
    s.on("reel:comment_deleted", ({ reelId, commentId }) => {
      bumpCommentCount(reelId, -1);
      $(`#commentList [data-comment="${commentId}"]`)?.remove();
      if (state.commentsReelId === reelId) updateCommentsHeader();
    });
  }

  /* =========================================================
     REELS FEED
     ========================================================= */
  const feed = $("#feed");
  let io_obs = null;

  function captionHTML(text) {
    return esc(text).replace(/(^|\s)(#[\p{L}\p{N}_]+)/gu, '$1<span class="tag">$2</span>').replace(/(^|\s)(@[a-z0-9_]+)/g, '$1<span class="tag">$2</span>');
  }

  function reelHTML(r) {
    const mine = r.userId === state.me.id;
    const u = r.user || { username: "unknown", displayName: "Unknown" };
    return `
      <article class="reel" data-reel="${esc(r.id)}">
        <div class="reel-frame">
          <video src="${esc(r.videoUrl)}" playsinline loop preload="metadata" ${state.muted ? "muted" : ""}></video>
          ${r.musicUrl ? `<audio class="reel-audio" src="${esc(r.musicUrl)}" loop preload="metadata"></audio>` : ""}
          <div class="reel-tap" aria-hidden="true"></div>
          <div class="reel-paused"><span>${icon("play")}</span></div>
          <div class="reel-shade"></div>
          <div class="reel-info">
            <div class="reel-author">
              <button type="button" class="reel-author-btn" data-open-user="${esc(u.id)}">
                ${avatar(u, "sm")}<span class="name">${esc(u.displayName || u.username)}</span>${verified(u)}
              </button>
              ${mine ? "" : `<button type="button" class="reel-follow ${u.isSubscribed ? "on" : ""}" data-subscribe="${esc(u.id)}">${u.isSubscribed ? "Subscribed" : "Subscribe"}</button>`}
            </div>
            ${r.caption ? `<p class="reel-caption" data-caption>${captionHTML(r.caption)}</p>` : ""}
            <div class="reel-meta">${icon("music")}<span class="marquee"><span>${esc(r.musicTitle || "Original audio")} · ${esc(u.username)}&nbsp;&nbsp;&nbsp;${esc(r.musicTitle || "Original audio")} · ${esc(u.username)}</span></span><span>· ${timeAgo(r.createdAt)}</span></div>
          </div>
          <div class="reel-progress"><span></span></div>
        </div>
        <div class="reel-actions">
          <div class="ra ${r.isLiked ? "liked" : ""}" data-like-wrap><button type="button" class="ra-btn" data-like aria-label="Like" aria-pressed="${!!r.isLiked}">${icon("heart")}</button><span data-like-count>${fmtCount(r.likesCount)}</span></div>
          <div class="ra"><button type="button" class="ra-btn" data-comments aria-label="Comments">${icon("message")}</button><span data-comment-count>${fmtCount(r.commentsCount)}</span></div>
          <div class="ra"><button type="button" class="ra-btn" data-share aria-label="Share">${icon("share")}</button><span>Share</span></div>
          <div class="ra"><button type="button" class="ra-btn" data-report aria-label="Report reel">${icon("shield")}</button><span>Report</span></div>
          ${mine || state.me.isAdmin ? `<div class="ra"><button type="button" class="ra-btn" data-delete aria-label="Delete reel">${icon("trash")}</button><span>Delete</span></div>` : ""}
        </div>
      </article>`;
  }

  async function loadFeed() {
    $("#feedLoading").classList.remove("hidden");
    $("#feedEmpty").classList.add("hidden");
    try {
      const data = await api("/api/reels");
      state.reels = data.reels || [];
      renderFeed();
    } catch (err) {
      $$(".reel", feed).forEach((n) => n.remove());
      $("#feedEmpty").classList.remove("hidden");
      (err.silent || toast(err.message, "error"));
    } finally {
      $("#feedLoading").classList.add("hidden");
    }
  }

  function renderFeed() {
    $$(".reel", feed).forEach((n) => n.remove());
    $("#feedEmpty").classList.toggle("hidden", state.reels.length > 0);
    feed.insertAdjacentHTML("beforeend", state.reels.map(reelHTML).join(""));
    observeReels();
  }

  function observeReels() {
    io_obs?.disconnect();
    io_obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const v = en.target.querySelector("video");
        if (en.isIntersecting && en.intersectionRatio >= 0.6 && currentView === "reels" && !state.viewerOpen) playReel(en.target);
        else { v.pause(); en.target.querySelector('.reel-audio')?.pause(); }
      });
    }, { root: feed, threshold: [0, 0.6, 1] });
    $$(".reel", feed).forEach((el) => io_obs.observe(el));
  }

  function playReel(el) {
    const v = el.querySelector("video");
    const audio=el.querySelector('.reel-audio');
    v.muted = state.muted || Boolean(audio);
    if(audio){audio.muted=state.muted;audio.currentTime=Number.isFinite(audio.duration)&&audio.duration>0?v.currentTime%audio.duration:0;audio.play().catch(()=>{audio.muted=true;});}
    el.classList.remove("is-paused");
    const p = v.play();
    if (p && p.catch) p.catch(() => {
      // Autoplay with sound is blocked until the user interacts — fall back to muted.
      if (!v.muted) { state.muted = true; updateSoundUI(); v.muted = true; v.play().catch(() => el.classList.add("is-paused")); }
      else el.classList.add("is-paused");
    });
  }
  function pauseAllReels() { $$(".reel video,.reel-audio").forEach((v) => v.pause()); }
  function playVisibleReel() {
    const r = feed.getBoundingClientRect();
    const el = $$(".reel", feed).find((x) => { const b = x.getBoundingClientRect(); return b.top < r.top + r.height / 2 && b.bottom > r.top + r.height / 2; });
    if (el) playReel(el);
  }
  function scrollToReel(id) {
    const el = $(`.reel[data-reel="${CSS.escape(id)}"]`, feed);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  // progress bars
  feed.addEventListener("timeupdate", (e) => {
    const v = e.target; if (!(v instanceof HTMLVideoElement) || !v.duration) return;
    const bar = v.closest(".reel-frame").querySelector(".reel-progress span");
    bar.style.width = (v.currentTime / v.duration) * 100 + "%";
  }, true);

  function toggleSound() {
    state.muted = !state.muted;
    $$(".reel video").forEach((v) => (v.muted = state.muted || Boolean(v.parentElement.querySelector('.reel-audio'))));
    $$('.reel-audio').forEach(a=>{a.muted=state.muted;if(!a.closest('.reel').querySelector('video').paused)a.play().catch(()=>toast('Tap the reel to enable audio.'));});
    updateSoundUI();
    toast(state.muted ? "Sound off" : "Sound on");
  }
  function updateSoundUI() {
    $$("[data-sound-icon]").forEach((el) => (el.innerHTML = icon(state.muted ? "volume-x" : "volume")));
    $$("[data-sound-label]").forEach((el) => (el.textContent = state.muted ? "Sound off" : "Sound on"));
  }

  $("#refreshFeed").addEventListener("click", () => { $("#newReelsPill").classList.add("hidden"); loadFeed().then(() => feed.scrollTo({ top: 0 })); });
  $("#newReelsPill").addEventListener("click", () => { $("#newReelsPill").classList.add("hidden"); loadFeed().then(() => feed.scrollTo({ top: 0, behavior: "smooth" })); });

  // keyboard: up/down to move between reels, M to mute, space to pause
  document.addEventListener("keydown", (e) => {
    if (currentView !== "reels" || $$(".modal:not(.hidden)").length || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); feed.scrollBy({ top: feed.clientHeight, behavior: "smooth" }); }
    if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); feed.scrollBy({ top: -feed.clientHeight, behavior: "smooth" }); }
    if (e.key === "m") toggleSound();
    if (e.key === " ") { e.preventDefault(); const el = currentReelEl(); el && togglePause(el); }
  });
  function currentReelEl() {
    const r = feed.getBoundingClientRect();
    return $$(".reel", feed).find((x) => { const b = x.getBoundingClientRect(); return b.top <= r.top + r.height / 2 && b.bottom >= r.top + r.height / 2; });
  }
  function togglePause(el) {
    const v = el.querySelector("video");
    if (v.paused) { playReel(el); } else { v.pause(); el.querySelector('.reel-audio')?.pause(); el.classList.add("is-paused"); }
  }

  // Shared reel interactions (feed + viewer modal)
  function bindReelInteractions(root) {
    let lastTap = 0, tapTimer = null;
    root.addEventListener("click", async (e) => {
      const reelEl = e.target.closest(".reel"); if (!reelEl) return;
      const id = reelEl.dataset.reel;
      const reel = findReel(id);

      if (e.target.closest(".reel-tap")) {
        const now = Date.now();
        if (now - lastTap < 280) {
          clearTimeout(tapTimer); lastTap = 0;
          heartBurst(reelEl, e);
          if (reel && !reel.isLiked) toggleLike(id);
        } else {
          lastTap = now;
          tapTimer = setTimeout(() => togglePause(reelEl), 280);
        }
        return;
      }
      if (e.target.closest("[data-like]")) return toggleLike(id);
      if (e.target.closest("[data-comments]")) return openComments(id);
      if (e.target.closest("[data-share]")) return shareReel(id);
      if (e.target.closest("[data-delete]")) return deleteReel(id);
      if (e.target.closest("[data-report]")) {const reason=prompt("Why are you reporting this reel?");if(reason)try{await api(`/api/reels/${id}/report`,{method:'POST',body:{reason}});toast('Report submitted','success');}catch(err){toast(err.message,'error');}return;}
      if (e.target.closest("[data-caption]")) return e.target.closest("[data-caption]").classList.toggle("open");
      const sub = e.target.closest("[data-subscribe]");
      if (sub) return toggleSubscribe(sub.dataset.subscribe);
      const u = e.target.closest("[data-open-user]");
      if (u) return openUser(u.dataset.openUser);
    });
  }
  bindReelInteractions(feed);
  bindReelInteractions($("#viewerBody"));

  const reelCache = new Map();
  const findReel = (id) => state.reels.find((r) => r.id === id) || reelCache.get(id);

  function heartBurst(reelEl, e) {
    const frame = reelEl.querySelector(".reel-frame");
    const rect = frame.getBoundingClientRect();
    const h = document.createElement("div");
    h.className = "heart-burst";
    h.style.left = (e.clientX - rect.left) + "px";
    h.style.top = (e.clientY - rect.top) + "px";
    h.innerHTML = `<svg viewBox="0 0 24 24">${ICONS.heart}</svg>`;
    frame.appendChild(h);
    setTimeout(() => h.remove(), 900);
  }

  async function toggleLike(id) {
    const r = findReel(id); if (!r) return;
    const prev = { isLiked: r.isLiked, likesCount: r.likesCount };
    r.isLiked = !r.isLiked; r.likesCount += r.isLiked ? 1 : -1;
    paintLike(id, r);
    try {
      const data = await api(`/api/reels/${id}/like`, { method: "POST" });
      r.isLiked = data.isLiked; r.likesCount = data.likesCount; paintLike(id, r);
    } catch (err) { Object.assign(r, prev); paintLike(id, r); (err.silent || toast(err.message, "error")); }
  }
  function paintLike(id, r) {
    $$(`[data-reel="${id}"]`).forEach((el) => {
      const w = el.querySelector("[data-like-wrap]"); if (!w) return;
      w.classList.toggle("liked", !!r.isLiked);
      w.querySelector("[data-like]").setAttribute("aria-pressed", !!r.isLiked);
      w.querySelector("[data-like-count]").textContent = fmtCount(r.likesCount);
    });
  }

  async function shareReel(id) {
    const r = findReel(id);
    state.sharingReelId = id;
    openModal("shareReelModal");
    const box = $("#shareReelConvoList");
    if (!state.conversations.length) {
      await loadConversations(true);
    }
    if (!state.conversations.length) {
      box.innerHTML = `<p class="muted" style="padding:16px;text-align:center">No chats yet. Start a chat with a friend to share reels.</p>`;
      return;
    }
    box.innerHTML = state.conversations.map(c => `
      <div class="pick-row" data-send-reel-convo="${esc(c.id)}" style="cursor:pointer;display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:10px;">
        ${c.group ? groupAvatar(c.group, 'sm') : avatar(c.user, 'sm')}
        <div style="flex:1;min-width:0">
          <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px">${esc(c.group ? c.group.name : c.user?.displayName || c.user?.username)}</strong>
          <small class="muted" style="font-size:11px">${c.group ? 'Group' : '@' + esc(c.user?.username)}</small>
        </div>
        <button type="button" class="btn btn-primary sm" style="height:28px;padding:0 12px;font-size:12px">Send</button>
      </div>
    `).join('');
  }

  async function deleteReel(id) {
    const ok = await confirmDialog("Delete this reel?", "It will be removed for everyone, along with its likes and comments.", "Delete");
    if (!ok) return;
    try {
      await api(`/api/reels/${id}`, { method: "DELETE" });
      removeReelEverywhere(id);
      toast("Reel deleted", "success");
      refreshMe();
    } catch (err) { (err.silent || toast(err.message, "error")); }
  }
  function removeReelEverywhere(id) {
    state.reels = state.reels.filter((r) => r.id !== id);
    $$(`[data-reel="${id}"], [data-tile="${id}"]`).forEach((el) => el.remove());
    if (state.viewerOpen && !$("#viewerBody .reel")) closeModal("viewerModal");
    $("#feedEmpty").classList.toggle("hidden", state.reels.length > 0);
  }

  async function toggleSubscribe(userId, btnOverride) {
    try {
      const data = await api(`/api/users/${userId}/subscribe`, { method: "POST" });
      state.reels.forEach((r) => { if (r.user && r.user.id === userId) { r.user.isSubscribed = data.isSubscribed; r.user.subscribersCount = data.subscribersCount; } });
      $$(`[data-subscribe="${userId}"]`).forEach((b) => {
        b.classList.toggle("on", data.isSubscribed);
        if (b.classList.contains("reel-follow")) b.textContent = data.isSubscribed ? "Subscribed" : "Subscribe";
        else b.innerHTML = icon("star") + (data.isSubscribed ? " Subscribed" : " Subscribe");
      });
      $$(`[data-subs-count="${userId}"]`).forEach((el) => (el.textContent = fmtCount(data.subscribersCount)));
      toast(data.isSubscribed ? "Subscribed" : "Unsubscribed", "success");
    } catch (err) { (err.silent || toast(err.message, "error")); }
  }

  /* ---------------- reel viewer modal ---------------- */
  function openViewer(reel) {
    reelCache.set(reel.id, reel);
    pauseAllReels();
    state.viewerOpen = true;
    $("#viewerBody").innerHTML = reelHTML(reel);
    openModal("viewerModal");
    const el = $("#viewerBody .reel");
    playReel(el);
  }
  $("#viewerModal").addEventListener("closed", () => {
    state.viewerOpen = false;
    $$("#viewerBody video,#viewerBody audio").forEach((v) => v.pause());
    $("#viewerBody").innerHTML = "";
    if (currentView === "reels") playVisibleReel();
  });

  /* ---------------- comments ---------------- */
  function bumpCommentCount(reelId, delta) {
    const r = findReel(reelId); if (r) r.commentsCount = Math.max(0, (r.commentsCount || 0) + delta);
    $$(`[data-reel="${reelId}"] [data-comment-count]`).forEach((el) => (el.textContent = fmtCount(r ? r.commentsCount : 0)));
  }
  function updateCommentsHeader() {
    const n = $$("#commentList [data-comment]").length;
    $("#commentsCount").textContent = n;
    if (!n) $("#commentList").innerHTML = `<div class="empty"><div class="empty-icon">${icon("message")}</div><h3>No comments yet</h3><p class="muted">Start the conversation.</p></div>`;
  }
  function commentHTML(c) {
    const r = findReel(c.reelId);
    const canDelete = c.canDelete === true || (c.user && (c.user.id === state.me.id || state.me.isAdmin));
    return `<div class="comment" data-comment="${esc(c.id)}">
      <button type="button" data-open-user="${esc(c.user?.id)}">${avatar(c.user, "sm")}</button>
      <div class="comment-body">
        <header><button type="button" data-open-user="${esc(c.user?.id)}">${esc(c.user?.displayName || "User")}</button>${verified(c.user)}<time>${timeAgo(c.createdAt)}</time></header>
        <p>${esc(c.content)}</p>
      </div>
      ${canDelete ? `<button type="button" class="icon-btn" data-delete-comment="${esc(c.id)}" aria-label="Delete comment">${icon("trash")}</button>` : ""}
    </div>`;
  }
  function appendComment(c, scroll) {
    const list = $("#commentList");
    if (list.querySelector(".empty")) list.innerHTML = "";
    list.insertAdjacentHTML("beforeend", commentHTML(c));
    updateCommentsHeader();
    if (scroll) list.scrollTop = list.scrollHeight;
  }
  async function openComments(reelId) {
    state.commentsReelId = reelId;
    $("#commentList").innerHTML = `<div class="feed-state"><div class="spinner"></div></div>`;
    $("#commentsCount").textContent = "…";
    openModal("commentsModal");
    try {
      const data = await api(`/api/reels/${reelId}/comments`);
      $("#commentList").innerHTML = data.comments.map(commentHTML).join("");
      updateCommentsHeader();
    } catch (err) { $("#commentList").innerHTML = `<p class="muted">${err.silent ? "" : esc(err.message)}</p>`; }
  }
  $("#commentsModal").addEventListener("closed", () => { state.commentsReelId = null; $("#commentInput").value = ""; $("#commentSubmit").disabled = true; });
  $("#commentInput").addEventListener("input", (e) => ($("#commentSubmit").disabled = !e.target.value.trim()));
  $("#commentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = $("#commentInput").value.trim(); if (!content || !state.commentsReelId) return;
    $("#commentSubmit").disabled = true;
    try {
      const data = await api(`/api/reels/${state.commentsReelId}/comments`, { method: "POST", body: { content } });
      $("#commentInput").value = "";
      if (!$(`#commentList [data-comment="${data.comment.id}"]`)) appendComment(data.comment, true);
    } catch (err) { (err.silent || toast(err.message, "error")); $("#commentSubmit").disabled = false; }
  });
  $("#commentList").addEventListener("click", async (e) => {
    const del = e.target.closest("[data-delete-comment]");
    if (del) {
      if (!(await confirmDialog("Delete comment?", "This removes the comment for everyone.", "Delete"))) return;
      try { await api(`/api/reels/${state.commentsReelId}/comments/${del.dataset.deleteComment}`, { method: "DELETE" }); del.closest(".comment").remove(); updateCommentsHeader(); }
      catch (err) { (err.silent || toast(err.message, "error")); }
      return;
    }
    const u = e.target.closest("[data-open-user]");
    if (u) { closeModal("commentsModal"); openUser(u.dataset.openUser); }
  });

  /* =========================================================
     UPLOAD
     ========================================================= */
  const videoInput = $("#videoInput");
  let selectedFile = null, previewUrl = null, uploading = false, selectedAudioId = null;
  const MAX_VIDEO = 100 * 1024 * 1024;

  function openUpload() { resetUpload(); openModal("uploadModal"); }
  function resetUpload() {
    if (uploading) return;
    selectedFile = null; videoInput.value = "";
    selectedAudioId=null;
    if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null;
    $("#previewVideo").removeAttribute("src");
    $("#dropPrompt").classList.remove("hidden");
    $("#dropPreview").classList.add("hidden");
    $("#captionInput").value = ""; $("#captionCount").textContent = "0";
    $("#musicInput").value = "";
    $("#publishBtn").disabled = true;
    $("#uploadProgress").classList.add("hidden");
  }
  function setVideo(file) {
    if (!file) return;
    const okType = /^video\//.test(file.type) || /\.(mp4|webm|mov|mkv)$/i.test(file.name);
    if (!okType) return toast("Please choose an MP4, WebM or MOV video.", "error");
    if (file.size > MAX_VIDEO) return toast("That video is over 100 MB.", "error");
    selectedFile = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    $("#previewVideo").src = previewUrl;
    $("#fileChip").textContent = `${file.name} · ${(file.size / 1048576).toFixed(1)} MB`;
    $("#dropPrompt").classList.add("hidden");
    $("#dropPreview").classList.remove("hidden");
    $("#publishBtn").disabled = false;
  }
  $("#pickVideoBtn").addEventListener("click", (e) => { e.stopPropagation(); videoInput.click(); });
  $("#dropzone").addEventListener("click", (e) => { if (!selectedFile && !e.target.closest("button")) videoInput.click(); });
  $("#dropzone").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !selectedFile) { e.preventDefault(); videoInput.click(); } });
  videoInput.addEventListener("change", () => setVideo(videoInput.files[0]));
  ["dragenter", "dragover"].forEach((ev) => $("#dropzone").addEventListener(ev, (e) => { e.preventDefault(); $("#dropzone").classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => $("#dropzone").addEventListener(ev, (e) => { e.preventDefault(); $("#dropzone").classList.remove("drag"); }));
  $("#dropzone").addEventListener("drop", (e) => setVideo(e.dataTransfer.files[0]));
  $("#removeVideoBtn").addEventListener("click", (e) => { e.stopPropagation(); const c = $("#captionInput").value, m = $("#musicInput").value; resetUpload(); $("#captionInput").value = c; $("#musicInput").value = m; $("#captionCount").textContent = c.length; });
  $("#captionInput").addEventListener("input", (e) => ($("#captionCount").textContent = e.target.value.length));
  $("#uploadModal").addEventListener("closed", () => { $("#previewVideo").pause(); });

  $("#uploadForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selectedFile || uploading) return;
    const fd = new FormData();
    fd.append("video", selectedFile);
    fd.append("caption", $("#captionInput").value.trim());
    fd.append("musicTitle", $("#musicInput").value.trim() || "Original audio");
    if(selectedAudioId)fd.append('audioId',selectedAudioId);
    uploading = true;
    $("#publishBtn").disabled = true;
    $("#uploadProgress").classList.remove("hidden");
    const fill = $("#uploadProgressFill"), txt = $("#uploadProgressText");
    fill.style.width = "2%"; txt.textContent = "Uploading… 0%";

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/reels");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const pct = Math.round((ev.loaded / ev.total) * 100);
      fill.style.width = pct + "%"; txt.textContent = pct < 100 ? `Uploading… ${pct}%` : "Processing…";
    };
    xhr.onload = () => {
      uploading = false;
      let data = {}; try { data = JSON.parse(xhr.responseText); } catch (_) {}
      if (xhr.status >= 200 && xhr.status < 300) {
        closeModal("uploadModal"); resetUpload();
        toast(data.reel?.moderationStatus === "approved" ? "Your reel is live" : "Reel saved privately for moderation review", "success");
        if (data.reel?.moderationStatus === "approved") { if(!state.reels.some(r=>r.id===data.reel.id))state.reels.unshift(data.reel); renderFeed(); }
        refreshMe(); loadMyReels();
        go("reels"); feed.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        $("#publishBtn").disabled = false; $("#uploadProgress").classList.add("hidden");
        toast(data.error || "Upload failed. Please try again.", "error");
      }
    };
    xhr.onerror = () => { uploading = false; $("#publishBtn").disabled = false; $("#uploadProgress").classList.add("hidden"); toast("Network problem during upload.", "error"); };
    xhr.send(fd);
  });

  /* ---------------- sounds ---------------- */
  const previewAudio = new Audio(); previewAudio.preload = "none"; previewAudio.setAttribute("playsinline", "");
  let playingTrack = null;
  $("#browseSoundsBtn").addEventListener("click", () => { openModal("soundsModal"); loadSounds(""); });
  $("#soundSearch").addEventListener("input", debounce((e) => loadSounds(e.target.value), 250));
  $("#soundsModal").addEventListener("closed", () => { previewAudio.pause(); playingTrack = null; });
  async function loadSounds(q) {
    $("#soundList").innerHTML = `<div class="feed-state"><div class="spinner"></div></div>`;
    try {
      const data = await api("/api/audio/search?q=" + encodeURIComponent(q || ""));
      if (!data.tracks.length) { $("#soundList").innerHTML = `<p class="muted" style="padding:16px;text-align:center">No sounds match “${esc(q)}”.</p>`; return; }
      $("#soundList").innerHTML = data.tracks.map((t) => `
        <div class="sound" data-track='${esc(JSON.stringify({ id: t.id, title: t.title, url: t.url }))}'>
          <button type="button" class="sound-play" data-play aria-label="Preview ${esc(t.title)}">${icon("play")}</button>
          <div class="sound-text"><strong>${esc(t.title)}</strong><small>${esc(t.artist)} · ${esc(t.category)} · ${esc(t.duration)}</small></div>
          <button type="button" class="btn btn-soft sm" data-use>Use</button>
        </div>`).join("");
    } catch (err) { $("#soundList").innerHTML = `<p class="muted">${err.silent ? "" : esc(err.message)}</p>`; }
  }
  $("#soundList").addEventListener("click", (e) => {
    const row = e.target.closest(".sound"); if (!row) return;
    const t = JSON.parse(row.dataset.track);
    if (e.target.closest("[data-use]")) {
      $("#musicInput").value = t.title;
      selectedAudioId=t.id;
      closeModal("soundsModal");
      toast(`Sound set to “${t.title}”`, "success");
      return;
    }
    if (e.target.closest("[data-play]")) {
      $$(".sound-play").forEach((b) => { b.classList.remove("playing"); b.innerHTML = icon("play"); });
      if (playingTrack === t.id) { previewAudio.pause(); playingTrack = null; return; }
      previewAudio.src = t.url; previewAudio.load();
      previewAudio.play().catch(() => setTimeout(() => previewAudio.play().catch(() => toast("Tap play again to hear this sound.")), 300));
      playingTrack = t.id;
      const b = row.querySelector("[data-play]"); b.classList.add("playing"); b.innerHTML = icon("pause");
    }
  });
  previewAudio.addEventListener("ended", () => { playingTrack = null; $$(".sound-play").forEach((b) => { b.classList.remove("playing"); b.innerHTML = icon("play"); }); });

  /* =========================================================
     MESSAGES
     ========================================================= */
  async function loadConversations(silent) {
    if (!silent && !state.conversations.length) $("#convoList").innerHTML = Array.from({ length: 5 }, () => `<div class="skeleton" style="height:60px;margin:4px 0"></div>`).join("");
    try {
      const data = await api("/api/conversations");
      state.conversations = data.conversations || [];
      data.conversations.forEach((c) => { if (c.isOnline && c.user) state.online.add(c.user.id); });
      renderConversations();
      const unread = state.conversations.reduce((s, c) => s + (c.id === state.activeConvoId && currentView === "messages" ? 0 : c.unreadCount || 0), 0);
      setBadge("unread", unread);
    } catch (err) { if (!silent) $("#convoList").innerHTML = `<p class="muted" style="padding:12px">${err.silent ? "" : esc(err.message)}</p>`; }
  }
  function renderConversations() {
    const q = $("#convoSearch").value.trim().toLowerCase();
    const list = state.conversations.filter((c) => !q || (c.group ? c.group.name.toLowerCase().includes(q) : (c.user.displayName || "").toLowerCase().includes(q) || c.user.username.includes(q)));
    if (!state.conversations.length) {
      $("#convoList").innerHTML = `<div class="empty"><div class="empty-icon">${icon("message")}</div><h3>No chats yet</h3><p class="muted">Message a friend to get started.</p><button type="button" class="btn btn-primary sm" data-action="new-chat">New message</button></div>`;
      return;
    }
    if (!list.length) { $("#convoList").innerHTML = `<p class="muted" style="padding:16px;text-align:center">No chats match “${esc(q)}”.</p>`; return; }
    $("#convoList").innerHTML = list.map((c) => {
      const unread = c.id === state.activeConvoId ? 0 : c.unreadCount || 0;
      if (c.group) {
        const lastG = c.lastMessage ? (c.lastSender ? c.lastSender + ": " : "") + c.lastMessage : "Group created";
        return `<a href="#/messages/${esc(c.id)}" class="convo is-group ${c.id === state.activeConvoId ? "active" : ""} ${unread ? "unread" : ""}">
        ${groupAvatar(c.group, "md")}
        <span class="convo-text">
          <span class="convo-top"><strong>${esc(c.group.name)}<span class="group-tag">${icon("group")}${c.group.memberCount}</span></strong><time>${timeAgo(c.lastAt)}</time></span>
          <span class="convo-last">${esc(lastG)}</span>
        </span>
        ${unread ? `<b class="badge">${unread}</b>` : ""}
      </a>`;
      }
      const last = c.lastMessage ? (c.lastMessageFromMe ? "You: " : "") + c.lastMessage : "Say hello 👋";
      return `<a href="#/messages/${esc(c.id)}" class="convo ${c.id === state.activeConvoId ? "active" : ""} ${unread ? "unread" : ""}">
        ${avatar(c.user, "md", state.online.has(c.user.id) || c.isOnline)}
        <span class="convo-text">
          <span class="convo-top"><strong>${esc(c.user.displayName)}${verified(c.user)}</strong><time>${timeAgo(c.lastAt)}</time></span>
          <span class="convo-last">${esc(last)}</span>
        </span>
        ${unread ? `<b class="badge">${unread}</b>` : ""}
      </a>`;
    }).join("");
  }
  function groupAvatar(g, size = "md") {
    const inner = g && g.avatar ? `<img src="${esc(g.avatar)}" alt="" loading="lazy">` : icon("group");
    return `<span class="avatar group-avatar ${size}">${inner}</span>`;
  }
  const refreshGroupReceipts = debounce(async () => {
    const id = state.activeConvoId; if (!id || !state.activeGroup) return;
    try { const data = await api(`/api/conversations/${id}/messages`); if (state.activeConvoId !== id) return; const map = new Map(data.messages.map((m) => [m.id, m])); state.messages.forEach((m) => { const f = map.get(m.id); if (f) { m.readBy = f.readBy; m.readTotal = f.readTotal; m.seenAt = f.seenAt; } }); renderMessages(false); } catch (_) {}
  }, 800);
  const messageCache = new Map();
  $("#convoSearch").addEventListener("input", renderConversations);
  $("#newChatBtn").addEventListener("click", openPicker);

  async function openChat(convoId) {
    const c = state.conversations.find((x) => x.id === convoId);
    if (!c) { toast("That chat isn't available.", "error"); go("messages"); return; }
    if (state.activeConvoId && state.activeConvoId !== convoId) hideTyping();
    state.activeConvoId = convoId;
    state.activeGroup = c.group ? { ...c.group } : null;
    state.activePartner = c.group ? null : { ...c.user, isOnline: state.online.has(c.user.id) || c.isOnline };
    $("#chatActive").classList.toggle("is-group", Boolean(c.group));
    $("#chatLayout").classList.add("has-active");
    $("#appShell").classList.add("chat-open");
    $("#chatEmpty").classList.add("hidden");
    $("#chatActive").classList.remove("hidden");
    renderChatHeader();
    renderConversations();

    // Zero-lag instant render from cache if available
    if (messageCache.has(convoId)) {
      state.messages = messageCache.get(convoId);
      renderMessages(true);
    } else {
      $("#msgList").innerHTML = `<div class="feed-state"><div class="skeleton-line w50" style="margin:20px auto"></div></div>`;
    }

    state.socket?.emit("conversation:join", convoId);
    try {
      const data = await api(`/api/conversations/${convoId}/messages`);
      if (state.activeConvoId !== convoId) return;
      state.messages = data.messages || [];
      messageCache.set(convoId, state.messages.slice(-50));
      renderMessages(true);
      if (!document.hidden && state.me.readReceiptsEnabled !== false) await api(`/api/conversations/${convoId}/read`,{method:'POST'});
      c.unreadCount = 0; renderConversations();
      setBadge("unread", state.conversations.reduce((s, x) => s + (x.unreadCount || 0), 0));
    } catch (err) {
      if (!messageCache.has(convoId)) $("#msgList").innerHTML = `<p class="muted">${err.silent ? "" : esc(err.message)}</p>`;
    }
    if (window.matchMedia("(min-width: 861px)").matches) $("#composerInput").focus();
  }
  function closeChat(stayOnMessages) {
    if (!state.activeConvoId && !$("#appShell").classList.contains("chat-open")) return;
    state.activeConvoId = null; state.activePartner = null; state.activeGroup = null; state.messages = [];
    $("#chatLayout").classList.remove("has-active");
    $("#appShell").classList.remove("chat-open");
    $("#chatActive").classList.add("hidden");
    $("#chatEmpty").classList.remove("hidden");
    if (stayOnMessages) renderConversations();
  }
  function renderChatHeader() {
    const g = state.activeGroup;
    if (g) {
      $("#chatPartnerAvatar").outerHTML = groupAvatar(g, "sm").replace('class="avatar', 'id="chatPartnerAvatar" class="avatar');
      $("#chatPartnerName").textContent = g.name;
      const c = state.conversations.find((x) => x.id === state.activeConvoId);
      const online = c?.onlineCount || 0;
      $("#chatPartnerStatus").textContent = `${g.memberCount} members${online ? ` · ${online} online` : ""}`;
      $("#chatPartnerStatus").classList.toggle("on", online > 0);
      return;
    }
    const p = state.activePartner; if (!p) return;
    $("#chatPartnerAvatar").outerHTML = avatar(p, "sm", p.isOnline).replace('class="avatar', 'id="chatPartnerAvatar" class="avatar');
    $("#chatPartnerName").innerHTML = esc(p.displayName) + verified(p);
    const st = $("#chatPartnerStatus");
    st.textContent = p.isOnline ? "Active now" : "@" + p.username;
    st.classList.toggle("on", !!p.isOnline);
  }
  $("#chatPartnerBtn").addEventListener("click", () => { if (state.activeGroup) window.NoChatGroups?.openInfo(state.activeConvoId); else if (state.activePartner) openUser(state.activePartner.id); });

  const isEmojiOnly = (t) => /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s){1,6}$/u.test(t) && /\p{Extended_Pictographic}/u.test(t) && [...t.replace(/\s/g, "")].length <= 6;

  function messageItemHTML(m, prev = null) {
    if (m.system) {
      return `<div data-message-id="${esc(m.id)}" class="sys-msg"><span>${esc(m.text)}</span><time>${clock(m.createdAt)}</time></div>`;
    }
    const mine = m.senderId === state.me.id;
    const inGroup = Boolean(state.activeGroup);
    const receipt = inGroup ? (m.readTotal && m.readBy >= m.readTotal ? '<span class="receipt seen">Seen by all</span>' : m.readBy ? `<span class="receipt seen">Seen by ${m.readBy}</span>` : '<span class="receipt">Sent</span>') : `<span class="receipt ${m.seenAt ? 'seen' : ''}">${m.seenAt ? 'Seen' : 'Unseen'}</span>`;
    const grouped = prev && prev.senderId === m.senderId && new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60 * 1000;
    const ageMs = Date.now() - new Date(m.createdAt).getTime();
    const canEdit = mine && !m.deletedAt && !m.pending && ageMs <= 15 * 60 * 1000;

    let contentHtml = "";
    if (m.deletedAt) {
      contentHtml = '<em>Message deleted</em>';
    } else if (m.sharedReel) {
      contentHtml = `<div class="shared-reel-card" data-open-shared-reel="${esc(m.sharedReel.id)}">
        <div class="reel-card-thumb">
          <img src="${esc(m.sharedReel.thumbnail || '/icon.svg')}" alt="" loading="lazy">
          <div class="reel-card-play">${icon("play")}</div>
        </div>
        <div class="reel-card-body">
          <strong>${esc(m.sharedReel.caption || 'Shared reel')}</strong>
          <small>@${esc(m.sharedReel.creatorUsername || 'creator')}</small>
        </div>
      </div>${m.text && m.text !== 'Shared a reel' ? `<span class="msg-text-span">${esc(m.text)}</span>` : ''}`;
    } else if (m.attachment) {
      contentHtml = `<a href="${esc(m.attachment.url)}?download=1" target="_blank" rel="noopener noreferrer" class="attachment-link">${icon("upload")} ${esc(m.attachment.name)} · ${(m.attachment.size/1048576).toFixed(1)} MB</a>`;
    } else {
      contentHtml = `<span class="msg-text-span">${esc(m.text)}</span>`;
    }

    const senderHeader = (inGroup && !mine && !grouped) ? `<div class="msg-sender">${esc(m.senderDisplayName || m.senderUsername || "Member")}${m.isVerified ? VERIFIED : ""}</div>` : "";
    const editedHtml = m.isEdited ? `<span class="msg-edited-tag">Edited • ${clock(m.editedAt || m.createdAt)}</span>` : "";

    return `${senderHeader}<div data-message-id="${esc(m.id)}" class="msg ${mine ? "mine" : "theirs"} ${grouped ? "grouped" : ""} ${m.pending ? "pending" : ""} ${isEmojiOnly(m.text) ? "big-emoji" : ""}">
      ${contentHtml}
      <time>${m.pending ? "Sending…" : clock(m.createdAt)}${editedHtml}${mine && !m.pending && !m.deletedAt ? ` · ${receipt}` : ""}</time>
      <div class="msg-actions">
        ${canEdit ? `<button type="button" class="msg-action-btn" data-edit-message="${esc(m.id)}" title="Edit">${icon("edit")}</button>` : ""}
        ${mine && !m.pending && !m.deletedAt ? `<button type="button" class="msg-action-btn" data-delete-message="${esc(m.id)}" title="Delete">${icon("trash")}</button>` : ""}
      </div>
    </div>`;
  }

  function renderMessages(scroll = true) {
    const list = $("#msgList");
    if (!state.messages.length) {
      const p = state.activePartner;
      if (state.activeGroup) { list.innerHTML = `<div class="empty">${groupAvatar(state.activeGroup, "lg")}<h3>${esc(state.activeGroup.name)}</h3><p class="muted">Say hi to the group.</p></div>`; return; }
      list.innerHTML = `<div class="empty">${avatar(p, "lg")}<h3>${esc(p?.displayName || "")}</h3><p class="muted">Say hi to start your conversation.</p></div>`;
      return;
    }
    let html = "", lastDay = "", prev = null;
    state.messages.forEach((m) => {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) { html += `<div class="day-sep">${dayLabel(m.createdAt)}</div>`; lastDay = day; prev = null; }
      html += messageItemHTML(m, prev);
      prev = m;
    });
    list.innerHTML = html;
    if (scroll) { const s = $("#msgStream"); s.scrollTop = s.scrollHeight; }
  }

  const composer = $("#composerInput");
  composer.addEventListener("input", () => {
    $("#sendBtn").disabled = !composer.value.trim();
    if (!state.activeConvoId || !state.socket) return;
    if (!composer._typing) { composer._typing = true; state.socket.emit("typing:start", { conversationId: state.activeConvoId }); }
    stopTypingSoon();
  });
  const stopTypingSoon = debounce(() => {
    if (composer._typing && state.socket && state.activeConvoId) state.socket.emit("typing:stop", { conversationId: state.activeConvoId });
    composer._typing = false;
  }, 1500);

  $("#composer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = composer.value.trim();
    const convoId = state.activeConvoId;
    if (!text || !convoId) return;
    composer.value = ""; $("#sendBtn").disabled = true;
    $("#emojiPicker").classList.add("hidden");
    if (composer._typing) { state.socket?.emit("typing:stop", { conversationId: convoId }); composer._typing = false; }
    const temp = { id: "tmp-" + Date.now(), pending: true, senderId: state.me.id, text, createdAt: new Date().toISOString(), conversationId: convoId };
    state.messages.push(temp);
    
    // Append single message element
    const list = $("#msgList");
    const stream = $("#msgStream");
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = messageItemHTML(temp, state.messages[state.messages.length - 2]);
    while (tempDiv.firstChild) list.appendChild(tempDiv.firstChild);
    stream.scrollTop = stream.scrollHeight;

    const finish = (msg) => {
      if (state.activeConvoId !== convoId) return;
      const i = state.messages.findIndex((x) => x.id === temp.id);
      if (i !== -1) state.messages[i] = msg;
      else state.messages.push(msg);
      messageCache.set(convoId, state.messages.slice(-50));
      
      const oldEl = $(`[data-message-id="${temp.id}"]`);
      if (oldEl) oldEl.outerHTML = messageItemHTML(msg);
      
      const c = state.conversations.find((x) => x.id === convoId);
      if (c) { c.lastMessage = msg.text; c.lastMessageFromMe = true; c.lastAt = msg.createdAt; state.conversations.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt)); renderConversations(); }
    };
    const rejected = (err) => {
      state.messages = state.messages.filter((x) => x.id !== temp.id);
      $(`[data-message-id="${temp.id}"]`)?.remove();
      composer.value = text; $("#sendBtn").disabled = false;
      toast(err.error || err.message || "Message not sent", "error");
      if (err.code === "RATE_LIMITED") loadMyRestrictions();
    };
    const viaRest = async () => {
      try { const data = await api(`/api/conversations/${convoId}/messages`, { method: "POST", body: { text } }); finish(data.message); }
      catch (err) { rejected(err); }
    };
    if (state.socket && state.socket.connected) {
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; viaRest(); } }, 5000);
      state.socket.emit("message:send", { conversationId: convoId, text }, (res) => {
        if (settled) return; settled = true; clearTimeout(timer);
        if (res && res.message) finish(res.message);
        else if (res && res.code === "RATE_LIMITED") rejected(res);
        else viaRest();
      });
    } else viaRest();
  });

  let typingTimer;
  function showTyping() { $("#typingRow").classList.remove("hidden"); const s = $("#msgStream"); s.scrollTop = s.scrollHeight; clearTimeout(typingTimer); typingTimer = setTimeout(hideTyping, 4000); }
  function hideTyping() { $("#typingRow").classList.add("hidden"); }

  // emoji picker
  const EMOJI = "😀 😂 🥹 😊 😍 🥰 😘 😎 🤩 🥳 😅 😭 😤 🤯 🤔 🙃 😴 🤝 👍 👎 👏 🙌 🙏 💪 👀 ❤️ 🧡 💛 💚 💙 🔥 ✨ 🎉 💯 🚀 🎬 🎵 📸".split(" ");
  $("#emojiPicker").innerHTML = EMOJI.map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join("");
  $("#emojiBtn").addEventListener("click", (e) => { e.stopPropagation(); $("#emojiPicker").classList.toggle("hidden"); });
  $("#emojiPicker").addEventListener("click", (e) => {
    const b = e.target.closest("[data-emoji]"); if (!b) return;
    const s = composer.selectionStart ?? composer.value.length;
    composer.value = composer.value.slice(0, s) + b.dataset.emoji + composer.value.slice(composer.selectionEnd ?? s);
    composer.focus(); composer.setSelectionRange(s + b.dataset.emoji.length, s + b.dataset.emoji.length);
    $("#sendBtn").disabled = false;
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".emoji-wrap")) $("#emojiPicker").classList.add("hidden"); });

  // new chat picker
  async function openPicker() {
    openModal("pickerModal");
    $("#pickerSearch").value = "";
    $("#pickerList").innerHTML = `<div class="feed-state"><div class="spinner"></div></div>`;
    try {
      const data = await api("/api/friends");
      state.friends = data.friends || [];
      renderPicker(state.friends, true);
    } catch (err) { $("#pickerList").innerHTML = `<p class="muted">${err.silent ? "" : esc(err.message)}</p>`; }
  }
  function renderPicker(users, isFriends) {
    if (!users.length) {
      $("#pickerList").innerHTML = isFriends
        ? `<p class="muted" style="padding:16px;text-align:center">You don't have friends yet. Search anyone above, or find people on the People page.</p>`
        : `<p class="muted" style="padding:16px;text-align:center">Nobody found.</p>`;
      return;
    }
    $("#pickerList").innerHTML = (isFriends ? `<p class="section-label" style="margin:4px 10px 6px">Friends</p>` : "") + users.map((u) => `
      <button type="button" class="pick-row" data-start-chat="${esc(u.id)}">
        ${avatar(u, "md", u.isOnline)}
        <span class="person-text"><strong>${esc(u.displayName)}${verified(u)}</strong><small>@${esc(u.username)}</small></span>
      </button>`).join("");
  }
  $("#pickerSearch").addEventListener("input", debounce(async (e) => {
    const q = e.target.value.trim();
    if (!q) return renderPicker(state.friends, true);
    try { const data = await api("/api/users/search?q=" + encodeURIComponent(q)); renderPicker(data.users, false); } catch (_) {}
  }, 250));
  $("#pickerList").addEventListener("click", (e) => { const b = e.target.closest("[data-start-chat]"); if (b) { closeModal("pickerModal"); startChat(b.dataset.startChat); } });

  async function startChat(userId) {
    try {
      const data = await api("/api/conversations", { method: "POST", body: { userId } });
      $$(".modal:not(.hidden)").forEach((m) => closeModal(m));
      await loadConversations(true);
      go("messages/" + data.conversation.id);
    } catch (err) { (err.silent || toast(err.message, "error")); }
  }

  /* =========================================================
     PEOPLE
     ========================================================= */
  $$("[data-people-tab]").forEach((t) => t.addEventListener("click", () => {
    state.peopleTab = t.dataset.peopleTab;
    $$("[data-people-tab]").forEach((x) => x.classList.toggle("active", x === t));
    $("#peopleSearch").value = "";
    renderPeople();
  }));
  $("#peopleSearch").addEventListener("input", debounce(async (e) => {
    const q = e.target.value.trim();
    if (!q) return renderPeople();
    try {
      const data = await api("/api/users/search?q=" + encodeURIComponent(q));
      $("#peopleBody").innerHTML = `<section><p class="section-label">Results for “${esc(q)}”</p>${data.users.length ? `<div class="people-grid">${data.users.map(personCard).join("")}</div>` : `<div class="empty"><h3>No one found</h3><p class="muted">Try a different name or username.</p></div>`}</section>`;
    } catch (err) { (err.silent || toast(err.message, "error")); }
  }, 250));

  let discover = [];
  async function loadPeople() {
    $("#peopleBody").innerHTML = `<div class="people-grid">${Array.from({ length: 6 }, () => `<div class="skeleton" style="height:150px"></div>`).join("")}</div>`;
    try {
      const [f, r, d] = await Promise.all([api("/api/friends"), api("/api/friends/requests"), api("/api/recommendations")]);
      state.friends = f.friends || [];
      state.requests = r;
      discover = d.users || [];
      $("#friendsCount").textContent = state.friends.length;
      setBadge("requests", r.incoming.length);
      if ($("#peopleSearch").value.trim()) $("#peopleSearch").dispatchEvent(new Event("input"));
      else renderPeople();
    } catch (err) { $("#peopleBody").innerHTML = `<p class="muted">${err.silent ? "" : esc(err.message)}</p>`; }
  }

  function requestIdFor(userId, dir) {
    const list = dir === "in" ? state.requests.incoming : state.requests.outgoing;
    return list.find((x) => x.user && x.user.id === userId)?.id;
  }

  function personActions(u, status) {
    const id = esc(u.id);
    if (status === "friend") return `<button type="button" class="btn btn-primary sm" data-act="message" data-id="${id}">${icon("message")} Message</button><button type="button" class="btn btn-soft sm" data-act="unfriend" data-id="${id}" aria-label="Remove friend">${icon("user-minus")}</button>`;
    if (status === "pending_incoming") return `<button type="button" class="btn btn-primary sm" data-act="accept" data-id="${id}">${icon("check")} Accept</button><button type="button" class="btn btn-soft sm" data-act="decline" data-id="${id}">Decline</button>`;
    if (status === "pending_outgoing") return `<button type="button" class="btn btn-soft sm" data-act="cancel" data-id="${id}">${icon("clock")} Requested</button>`;
    if (status === "self") return "";
    return `<button type="button" class="btn btn-primary sm" data-act="add" data-id="${id}">${icon("user-plus")} Add friend</button><button type="button" class="btn btn-soft sm ${u.isSubscribed ? "on" : ""}" data-subscribe="${id}">${icon("star")} ${u.isSubscribed ? "Subscribed" : "Subscribe"}</button>`;
  }
  function personCard(u, statusOverride) {
    const status = typeof statusOverride === "string" ? statusOverride : u.friendshipStatus || (state.friends.some((f) => f.id === u.id) ? "friend" : "none");
    return `<article class="person" data-person="${esc(u.id)}">
      <button type="button" class="person-head" data-open-user="${esc(u.id)}">
        ${avatar(u, "md", u.isOnline)}
        <span class="person-text"><strong>${esc(u.displayName)}${verified(u)}</strong><small>@${esc(u.username)} · <span data-subs-count="${esc(u.id)}">${fmtCount(u.subscribersCount)}</span> subscribers</small></span>
      </button>
      ${u.bio ? `<p class="person-bio">${esc(u.bio)}</p>` : ""}
      <div class="person-actions">${personActions(u, status)}</div>
    </article>`;
  }

  function renderPeople() {
    const body = $("#peopleBody");
    if (state.peopleTab === "friends") {
      body.innerHTML = state.friends.length
        ? `<div class="people-grid">${state.friends.map((u) => personCard(u, "friend")).join("")}</div>`
        : `<div class="empty"><div class="empty-icon">${icon("users")}</div><h3>No friends yet</h3><p class="muted">Find people you know in Discover or search above.</p><button type="button" class="btn btn-primary" data-goto-tab="discover">Discover people</button></div>`;
    } else if (state.peopleTab === "requests") {
      const inc = state.requests.incoming, out = state.requests.outgoing;
      body.innerHTML = `
        <section><p class="section-label">Received · ${inc.length}</p>${inc.length ? `<div class="people-grid">${inc.map((r) => personCard(r.user, "pending_incoming")).join("")}</div>` : `<p class="muted">No requests right now.</p>`}</section>
        <section><p class="section-label">Sent · ${out.length}</p>${out.length ? `<div class="people-grid">${out.map((r) => personCard(r.user, "pending_outgoing")).join("")}</div>` : `<p class="muted">You haven't sent any requests.</p>`}</section>`;
    } else {
      body.innerHTML = discover.length
        ? `<div class="people-grid">${discover.map((u) => personCard(u)).join("")}</div>`
        : `<div class="empty"><div class="empty-icon">${icon("compass")}</div><h3>You're friends with everyone</h3><p class="muted">Invite more people to NoChat to grow your circle.</p></div>`;
    }
  }

  async function personAction(act, userId, btn) {
    btn && (btn.disabled = true);
    try {
      if (["accept", "decline", "cancel"].includes(act) && !requestIdFor(userId, act === "cancel" ? "out" : "in")) {
        state.requests = await api("/api/friends/requests");
      }
      if (act === "add") { const d = await api("/api/friends/request", { method: "POST", body: { userId } }); toast(d.message || "Request sent", "success"); }
      else if (act === "accept") { await api(`/api/friends/accept/${requestIdFor(userId, "in")}`, { method: "POST" }); toast("Friend added", "success"); }
      else if (act === "decline") { await api(`/api/friends/reject/${requestIdFor(userId, "in")}`, { method: "POST" }); toast("Request declined"); }
      else if (act === "cancel") {
        if (!(await confirmDialog("Cancel request?", "They won't be notified.", "Cancel request"))) { btn && (btn.disabled = false); return; }
        await api(`/api/friends/reject/${requestIdFor(userId, "out")}`, { method: "POST" }); toast("Request cancelled");
      }
      else if (act === "unfriend") {
        if (!(await confirmDialog("Remove friend?", "You can always add them again later.", "Remove"))) { btn && (btn.disabled = false); return; }
        await api(`/api/friends/${userId}`, { method: "DELETE" }); toast("Friend removed");
      }
      else if (act === "message") { return startChat(userId); }
      await loadPeople(); refreshMe();
      if (!$("#userModal").classList.contains("hidden")) openUser(userId);
    } catch (err) { (err.silent || toast(err.message, "error")); btn && (btn.disabled = false); }
  }

  document.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]");
    if (act && (act.closest("#peopleBody") || act.closest("#userModalBody"))) { personAction(act.dataset.act, act.dataset.id, act); return; }
    const sub = e.target.closest("[data-subscribe]");
    if (sub && (sub.closest("#peopleBody") || sub.closest("#userModalBody"))) { toggleSubscribe(sub.dataset.subscribe); return; }
    const ou = e.target.closest("[data-open-user]");
    if (ou && ou.closest("#peopleBody")) { openUser(ou.dataset.openUser); return; }
    const gt = e.target.closest("[data-goto-tab]");
    if (gt) $(`[data-people-tab="${gt.dataset.gotoTab}"]`).click();
  });

  /* =========================================================
     USER PROFILE MODAL
     ========================================================= */
  function tileHTML(r) {
    reelCache.set(r.id, r);
    return `<button type="button" class="tile" data-tile="${esc(r.id)}" aria-label="Open reel">
      <video src="${esc(r.videoUrl)}#t=0.1" muted playsinline preload="metadata"></video>
      <span class="tile-meta">${icon("heart")} ${fmtCount(r.likesCount)}</span>
      ${r.moderationStatus && r.moderationStatus !== "approved" && state.me && r.userId === state.me.id ? `<span class="tile-flag ${esc(r.moderationStatus)}">${r.moderationStatus === "blocked" ? "Removed" : "In review"}</span><span class="tile-appeal" role="button" tabindex="0" data-appeal-reel="${esc(r.id)}">Appeal</span>` : ""}
    </button>`;
  }
  async function openUser(userId) {
    if (!userId) return;
    if (userId === state.me.id) { $$(".modal:not(.hidden)").forEach((m) => closeModal(m)); go("profile"); return; }
    const body = $("#userModalBody");
    if ($("#userModal").classList.contains("hidden")) {
      body.innerHTML = `<div class="feed-state" style="height:300px"><div class="spinner"></div></div>`;
      openModal("userModal");
    }
    try {
      const d = await api(`/api/users/profile/${userId}`);
      const u = d.user;
      body.innerHTML = `
        <div class="profile-hero">
          <div class="profile-cover"></div>
          <div class="profile-main">
            <div class="profile-avatar-btn">${avatar(u, "xl", d.isOnline)}</div>
            <div class="profile-id">
              <h2 class="profile-name">${esc(u.displayName)}${verified(u)}</h2>
              <p class="muted">@${esc(u.username)}${u.isVerified ? " · " + esc(u.role === "Member" ? "Verified" : u.role) : ""}${d.isOnline ? ' · <span style="color:var(--online)">Online</span>' : ""}</p>
              ${u.bio ? `<p class="profile-bio">${esc(u.bio)}</p>` : ""}
            </div>
            <div class="profile-cta person-actions">
              ${personActions(u, d.friendshipStatus)}
              ${d.friendshipStatus !== "friend" && d.friendshipStatus !== "none" ? `<button type="button" class="btn btn-soft sm" data-act="message" data-id="${esc(u.id)}">${icon("message")} Message</button>` : ""}
              ${d.friendshipStatus === "friend" ? `<button type="button" class="btn btn-soft sm ${u.isSubscribed ? "on" : ""}" data-subscribe="${esc(u.id)}">${icon("star")} ${u.isSubscribed ? "Subscribed" : "Subscribe"}</button>` : ""}
              ${d.friendshipStatus === "none" ? `<button type="button" class="btn btn-soft sm" data-act="message" data-id="${esc(u.id)}">${icon("message")} Message</button>` : ""}
            </div>
          </div>
          <div class="stats">
            <div class="stat"><strong>${fmtCount(d.stats.reelsCount)}</strong><span>Reels</span></div>
            <div class="stat"><strong>${fmtCount(d.stats.friendsCount)}</strong><span>Friends</span></div>
            <div class="stat"><strong data-subs-count="${esc(u.id)}">${fmtCount(d.stats.subscribersCount)}</strong><span>Subscribers</span></div>
          </div>
        </div>
        ${d.reels.length ? `<div class="reel-grid">${d.reels.map(tileHTML).join("")}</div>` : `<div class="empty"><div class="empty-icon">${icon("film")}</div><h3>No reels yet</h3><p class="muted">${esc(u.displayName)} hasn't posted anything.</p></div>`}`;
    } catch (err) { body.innerHTML = `<div class="empty"><h3>Couldn't load profile</h3><p class="muted">${err.silent ? "" : esc(err.message)}</p></div>`; }
  }
  $("#userModalBody").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tile]");
    if (t) openViewer(reelCache.get(t.dataset.tile));
  });

  /* =========================================================
     MY PROFILE
     ========================================================= */
  $$("[data-profile-tab]").forEach((t) => t.addEventListener("click", () => setProfileTab(t.dataset.profileTab)));
  $$("[data-profile-tab-jump]").forEach((b) => b.addEventListener("click", () => { setProfileTab(b.dataset.profileTabJump); $("#editDisplayName").focus(); }));
  function setProfileTab(tab) {
    $$("[data-profile-tab]").forEach((x) => x.classList.toggle("active", x.dataset.profileTab === tab));
    $("#profileReels").classList.toggle("hidden", tab !== "reels");
    $("#profileSettings").classList.toggle("hidden", tab !== "settings");
  }

  async function loadMyReels() {
    const grid = $("#meReelGrid");
    if (!grid.children.length) grid.innerHTML = Array.from({ length: 3 }, () => `<div class="tile skeleton"></div>`).join("");
    try {
      const d = await api(`/api/users/profile/${state.me.id}`);
      state.stats.reelsCount = d.stats.reelsCount; state.stats.friendsCount = d.stats.friendsCount;
      state.me.subscribersCount = d.stats.subscribersCount;
      renderMe();
      grid.innerHTML = d.reels.length ? d.reels.map(tileHTML).join("")
        : `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">${icon("film")}</div><h3>Share your first reel</h3><p class="muted">Your reels will show up here.</p><button type="button" class="btn btn-primary" data-action="open-upload">${icon("plus")} Upload a reel</button></div>`;
    } catch (err) { grid.innerHTML = `<p class="muted">${err.silent ? "" : esc(err.message)}</p>`; }
  }
  $("#meReelGrid").addEventListener("click", (e) => {
    const ap = e.target.closest("[data-appeal-reel]");
    if (ap) { e.stopPropagation(); return openAppeal({ type: "reel", id: ap.dataset.appealReel, text: "Explain why this reel follows NoChat's policies. An administrator will review the original video." }); }
    const t = e.target.closest("[data-tile]"); if (t) openViewer(reelCache.get(t.dataset.tile));
  });

  $("#editBio").addEventListener("input", (e) => ($("#bioCount").textContent = e.target.value.length));
  $("#editProfileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter || $("#editProfileForm button[type=submit]");
    const displayName = $("#editDisplayName").value.trim();
    if (displayName.length < 2) return toast("Display name needs at least 2 characters.", "error");
    await withBusy(btn, "Saving…", async () => {
      try {
        const d = await api("/api/profile", { method: "PUT", body: { displayName, bio: $("#editBio").value, soundEnabled: $("#editSound").checked, readReceiptsEnabled: $("#editReadReceipts").checked } });
        state.me = { ...state.me, ...d.user }; renderMe();
        toast("Profile saved", "success");
      } catch (err) { (err.silent || toast(err.message, "error")); }
    });
  });

  $("#passwordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#passwordForm button[type=submit]");
    const newPassword = $("#newPassword").value;
    if (newPassword.length < 6) return toast("New password needs at least 6 characters.", "error");
    await withBusy(btn, "Updating…", async () => {
      try {
        await api("/api/account/password", { method: "PUT", body: { currentPassword: $("#currentPassword").value, newPassword } });
        $("#currentPassword").value = ""; $("#newPassword").value = "";
        state.me.hasPassword = true; renderMe();
        toast("Password updated", "success");
      } catch (err) { (err.silent || toast(err.message, "error")); }
    });
  });

  $("#voiceCallBtn").addEventListener('click',()=>{if(state.activeConvoId&&state.activePartner)state.calls?.start(state.activeConvoId,state.activePartner.displayName,false);});
  $("#videoCallBtn").addEventListener('click',()=>{if(state.activeConvoId&&state.activePartner)state.calls?.start(state.activeConvoId,state.activePartner.displayName,true);});
  $("#markUnreadBtn").addEventListener('click',async()=>{if(!state.activeConvoId)return;try{await api(`/api/conversations/${state.activeConvoId}/unread`,{method:'POST'});go('messages');toast('Marked unread');}catch(e){toast(e.message,'error');}});
  $("#msgList").addEventListener('click',async e=>{const b=e.target.closest('[data-delete-message]');if(!b||!state.activeConvoId)return;if(!await confirmDialog('Delete this message?','It will be removed for both people.','Delete'))return;try{await api(`/api/conversations/${state.activeConvoId}/messages/${b.dataset.deleteMessage}`,{method:'DELETE'});const m=state.messages.find(m=>m.id===b.dataset.deleteMessage);if(m){m.deletedAt=new Date().toISOString();m.text='';m.attachment=null;}renderMessages(false);}catch(e){toast(e.message,'error');}});
  $("#attachmentBtn").onclick=()=>$("#attachmentInput").click();
  $("#attachmentInput").onchange=()=>{
    const file=$("#attachmentInput").files[0];const id=state.activeConvoId;if(!file||!id)return;if(file.size>20*1024*1024)return toast('File is over 20 MB.','error');
    const form=new FormData();form.append('file',file);const xhr=new XMLHttpRequest();xhr.open('POST',`/api/conversations/${id}/attachments`);xhr.withCredentials=true;
    const progress=$("#attachmentProgress");progress.classList.remove('hidden');$("#attachmentBtn").disabled=true;
    const done=()=>{progress.classList.add('hidden');$("#attachmentBtn").disabled=false;$("#attachmentInput").value='';};
    xhr.upload.onprogress=e=>{if(e.lengthComputable)progress.value=e.loaded/e.total*100;};
    xhr.onload=()=>{done();let data={};try{data=JSON.parse(xhr.responseText);}catch{}if(xhr.status>=200&&xhr.status<300){if(id===state.activeConvoId&&!state.messages.some(m=>m.id===data.message.id)){state.messages.push(data.message);renderMessages();}}else toast(data.error||'Upload failed','error');};
    xhr.onerror=()=>{done();toast('Upload connection failed','error');};xhr.send(form);
  };
  $("#adminReviewBtn").onclick=async()=>{openModal('reviewModal');$("#reviewList").textContent='Loading…';try{const data=await api('/api/admin/review');$("#reviewList").innerHTML=data.reels.length?data.reels.map(r=>`<article class="review-item" data-review="${esc(r.id)}"><video src="${esc(r.videoUrl)}" controls playsinline preload="metadata"></video><strong>${esc(r.user?.displayName)}</strong><p>${esc(r.caption)}</p><p class="muted">${esc(r.moderationStatus||'reported')}: ${esc(r.moderationReason||'User report')}</p>${r.reports.map(x=>`<p>${esc(x.reason)}</p>`).join('')}<div class="row-actions"><button type="button" class="btn btn-primary" data-decision="approved">Approve</button><button type="button" class="btn btn-soft" data-decision="blocked">Keep hidden</button><button type="button" class="btn btn-danger" data-admin-delete>Delete permanently</button></div></article>`).join(''):'No reels need review.';}catch(e){$("#reviewList").textContent=e.message;}};
  $("#reviewList").onclick=async e=>{const item=e.target.closest('[data-review]');if(!item)return;try{if(e.target.closest('[data-admin-delete]')){if(!await confirmDialog('Delete permanently?','This cannot be undone.','Delete'))return;await api(`/api/reels/${item.dataset.review}`,{method:'DELETE'});}else{const b=e.target.closest('[data-decision]');if(!b)return;await api(`/api/admin/reels/${item.dataset.review}/review`,{method:'POST',body:{status:b.dataset.decision}});}item.remove();toast('Review saved','success');loadFeed();}catch(e){toast(e.message,'error');}};

  /* ---------------- appeals ---------------- */
  let appealTarget = null;
  function openAppeal(target) {
    appealTarget = target; $("#appealReason").value = ""; $("#appealError").classList.add("hidden");
    $("#appealText").textContent = target.text || "Tell us why this decision should be reviewed.";
    openModal("appealModal");
  }
  $("#appealForm").addEventListener("submit", async (e) => {
    e.preventDefault(); if (!appealTarget) return;
    const reason = $("#appealReason").value.trim();
    if (reason.length < 10) return showFormError("#appealError", "Please write at least 10 characters.");
    try {
      const d = appealTarget.type === "account"
        ? await api("/api/auth/appeal", { method: "POST", body: { identifier: $("#loginIdentifier").value.trim(), password: $("#loginPassword").value, reason } })
        : await api("/api/appeals", { method: "POST", body: { targetType: appealTarget.type, targetId: appealTarget.id, reason } });
      closeModal("appealModal"); toast(d.message || "Appeal submitted", "success"); loadMyRestrictions();
    } catch (err) { showFormError("#appealError", err.message); }
  });
  $("#spamAppealBtn").addEventListener("click", () => openAppeal({ type: "spam", text: "Explain why the messaging pause was a mistake." }));
  async function loadMyRestrictions() {
    if (!state.me) return;
    const muted = state.me.mutedUntil && new Date(state.me.mutedUntil) > new Date();
    try {
      const d = await api("/api/appeals/mine");
      const open = d.appeals.filter((a) => a.status === "open");
      $("#myRestrictions").textContent = open.length ? `You have ${open.length} appeal${open.length > 1 ? "s" : ""} waiting for review.` : (muted ? "Messaging is paused for a short time because of anti-spam protection." : "");
      $("#spamAppealBtn").classList.toggle("hidden", !(state.me.spamStrikes > 0 || muted) || open.some((a) => a.targetType === "spam"));
    } catch (_) { /* optional */ }
  }

  /* ---------------- admin console (server verifies every action) ---------------- */
  const fmtDate = (d) => d ? new Date(d).toLocaleString() : "—";
  const statusPill = (u) => `<span class="status-pill ${esc(u.restricted ? u.status : "active")}">${esc(u.restricted ? u.status : (u.status === "suspended" ? "active (suspension ended)" : "active"))}</span>`;
  const adminUsers = new Map();
  function adminUserCard(u) {
    adminUsers.set(u.id, u);
    const act = (a, label, cls = "btn-soft") => `<button type="button" class="btn ${cls} sm" data-admin-action="${a}" data-user="${esc(u.id)}">${label}</button>`;
    const actions = u.protected ? `<p class="muted small">${icon("shield")} Founder account — protected from admin actions.</p>` : `<div class="row-actions wrap">
        ${u.restricted ? act("restore", "Restore", "btn-primary") : act("suspend", "Suspend") + act("ban", "Ban", "btn-danger")}
        ${u.status !== "deleted" ? act("delete", "Delete", "btn-danger") : ""}
        ${act("revoke-sessions", "Sign out everywhere")}
        ${u.verifiedBadge ? act("unverify", "Remove badge") : act("verify", "Give verified badge")}
        ${u.spamStrikes || u.mutedUntil ? act("clear-spam", "Clear spam limits") : ""}
      </div>`;
    return `<article class="admin-user">
      <div class="admin-user-head">${avatar(u, "md")}<div><strong>${esc(u.displayName)} ${u.verifiedBadge ? VERIFIED : ""}</strong><p class="muted small">@${esc(u.username)} · ${statusPill(u)} ${u.isOnline ? '· <span class="online-text">online</span>' : ""}</p></div></div>
      <dl class="admin-meta">
        <div><dt>User ID</dt><dd><code>${esc(u.id)}</code></dd></div>
        <div><dt>Email</dt><dd>${esc(u.email || "—")}</dd></div>
        <div><dt>Joined</dt><dd>${fmtDate(u.createdAt)}</dd></div>
        <div><dt>Reels · Messages</dt><dd>${u.reelsCount} · ${u.messagesCount}</dd></div>
        <div><dt>Spam strikes (24h)</dt><dd>${u.spamStrikes}${u.mutedUntil && new Date(u.mutedUntil) > new Date() ? " · paused until " + fmtDate(u.mutedUntil) : ""}</dd></div>
        ${u.statusReason ? `<div><dt>Reason</dt><dd>${esc(u.statusReason)}${u.statusUntil ? " · until " + fmtDate(u.statusUntil) : ""}</dd></div>` : ""}
        ${u.openAppeals ? `<div><dt>Open appeals</dt><dd>${u.openAppeals}</dd></div>` : ""}
      </dl>${actions}</article>`;
  }
  async function adminSearch() {
    const box = $("#adminUsers"); box.innerHTML = `<p class="muted">Loading…</p>`;
    try {
      const q = encodeURIComponent($("#adminSearch").value.trim()), st = encodeURIComponent($("#adminStatus").value);
      const d = await api(`/api/admin/users?q=${q}&status=${st}`);
      box.innerHTML = d.users.length ? `<p class="muted small">${d.total} account${d.total === 1 ? "" : "s"} found${d.total > d.users.length ? " · showing first " + d.users.length : ""}</p>` + d.users.map(adminUserCard).join("") : `<p class="muted">No accounts match.</p>`;
    } catch (err) { box.innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
  }
  const logRow = (l) => {
    const who = l.username || l.targetUsername || l.userId || "";
    const what = l.kind === "audit" ? `${esc(l.actorUsername || "")} → ${esc(l.action)} @${esc(l.targetUsername || "?")} <span class="status-pill ${l.outcome === "denied" ? "banned" : "active"}">${esc(l.outcome)}</span>`
      : l.kind === "spam" ? `@${esc(who)} · ${esc(l.reason)} on ${esc(l.channel)} · strike ${esc(l.strike)} · paused ${Math.round((l.cooldownMs || 0) / 1000)}s`
      : `Reel ${esc((l.reelRef || "").slice(0, 8))} · <b>${esc(l.decision)}</b> · ${esc(l.source)}${l.confidence != null ? " · confidence " + Number(l.confidence).toFixed(2) : ""}`;
    return `<div class="log-row"><span class="muted small">${fmtDate(l.createdAt)}</span><span>${what}</span>${l.reason && l.kind !== "spam" ? `<span class="muted small">${esc(l.reason)}</span>` : ""}</div>`;
  };
  async function adminLoad(tab) {
    if (tab === "users") return adminSearch();
    if (tab === "appeals") {
      const box = $("#adminAppeals"); box.innerHTML = `<p class="muted">Loading…</p>`;
      try {
        const d = await api("/api/admin/appeals");
        box.innerHTML = d.appeals.length ? d.appeals.map((a) => `<article class="admin-user" data-appeal="${esc(a.id)}"><strong>${esc(a.user?.displayName || "Unknown")} <span class="muted small">@${esc(a.user?.username || "")}</span></strong>
          <p class="muted small">${esc({ account: "Account restriction", spam: "Messaging pause", reel: "Reel moderation" }[a.targetType] || a.targetType)} · ${fmtDate(a.createdAt)}</p><p>${esc(a.reason)}</p>
          <div class="row-actions"><button type="button" class="btn btn-primary sm" data-appeal-decision="accepted">Accept &amp; restore</button><button type="button" class="btn btn-soft sm" data-appeal-decision="rejected">Reject</button></div></article>`).join("") : `<p class="muted">No open appeals.</p>`;
      } catch (err) { box.innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
      return;
    }
    const box = $("#admin" + tab.charAt(0).toUpperCase() + tab.slice(1)); box.innerHTML = `<p class="muted">Loading…</p>`;
    try { const d = await api(`/api/admin/logs?kind=${tab}`); box.innerHTML = d.logs.length ? d.logs.map(logRow).join("") : `<p class="muted">Nothing logged yet.</p>`; }
    catch (err) { box.innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
  }
  $("#adminConsoleBtn").addEventListener("click", () => { openModal("adminModal"); adminLoad("users"); });
  $$("[data-admin-tab]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-admin-tab]").forEach((x) => x.classList.toggle("active", x === b));
    $$("[data-admin-pane]").forEach((p) => p.classList.toggle("hidden", p.dataset.adminPane !== b.dataset.adminTab));
    adminLoad(b.dataset.adminTab);
  }));
  $("#adminSearchForm").addEventListener("submit", (e) => { e.preventDefault(); adminSearch(); });
  const ACTION_TEXT = {
    suspend: ["Suspend account?", "They are signed out everywhere and cannot sign in until the suspension ends. Nothing is deleted."],
    ban: ["Ban account?", "They are signed out everywhere and hidden from search. Nothing is deleted; you can restore later."],
    delete: ["Delete account?", "The account is closed and hidden. All records are kept so it can be restored if this was a mistake."],
    "revoke-sessions": ["Sign out everywhere?", "Every device signed in to this account is signed out immediately."],
    restore: ["Restore account?", "The account becomes active again."],
    verify: ["Give verified badge?", "Shows a verified tick on this profile. It does not give any extra permissions."],
    unverify: ["Remove verified badge?", "The verified tick is removed from this profile."],
    "clear-spam": ["Clear spam limits?", "Removes strikes and any messaging pause."]
  };
  const DESTRUCTIVE = ["suspend", "ban", "delete", "revoke-sessions"], NEEDS_REASON = ["suspend", "ban", "delete"];
  let pendingAdmin = null;
  $("#adminUsers").addEventListener("click", (e) => {
    const b = e.target.closest("[data-admin-action]"); if (!b) return;
    const u = adminUsers.get(b.dataset.user), a = b.dataset.adminAction; if (!u) return;
    pendingAdmin = { u, a };
    $("#adminActionTitle").textContent = ACTION_TEXT[a][0];
    $("#adminActionText").textContent = `@${u.username} — ${ACTION_TEXT[a][1]}`;
    $("#adminDurationField").classList.toggle("hidden", a !== "suspend");
    $("#adminReasonField").classList.toggle("hidden", !NEEDS_REASON.includes(a) && a !== "restore");
    $("#adminConfirmField").classList.toggle("hidden", !DESTRUCTIVE.includes(a));
    $("#adminConfirmName").textContent = u.username;
    $("#adminReason").value = ""; $("#adminConfirm").value = ""; $("#adminActionError").classList.add("hidden");
    $("#adminActionYes").className = "btn " + (DESTRUCTIVE.includes(a) ? "btn-danger" : "btn-primary");
    openModal("adminActionModal");
  });
  $("#adminActionForm").addEventListener("submit", async (e) => {
    e.preventDefault(); if (!pendingAdmin) return;
    const { u, a } = pendingAdmin;
    try {
      await api(`/api/admin/users/${encodeURIComponent(u.id)}/action`, { method: "POST", body: { action: a, reason: $("#adminReason").value.trim(), confirm: $("#adminConfirm").value.trim(), durationHours: Number($("#adminDuration").value) } });
      closeModal("adminActionModal"); toast("Done — saved to the audit log", "success"); adminSearch();
    } catch (err) { showFormError("#adminActionError", err.message); }
  });
  $("#adminAppeals").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-appeal-decision]"); if (!b) return;
    const item = b.closest("[data-appeal]");
    const accept = b.dataset.appealDecision === "accepted";
    if (!(await confirmDialog(accept ? "Accept this appeal?" : "Reject this appeal?", accept ? "The restriction or moderation decision will be lifted." : "The decision stays in place.", accept ? "Accept" : "Reject"))) return;
    try { await api(`/api/admin/appeals/${item.dataset.appeal}`, { method: "POST", body: { decision: b.dataset.appealDecision } }); item.remove(); toast("Appeal decided", "success"); }
    catch (err) { toast(err.message, "error"); }
  });

  /* ---------------- avatar ---------------- */
  let avatarFile = null, avatarUrl = null;
  function openAvatar() {
    avatarFile = null;
    $("#saveAvatarBtn").disabled = true;
    $("#avatarPreview").innerHTML = state.me.profilePicture ? `<img src="${esc(state.me.profilePicture)}" alt="">` : esc((state.me.displayName || "U").charAt(0).toUpperCase());
    openModal("avatarModal");
  }
  $("#pickAvatarBtn").addEventListener("click", () => $("#avatarInput").click());
  $("#avatarInput").addEventListener("change", () => {
    const f = $("#avatarInput").files[0]; if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) return toast("Use a JPG, PNG, WebP or GIF image.", "error");
    if (f.size > 10 * 1024 * 1024) return toast("That image is over 10 MB.", "error");
    avatarFile = f;
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    avatarUrl = URL.createObjectURL(f);
    $("#avatarPreview").innerHTML = `<img src="${avatarUrl}" alt="">`;
    $("#saveAvatarBtn").disabled = false;
  });
  $("#saveAvatarBtn").addEventListener("click", async () => {
    if (!avatarFile) return;
    const fd = new FormData(); fd.append("avatar", avatarFile);
    await withBusy($("#saveAvatarBtn"), "Saving…", async () => {
      try {
        const d = await api("/api/profile/avatar", { method: "POST", body: fd });
        state.me = { ...state.me, ...d.user }; renderMe();
        $("#avatarInput").value = "";
        closeModal("avatarModal");
        toast("Profile photo updated", "success");
      } catch (err) { (err.silent || toast(err.message, "error")); }
    });
    $("#saveAvatarBtn").disabled = true;
  });
  $("#removeAvatarBtn").addEventListener("click", async () => {
    if (!state.me.profilePicture) return toast("You don't have a photo yet.");
    if (!(await confirmDialog("Remove profile photo?", "Your initial will be shown instead.", "Remove"))) return;
    try {
      const d = await api("/api/profile/avatar", { method: "DELETE" });
      state.me = { ...state.me, ...d.user }; renderMe();
      toast("Photo removed", "success");
    } catch (err) { (err.silent || toast(err.message, "error")); }
  });

  /* =========================================================
     BOOT
     ========================================================= */
  ICONS.compass = '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>';
  hydrateIcons();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseAllReels();
    else if (currentView === "reels" && !state.viewerOpen) playVisibleReel();
    if (!document.hidden && state.activeConvoId && currentView === "messages" && state.me?.readReceiptsEnabled !== false) api(`/api/conversations/${state.activeConvoId}/read`, { method: "POST" }).catch(() => {});
  });

  // Wire Landing Modals & Banners
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-about]")) { e.preventDefault(); openModal("aboutModal"); }
    if (e.target.closest("[data-open-privacy]")) { e.preventDefault(); openModal("privacyModal"); }
    const reelCard = e.target.closest("[data-open-shared-reel]");
    if (reelCard) {
      e.preventDefault();
      const rid = reelCard.dataset.openSharedReel;
      if (rid) {
        go("reels");
        const el = $(`[data-reel="${rid}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }
    }
    const editBtn = e.target.closest("[data-edit-msg]");
    if (editBtn) {
      e.preventDefault();
      const mid = editBtn.dataset.editMsg;
      const el = $(`[data-message-id="${mid}"]`);
      if (el) {
        const bodyEl = el.querySelector(".msg-body");
        const curText = bodyEl ? bodyEl.textContent.trim() : "";
        el.querySelector(".msg-bubble")?.classList.add("hidden");
        const existingForm = el.querySelector(".msg-edit-form");
        if (existingForm) { existingForm.classList.remove("hidden"); }
        else {
          const form = document.createElement("form");
          form.className = "msg-edit-form";
          form.dataset.editForm = mid;
          form.innerHTML = `
            <input type="text" class="input input-sm" style="flex:1;background:#18181B;color:#fff;border:1px solid #3F3F46;border-radius:8px;padding:6px 10px;font-size:13px;" value="${esc(curText)}" required />
            <div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end;">
              <button type="button" class="btn sm" data-cancel-edit="${mid}" style="padding:4px 8px;font-size:11px;">Cancel</button>
              <button type="submit" class="btn btn-primary sm" style="padding:4px 10px;font-size:11px;">Save</button>
            </div>
          `;
          el.appendChild(form);
        }
      }
    }
    const cancelBtn = e.target.closest("[data-cancel-edit]");
    if (cancelBtn) {
      e.preventDefault();
      const mid = cancelBtn.dataset.cancelEdit;
      const el = $(`[data-message-id="${mid}"]`);
      if (el) {
        el.querySelector(".msg-bubble")?.classList.remove("hidden");
        el.querySelector(".msg-edit-form")?.classList.add("hidden");
      }
    }
  });

  document.addEventListener("submit", async (e) => {
    const editForm = e.target.closest("[data-edit-form]");
    if (editForm) {
      e.preventDefault();
      const mid = editForm.dataset.editForm;
      const input = editForm.querySelector("input");
      const text = input ? input.value.trim() : "";
      if (!text || !state.activeConvoId) return;
      try {
        const d = await api(`/api/conversations/${state.activeConvoId}/messages/${mid}`, { method: "PUT", body: { text } });
        const m = state.messages.find(x => x.id === mid);
        if (m) { m.text = d.message.text; m.isEdited = true; m.editedAt = d.message.editedAt; }
        renderMessages(false);
      } catch (err) { toast(err.message, "error"); }
    }
  });

  $("#dismissAnnouncementBtn")?.addEventListener("click", () => {
    $("#announcementBanner")?.classList.add("hidden");
  });
  $("#dismissWelcomeBtn")?.addEventListener("click", () => {
    $("#welcomeBanner")?.classList.add("hidden");
    if (state.me) localStorage.setItem("dismissed_welcome_" + state.me.id, "true");
  });

  $("#shareReelConvoList")?.addEventListener("click", async (e) => {
    const row = e.target.closest("[data-send-reel-convo]");
    if (!row || !state.sharingReelId) return;
    const convoId = row.dataset.sendReelConvo;
    try {
      await api(`/api/conversations/${convoId}/share-reel`, { method: "POST", body: { reelId: state.sharingReelId } });
      closeModal("shareReelModal");
      toast("Reel shared to chat!", "success");
    } catch (err) { toast(err.message, "error"); }
  });

  async function loadAnnouncements() {
    try {
      const list = await api("/api/announcements");
      if (list && list.length > 0) {
        const latest = list[0];
        const banner = $("#announcementBanner");
        if (banner) {
          $("#announcementText").textContent = latest.text;
          banner.classList.remove("hidden");
        }
      }
    } catch (_) {}
  }

  // Shared helpers for videos.js and groups.js (loaded after this file).
  window.NoChatApp = { api, toast, esc, icon, avatar, verified, groupAvatar, openModal, closeModal, confirmDialog, go, debounce, fmtCount, timeAgo, hydrateIcons,
    state, me: () => state.me, loadConversations, renderChatHeader, refreshChat: () => { if (state.activeConvoId) openChat(state.activeConvoId); }, closeChat: () => { closeChat(true); go("messages"); } };

  (async function boot() {
    try {
      await enterApp();
      loadAnnouncements();
    }
    catch (_) { showAuth(); }
  })();
})();
