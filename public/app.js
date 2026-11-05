/* =========================================================
   NOCHAT — DENPHER TECHNOLOGIES
   Complete Frontend Application
   Includes persistent profile picture management
========================================================= */

"use strict";

/* 01. DOM ELEMENTS */

const $ = selector => document.querySelector(selector);

const landingView = $("#landingView");
const authView = $("#authView");
const appView = $("#appView");

const authForm = $("#authForm");
const authSubmit = $("#authSubmit");
const authHint = $("#authHint");

const usernameInput = $("#username");
const passwordInput = $("#password");

const conversationList = $("#conversationList");
const searchInput = $("#searchInput");

const messagesContainer = $("#messages");
const messageForm = $("#messageForm");
const messageInput = $("#messageInput");

const welcomePanel = $("#welcomePanel");
const chatPanel = $("#chatPanel");

const userModal = $("#userModal");
const userSearch = $("#userSearch");
const userResults = $("#userResults");

/* 02. APPLICATION STATE */

let mode = "login";
let me = null;
let socket = null;

let conversations = [];
let activeConversation = null;
let activeUser = null;

let userSearchTimeout = null;
let toastTimeout = null;

let searchRequestNumber = 0;
let recommendationRequestNumber = 0;

let sendingMessage = false;
let authInProgress = false;
let profileSaving = false;

let selectedProfileFile = null;
let profilePreviewURL = null;

const messageCache = new Map();
const onlineUsers = new Set();

/* 03. UTILITIES */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function getInitials(name = "NoChat User") {
  return String(name).trim().slice(0, 2).toUpperCase();
}

function formatTime(date) {
  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return "";

  return value.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toast(message) {
  const element = $("#toast");

  if (!element) {
    console.log("NoChat:", message);
    return;
  }

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    element.classList.remove("show");
  }, 2800);
}

function setButtonLoading(button, loading, text = "Please wait...") {
  if (!button) return;

  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.innerHTML;
    }

    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;

    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

function normalizeMessage(message) {
  if (!message) return null;

  return {
    ...message,
    text: String(message.text ?? message.content ?? "")
  };
}

function cacheMessage(message) {
  const normalized = normalizeMessage(message);

  if (!normalized?.conversationId) return;

  const id = String(normalized.conversationId);
  const cached = messageCache.get(id) || [];

  if (
    normalized.id &&
    cached.some(item => String(item.id) === String(normalized.id))
  ) {
    return;
  }

  cached.push(normalized);
  messageCache.set(id, cached);
}

/* Avatar HTML: use server photo, otherwise initials. */

function avatarHTML(user, className = "avatar") {
  const username = user?.username || "NoChat User";
  const initials = escapeHTML(getInitials(username));

  if (user?.profilePicture) {
    return `
      <div class="${escapeHTML(className)} profile-avatar">
        <img
          src="${escapeHTML(user.profilePicture)}"
          alt="${escapeHTML(username)}"
          loading="lazy"
          onerror="this.parentElement.classList.add('avatar-fallback');this.remove();"
        >
        <span class="avatar-initials">${initials}</span>
      </div>
    `;
  }

  return `
    <div class="${escapeHTML(className)} profile-avatar avatar-fallback">
      <span class="avatar-initials">${initials}</span>
    </div>
  `;
}

function renderAvatarInto(element, user) {
  if (!element || !user) return;

  const username = user.username || "NoChat User";
  const initials = escapeHTML(getInitials(username));

  element.classList.add("profile-avatar");
  element.replaceChildren();

  if (user.profilePicture) {
    const image = document.createElement("img");

    image.src = user.profilePicture;
    image.alt = `${username} profile picture`;
    image.loading = "lazy";

    image.onerror = () => {
      image.remove();
      element.textContent = getInitials(username);
      element.classList.add("avatar-fallback");
    };

    element.appendChild(image);
    element.classList.remove("avatar-fallback");
  } else {
    element.textContent = getInitials(username);
    element.classList.add("avatar-fallback");
  }
}

/* 04. API CLIENT */

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const isFormData = options.body instanceof FormData;

  if (options.body && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers
    });
  } catch {
    throw new Error(
      "Cannot connect to NoChat. Check whether the server is running."
    );
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error || data.message || "Something went wrong."
    );
  }

  return data;
}

/* 05. APPLICATION RESET */

function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

function resetApplicationState() {
  disconnectSocket();

  me = null;
  activeConversation = null;
  activeUser = null;

  conversations = [];

  messageCache.clear();
  onlineUsers.clear();

  sendingMessage = false;

  if (conversationList) conversationList.innerHTML = "";
  if (messagesContainer) messagesContainer.innerHTML = "";

  closeProfile();
}

/* 06. PAGE NAVIGATION */

function showLanding() {
  landingView?.classList.remove("hidden");
  authView?.classList.add("hidden");
  appView?.classList.add("hidden");

  closeUserModal();
  resetApplicationState();
}

function showAuth() {
  landingView?.classList.add("hidden");
  authView?.classList.remove("hidden");
  appView?.classList.add("hidden");

  closeUserModal();
  resetApplicationState();

  authForm?.reset();
  setMode("login");
}

async function showApp() {
  if (!me) return;

  landingView?.classList.add("hidden");
  authView?.classList.add("hidden");
  appView?.classList.remove("hidden");

  const myName = $("#myName");
  const myAvatar = $("#myAvatar");

  if (myName) myName.textContent = me.username;
  if (myAvatar) renderAvatarInto(myAvatar, me);

  addProfileButton();

  welcomePanel?.classList.remove("hidden");
  chatPanel?.classList.add("hidden");

  activeConversation = null;
  activeUser = null;

  connectSocket();
  await loadConversations();
}

/* 07. LANDING PAGE BUTTONS */

$("#getStartedBtn")?.addEventListener("click", showAuth);
$("#navGetStarted")?.addEventListener("click", showAuth);
$("#backToLanding")?.addEventListener("click", showLanding);

/* 08. AUTHENTICATION TABS */

function setMode(nextMode) {
  mode = nextMode === "register" ? "register" : "login";

  document.querySelectorAll(".tab[data-mode]").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });

  if (authSubmit) {
    authSubmit.disabled = false;
    authSubmit.innerHTML = mode === "login"
      ? 'Sign in <span>→</span>'
      : 'Create account <span>→</span>';
  }

  if (authHint) {
    authHint.textContent = mode === "login"
      ? "Sign in to access your NoChat workspace."
      : "Choose a username and password to create your account.";
  }

  if (usernameInput) usernameInput.autocomplete = "username";

  if (passwordInput) {
    passwordInput.autocomplete = mode === "login"
      ? "current-password"
      : "new-password";
  }
}

document.querySelectorAll(".tab[data-mode]").forEach(tab => {
  tab.addEventListener("click", () => {
    if (!authInProgress) setMode(tab.dataset.mode);
  });
});

/* 09. LOGIN & REGISTRATION */

authForm?.addEventListener("submit", async event => {
  event.preventDefault();

  if (authInProgress) return;

  const username = usernameInput?.value.trim() || "";
  const password = passwordInput?.value || "";

  if (!username || !password) {
    toast("Enter your username and password.");
    return;
  }

  if (username.length < 3 || username.length > 20) {
    toast("Username must contain 3–20 characters.");
    return;
  }

  if (password.length < 8 || password.length > 128) {
    toast("Password must contain 8–128 characters.");
    return;
  }

  authInProgress = true;
  setButtonLoading(authSubmit, true);

  try {
    const endpoint = mode === "register"
      ? "/api/auth/register"
      : "/api/auth/login";

    const data = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({ username, password })
    });

    if (!data.user) {
      throw new Error("Authentication response was incomplete.");
    }

    me = data.user;
    authForm.reset();

    const registered = mode === "register";

    await showApp();

    toast(
      registered
        ? "Welcome to NoChat. Your account is ready."
        : "Welcome back to NoChat."
    );
  } catch (error) {
    toast(error.message);
  } finally {
    authInProgress = false;
    setButtonLoading(authSubmit, false);
  }
});

/* 10. SOCKET.IO CONNECTION */

function connectSocket() {
  disconnectSocket();

  if (typeof io !== "function") {
    toast("NoChat realtime connection could not load.");
    return;
  }

  socket = io({
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });

  socket.on("connect", () => {
    console.log("NoChat connected:", socket.id);

    if (activeConversation) {
      socket.emit("conversation:join", activeConversation);
    }
  });

  socket.on("connect_error", error => {
    console.error("NoChat connection error:", error.message);
  });

  socket.on("disconnect", reason => {
    console.log("NoChat disconnected:", reason);
  });

  socket.on("message:new", message => {
    if (!message?.conversationId) return;

    const conversationId = String(message.conversationId);

    cacheMessage(message);

    if (conversationId === String(activeConversation)) {
      addMessage(message);
    }

    loadConversations().catch(console.error);
  });

  socket.on("conversation:update", () => {
    loadConversations().catch(console.error);
  });

  socket.on("presence:update", presence => {
    if (!presence?.userId) return;

    const id = String(presence.userId);

    if (presence.online) onlineUsers.add(id);
    else onlineUsers.delete(id);

    updateActivePresence();
    renderConversations();
  });
}

/* 11. CONVERSATION MANAGEMENT */

async function loadConversations() {
  if (!me) return;

  try {
    const data = await api("/api/conversations");

    conversations = Array.isArray(data.conversations)
      ? data.conversations
      : [];

    renderConversations();
    updateActivePresence();
  } catch (error) {
    console.error("Conversation loading error:", error);
    toast(error.message);
  }
}

function getConversationName(conversation) {
  if (conversation.name) return conversation.name;
  if (conversation.user?.username) return conversation.user.username;
  if (conversation.participant?.username) return conversation.participant.username;

  if (Array.isArray(conversation.members)) {
    const other = conversation.members.find(member => {
      const id = typeof member === "object" ? member.id : member;
      return String(id) !== String(me?.id);
    });

    if (other && typeof other === "object" && other.username) {
      return other.username;
    }
  }

  return "NoChat member";
}

function getLastMessagePreview(conversation) {
  const lastMessage = conversation.lastMessage;

  if (typeof lastMessage === "string") {
    return lastMessage || "Start a conversation";
  }

  if (lastMessage && typeof lastMessage === "object") {
    return lastMessage.text || lastMessage.content || "Start a conversation";
  }

  return "Start a conversation";
}

function renderConversations() {
  if (!conversationList) return;

  const query = (searchInput?.value || "").trim().toLowerCase();

  const filtered = conversations.filter(conversation =>
    getConversationName(conversation).toLowerCase().includes(query)
  );

  if (!filtered.length) {
    conversationList.innerHTML = `
      <div class="empty-side">
        ${query
          ? "No conversations found."
          : "No conversations yet. Find someone to start chatting."}
      </div>
    `;
    return;
  }

  conversationList.innerHTML = filtered.map(conversation => {
    const name = getConversationName(conversation);
    const id = String(conversation.id);
    const active = id === String(activeConversation);

    const otherUser = conversation.user ||
      conversation.participant ||
      { username: name };

    const isOnline = otherUser.id &&
      onlineUsers.has(String(otherUser.id));

    return `
      <div
        class="conversation-item ${active ? "active" : ""}"
        data-id="${escapeHTML(id)}"
        role="button"
        tabindex="0"
      >
        ${avatarHTML(otherUser)}

        <div class="conv-meta">
          <b>${escapeHTML(name)}</b>
          <small>${escapeHTML(getLastMessagePreview(conversation))}</small>
        </div>

        ${isOnline
          ? '<span class="online-dot" aria-label="Online"></span>'
          : ""}
      </div>
    `;
  }).join("");

  conversationList.querySelectorAll(".conversation-item").forEach(item => {
    const open = () => openConversation(item.dataset.id);

    item.addEventListener("click", open);

    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

/* 12. OPEN A CONVERSATION */

async function openConversation(id) {
  const conversation = conversations.find(
    item => String(item.id) === String(id)
  );

  if (!conversation) {
    toast("Conversation not found.");
    return;
  }

  activeConversation = String(id);
  activeUser = getConversationName(conversation);

  welcomePanel?.classList.add("hidden");
  chatPanel?.classList.remove("hidden");

  const chatName = $("#chatName");
  const chatAvatar = $("#chatAvatar");

  const otherUser = conversation.user ||
    conversation.participant ||
    { username: activeUser };

  if (chatName) chatName.textContent = activeUser;
  if (chatAvatar) renderAvatarInto(chatAvatar, otherUser);

  updateActivePresence();
  renderConversations();

  if (messagesContainer) messagesContainer.innerHTML = "";

  const cached = messageCache.get(activeConversation);

  if (cached) cached.forEach(addMessage);

  if (socket?.connected) {
    socket.emit("conversation:join", activeConversation);
  }

  const requestedId = activeConversation;

  try {
    const data = await api(
      `/api/conversations/${encodeURIComponent(requestedId)}/messages`
    );

    if (String(activeConversation) !== requestedId) return;

    const messages = Array.isArray(data.messages)
      ? data.messages.map(normalizeMessage).filter(Boolean)
      : [];

    messageCache.set(requestedId, messages);

    if (messagesContainer) messagesContainer.innerHTML = "";

    messages.forEach(addMessage);
  } catch (error) {
    toast(error.message);
  }
}

/* 13. ONLINE / OFFLINE PRESENCE */

function updateActivePresence() {
  if (!activeConversation) return;

  const conversation = conversations.find(
    item => String(item.id) === String(activeConversation)
  );

  const otherUserId =
    conversation?.user?.id ||
    conversation?.participant?.id;

  const status = $("#chatStatus");

  if (!status || !otherUserId) return;

  const isOnline = onlineUsers.has(String(otherUserId));

  status.textContent = isOnline ? "Online" : "Offline";
  status.classList.toggle("is-online", isOnline);
}

/* 14. MESSAGE DISPLAY */

function addMessage(rawMessage) {
  if (!messagesContainer || !rawMessage) return;

  const message = normalizeMessage(rawMessage);

  if (
    String(message.conversationId) !== String(activeConversation)
  ) {
    return;
  }

  if (message.id) {
    const exists = Array.from(
      messagesContainer.querySelectorAll("[data-message-id]")
    ).some(element =>
      element.dataset.messageId === String(message.id)
    );

    if (exists) return;
  }

  const mine = String(message.senderId) === String(me?.id);

  const element = document.createElement("div");
  element.className = `message ${mine ? "mine" : "theirs"}`;

  if (message.id) {
    element.dataset.messageId = String(message.id);
  }

  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = message.text;

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = formatTime(message.createdAt || Date.now());

  element.append(content, meta);
  messagesContainer.appendChild(element);

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/* 15. SEND MESSAGE */

messageForm?.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage();
});

function sendMessage() {
  if (sendingMessage) return;

  const text = messageInput?.value.trim() || "";

  if (!text) return toast("Write a message first.");
  if (text.length > 2000) return toast("Message cannot exceed 2000 characters.");
  if (!activeConversation) return toast("Select a conversation first.");
  if (!socket?.connected) return toast("Not connected. Please wait for reconnection.");

  const conversationId = String(activeConversation);
  sendingMessage = true;

  const sendButton = messageForm?.querySelector('button[type="submit"]');

  if (sendButton) sendButton.disabled = true;

  socket.timeout(10000).emit(
    "message:send",
    { conversationId, text },
    (error, response) => {
      sendingMessage = false;

      if (sendButton) sendButton.disabled = false;

      if (error) return toast("Message timed out. Please try again.");

      if (!response?.success) {
        return toast(response?.error || "Message could not be sent.");
      }

      if (response.message) {
        cacheMessage(response.message);

        if (String(activeConversation) === conversationId) {
          addMessage(response.message);
        }
      }

      if (messageInput) {
        messageInput.value = "";
        messageInput.focus();
      }

      loadConversations().catch(console.error);
    }
  );
}

/* 16. CONVERSATION SEARCH */

searchInput?.addEventListener("input", renderConversations);

/* 17. DISCOVER PEOPLE MODAL */

function openUserModal() {
  if (!userModal) return;

  userModal.classList.remove("hidden");

  if (userSearch) {
    userSearch.value = "";
    userSearch.focus();
  }

  loadRecommendations();
}

function closeUserModal() {
  userModal?.classList.add("hidden");

  searchRequestNumber++;
  recommendationRequestNumber++;

  clearTimeout(userSearchTimeout);
}

$("#newChatBtn")?.addEventListener("click", openUserModal);
$("#welcomeNew")?.addEventListener("click", openUserModal);
$("#closeModal")?.addEventListener("click", closeUserModal);

userModal?.addEventListener("click", event => {
  if (event.target === userModal) closeUserModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeUserModal();
    closeProfile();
  }
});

/* 18. PEOPLE YOU MAY KNOW */

async function loadRecommendations() {
  if (!userResults) return;

  const requestNumber = ++recommendationRequestNumber;

  userResults.innerHTML = `
    <div class="recommendation-heading">
      <span class="recommendation-eyebrow">DISCOVER</span>
      <h3>People you may know</h3>
      <p>Find people on NoChat and start a conversation.</p>
    </div>
    <div class="muted">Finding people...</div>
  `;

  try {
    const data = await api("/api/recommendations");

    if (
      requestNumber !== recommendationRequestNumber ||
      userModal?.classList.contains("hidden")
    ) return;

    const users = Array.isArray(data.users)
      ? data.users.filter(user => String(user.id) !== String(me?.id))
      : [];

    if (!users.length) {
      userResults.innerHTML = `
        <div class="recommendation-heading">
          <span class="recommendation-eyebrow">DISCOVER</span>
          <h3>People you may know</h3>
          <p>Find people on NoChat and start a conversation.</p>
        </div>
        <div class="muted">No new people to recommend right now.</div>
      `;
      return;
    }

    renderPeople(users, "recommendations");
  } catch (error) {
    if (requestNumber !== recommendationRequestNumber) return;

    userResults.innerHTML = `
      <div class="muted">
        Could not load recommendations.
        ${escapeHTML(error.message)}
      </div>
    `;
  }
}

/* 19. RENDER PEOPLE */

function renderPeople(users, source = "search") {
  if (!userResults) return;

  if (!users.length) {
    userResults.innerHTML = `<div class="muted">No people found.</div>`;
    return;
  }

  const heading = source === "recommendations"
    ? `
      <div class="recommendation-heading">
        <span class="recommendation-eyebrow">DISCOVER</span>
        <h3>People you may know</h3>
        <p>Connect with other NoChat members.</p>
      </div>
    `
    : `
      <div class="recommendation-heading">
        <h3>Search results</h3>
      </div>
    `;

  userResults.innerHTML = heading + users.map(user => `
    <div class="user-row">
      ${avatarHTML(user)}

      <div class="user-row-info">
        <b>${escapeHTML(user.username)}</b>
        <small>NoChat member</small>
      </div>

      <button
        type="button"
        class="user-message-btn"
        data-user-id="${escapeHTML(user.id)}"
      >
        Message <span>→</span>
      </button>
    </div>
  `).join("");

  userResults.querySelectorAll("button[data-user-id]").forEach(button => {
    button.addEventListener("click", () => {
      createConversation(button.dataset.userId);
    });
  });
}

/* 20. USER SEARCH */

userSearch?.addEventListener("input", () => {
  clearTimeout(userSearchTimeout);

  const query = userSearch.value.trim();

  if (query.length < 2) {
    searchRequestNumber++;
    loadRecommendations();
    return;
  }

  userSearchTimeout = setTimeout(() => searchUsers(query), 300);
});

async function searchUsers(query) {
  const requestNumber = ++searchRequestNumber;

  if (!userResults) return;

  userResults.innerHTML = `<div class="muted">Searching...</div>`;

  try {
    const data = await api(`/api/users?q=${encodeURIComponent(query)}`);

    if (requestNumber !== searchRequestNumber) return;

    const users = Array.isArray(data.users)
      ? data.users.filter(user => String(user.id) !== String(me?.id))
      : [];

    renderPeople(users, "search");
  } catch (error) {
    if (requestNumber !== searchRequestNumber) return;

    userResults.innerHTML = `
      <div class="muted">${escapeHTML(error.message)}</div>
    `;
  }
}

/* 21. CREATE CONVERSATION */

async function createConversation(userId) {
  try {
    const data = await api("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ userId })
    });

    closeUserModal();

    await loadConversations();

    const conversationId = data.conversation?.id || data.id;

    if (!conversationId) {
      toast("Conversation created, but no ID was returned.");
      return;
    }

    await openConversation(conversationId);
    toast("Conversation opened.");
  } catch (error) {
    toast(error.message);
  }
}

/* 22. PROFILE PICTURE — EDITOR */

function createProfileInterface() {
  if ($("#profileModal")) return;

  const modal = document.createElement("div");

  modal.id = "profileModal";
  modal.className = "profile-modal hidden";

  modal.innerHTML = `
    <div class="profile-card" role="dialog" aria-modal="true"
         aria-labelledby="profileTitle">

      <button type="button" class="profile-close"
              id="profileClose" aria-label="Close">×</button>

      <span class="profile-eyebrow">NOCHAT ACCOUNT</span>
      <h2 id="profileTitle">Edit profile</h2>

      <p class="profile-description">
        Personalise your NoChat account with a profile picture.
      </p>

      <div class="profile-preview" id="profilePreview"></div>
      <div class="profile-username" id="profileUsername"></div>

      <label class="profile-upload-label" for="profileFile">
        <span>＋</span> Choose a picture
      </label>

      <input
        type="file"
        id="profileFile"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
      >

      <p class="profile-file-info">
        JPG, PNG, WebP or GIF · Maximum 3 MB
      </p>

      <div class="profile-actions">
        <button type="button" id="saveProfilePicture"
                class="profile-save" disabled>
          Save picture
        </button>

        <button type="button" id="removeProfilePicture"
                class="profile-remove">
          Remove picture
        </button>
      </div>

      <p class="profile-feedback" id="profileFeedback"
         aria-live="polite"></p>
    </div>
  `;

  document.body.appendChild(modal);

  $("#profileClose").addEventListener("click", closeProfile);

  modal.addEventListener("click", event => {
    if (event.target === modal) closeProfile();
  });

  $("#profileFile").addEventListener("change", previewProfilePicture);
  $("#saveProfilePicture").addEventListener("click", uploadProfilePicture);
  $("#removeProfilePicture").addEventListener("click", removeProfilePicture);
}

function addProfileButton() {
  if ($("#editProfileBtn")) return;

  const profileArea = $(".profile");

  if (!profileArea) {
    console.warn("NoChat: .profile element not found.");
    return;
  }

  const button = document.createElement("button");

  button.id = "editProfileBtn";
  button.type = "button";
  button.className = "edit-profile-btn";
  button.innerHTML = `<span aria-hidden="true">⚙</span> Edit profile`;

  button.addEventListener("click", openProfile);

  profileArea.appendChild(button);
}

function openProfile() {
  if (!me) return;

  createProfileInterface();

  selectedProfileFile = null;
  clearProfilePreviewURL();

  const modal = $("#profileModal");
  const preview = $("#profilePreview");

  $("#profileUsername").textContent = `@${me.username}`;
  preview.replaceChildren();

  if (me.profilePicture) {
    const image = document.createElement("img");
    image.src = me.profilePicture;
    image.alt = "Current profile picture";
    preview.appendChild(image);
  } else {
    preview.textContent = getInitials(me.username);
  }

  $("#profileFile").value = "";
  $("#saveProfilePicture").disabled = true;
  $("#removeProfilePicture").disabled = !me.profilePicture;
  $("#profileFeedback").textContent = "";

  modal.classList.remove("hidden");
  $("#profileClose").focus();
}

function closeProfile() {
  $("#profileModal")?.classList.add("hidden");

  selectedProfileFile = null;
  clearProfilePreviewURL();
}

function clearProfilePreviewURL() {
  if (profilePreviewURL) {
    URL.revokeObjectURL(profilePreviewURL);
    profilePreviewURL = null;
  }
}

function previewProfilePicture(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ];

  if (!allowedTypes.includes(file.type)) {
    toast("Choose a JPG, PNG, WebP or GIF image.");
    event.target.value = "";
    return;
  }

  if (file.size > 3 * 1024 * 1024) {
    toast("Image must be smaller than 3 MB.");
    event.target.value = "";
    return;
  }

  selectedProfileFile = file;

  clearProfilePreviewURL();
  profilePreviewURL = URL.createObjectURL(file);

  const preview = $("#profilePreview");
  preview.replaceChildren();

  const image = document.createElement("img");
  image.src = profilePreviewURL;
  image.alt = "Selected profile picture preview";

  preview.appendChild(image);

  $("#saveProfilePicture").disabled = false;
  $("#profileFeedback").textContent = "Preview ready. Save to update your profile.";
}

function updateProfileEverywhere(updatedUser) {
  if (!updatedUser || !me) return;

  me = { ...me, ...updatedUser };

  const myName = $("#myName");
  const myAvatar = $("#myAvatar");

  if (myName) myName.textContent = me.username;
  if (myAvatar) renderAvatarInto(myAvatar, me);

  /* Refresh avatars in conversations and recommendations. */
  renderConversations();

  const currentConversation = conversations.find(
    item => String(item.id) === String(activeConversation)
  );

  if (currentConversation) {
    const otherUser = currentConversation.user ||
      currentConversation.participant;

    if (otherUser && String(otherUser.id) === String(me.id)) {
      renderAvatarInto($("#chatAvatar"), me);
    }
  }

  /* Update profile modal's current preview. */
  $("#profileUsername") && (
    $("#profileUsername").textContent = `@${me.username}`
  );
}

async function uploadProfilePicture() {
  if (!selectedProfileFile || profileSaving) return;

  profileSaving = true;

  const button = $("#saveProfilePicture");
  const feedback = $("#profileFeedback");

  button.disabled = true;
  button.textContent = "Uploading...";
  feedback.textContent = "Uploading your picture...";

  try {
    const formData = new FormData();
    formData.append("avatar", selectedProfileFile);

    const data = await api("/api/profile/avatar", {
      method: "POST",
      body: formData
    });

    const updatedUser = data.user || data;

    if (!updatedUser.profilePicture) {
      throw new Error("The server did not return the saved profile picture.");
    }

    updateProfileEverywhere(updatedUser);

    selectedProfileFile = null;
    clearProfilePreviewURL();

    $("#profileFile").value = "";
    $("#profilePreview").replaceChildren();

    const image = document.createElement("img");
    image.src = me.profilePicture;
    image.alt = "Saved profile picture";
    $("#profilePreview").appendChild(image);

    $("#removeProfilePicture").disabled = false;
    feedback.textContent = "Your profile picture has been saved.";
    toast("Profile picture updated.");
  } catch (error) {
    feedback.textContent = error.message;
    toast(error.message);
  } finally {
    profileSaving = false;
    button.disabled = !selectedProfileFile;
    button.textContent = "Save picture";
  }
}

async function removeProfilePicture() {
  if (!me?.profilePicture || profileSaving) return;

  profileSaving = true;

  const button = $("#removeProfilePicture");
  const feedback = $("#profileFeedback");

  button.disabled = true;
  button.textContent = "Removing...";
  feedback.textContent = "Removing your profile picture...";

  try {
    const data = await api("/api/profile/avatar", {
      method: "DELETE"
    });

    const updatedUser = data.user || {
      ...me,
      profilePicture: null
    };

    updatedUser.profilePicture = null;

    updateProfileEverywhere(updatedUser);

    selectedProfileFile = null;
    clearProfilePreviewURL();

    $("#profileFile").value = "";
    $("#profilePreview").textContent = getInitials(me.username);
    $("#saveProfilePicture").disabled = true;

    feedback.textContent = "Profile picture removed.";
    toast("Profile picture removed.");
  } catch (error) {
    feedback.textContent = error.message;
    toast(error.message);
  } finally {
    profileSaving = false;
    button.disabled = !me?.profilePicture;
    button.textContent = "Remove picture";
  }
}

/* 23. LOGOUT */

$("#logoutBtn")?.addEventListener("click", async () => {
  const button = $("#logoutBtn");

  if (button) button.disabled = true;

  try {
    await api("/api/auth/logout", { method: "POST" });

    showLanding();
    toast("You have been signed out.");
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
});

/* 24. MOBILE NAVIGATION */

$("#mobileMenuBtn")?.addEventListener("click", () => {
  appView?.classList.toggle("sidebar-open");
});

$("#mobileBackBtn")?.addEventListener("click", () => {
  chatPanel?.classList.add("hidden");
  welcomePanel?.classList.remove("hidden");

  activeConversation = null;
  activeUser = null;

  renderConversations();
});

/* 25. INITIAL SESSION CHECK */

async function init() {
  setMode("login");

  try {
    const data = await api("/api/me");

    me = data.user || null;

    if (me) {
      await showApp();
    } else {
      showLanding();
    }
  } catch {
    showLanding();
  }
}

/* 26. LANDING PAGE SCROLL REVEAL */

if ("IntersectionObserver" in window) {
  const revealElements = document.querySelectorAll(
    ".feature-card, .preview, .section, .features, footer"
  );

  revealElements.forEach(element => element.classList.add("reveal"));

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealElements.forEach(element => revealObserver.observe(element));
}

/* 27. START NOCHAT */

init();

console.log("NoChat frontend initialized.");