import { useState, useEffect, useRef } from "react";
import "./App.css";
const API = import.meta.env.VITE_API_URL;


type User = {
  id: string;
  email: string;
  username: string;
  created_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type Conversation = {
  id: string;
  name: string;
  otherUserId: string;
  messages: Message[];
};

const EMOJIS = ["😀","😂","❤️","🔥","👍","🙏","😎","🎉","💯","🚀","✨","👋","😊","🥰","💪"];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; username: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          loadChats();
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeChatId]);

  async function loadChats() {
    const res = await fetch(`${API}/api/chats`, { credentials: "include" });
    const data = await res.json();
    if (data.conversations) setConversations(data.conversations);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`${API}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, username, password }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Signup failed");
    setUser(data.user);
    loadChats();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Login failed");
    setUser(data.user);
    loadChats();
  }

  async function handleLogout() {
    await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
    setConversations([]);
    setActiveChatId(null);
  }

  async function searchUsers(q: string) {
    setSearchQuery(q);
    if (q.length < 2) return setSearchResults([]);
    const res = await fetch(`${API}/api/users/search?q=${encodeURIComponent(q)}`, {
      credentials: "include",
    });
    const data = await res.json();
    setSearchResults(data.users || []);
  }

  async function startChat(otherUserId: string) {
    const res = await fetch(`${API}/api/chats/direct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId: otherUserId }),
    });
    const data = await res.json();
    if (data.conversationId) {
      setSearchQuery("");
      setSearchResults([]);
      await loadChats();
      setActiveChatId(data.conversationId);
    }
  }

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    if (!activeChatId || !messageText.trim() || sending) return;

    setSending(true);
    const res = await fetch(`${API}/api/chats/${activeChatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ body: messageText.trim() }),
    });
    const data = await res.json();
    setSending(false);

    if (data.message) {
      setMessageText("");
      setShowEmoji(false);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? { ...c, messages: [...c.messages, data.message] }
            : c
        )
      );
    }
  }

  function addEmoji(emoji: string) {
    setMessageText((prev) => prev + emoji);
  }

  const activeChat = conversations.find((c) => c.id === activeChatId);

  if (loading) {
    return (
      <div className="app loading-screen">
        <div className="loader">
          <div className="globe">🌐</div>
          <h2>Connecting the world...</h2>
          <p>NoChat by Denpher Technologies</p>
        </div>
      </div>
    );
  }

  // ========== LOGIN / SIGNUP ==========
  if (!user) {
    return (
      <div className="app auth">
        <div className="auth-card">
          <div className="auth-header">
            <div className="logo">🌐</div>
            <h1>NoChat</h1>
            <p className="tagline">Connect with anyone, anywhere in the world</p>
          </div>

          <div className="tabs">
            <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>
              Login
            </button>
            <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>
              Sign up
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          {authMode === "login" ? (
            <form onSubmit={handleLogin}>
              <div className="input-group">
                <span className="icon">👤</span>
                <input placeholder="Email or username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              </div>
              <div className="input-group">
                <span className="icon">🔒</span>
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button type="submit" className="primary-btn">Start Connecting →</button>
            </form>
          ) : (
            <form onSubmit={handleSignup}>
              <div className="input-group">
                <span className="icon">✉️</span>
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="input-group">
                <span className="icon">👤</span>
                <input placeholder="Username (3-20 chars)" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="input-group">
                <span className="icon">🔒</span>
                <input type="password" placeholder="Password (min 12 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button type="submit" className="primary-btn">Create Account →</button>
            </form>
          )}

          <div className="auth-footer">
            Powered by{" "}
            <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noreferrer">
              Denpher Technologies
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ========== MAIN CHAT ==========
  return (
    <div className="app chat-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="user-info">
            <div className="avatar">{user.username[0].toUpperCase()}</div>
            <div>
              <strong>{user.username}</strong>
              <div className="status-online">● Online</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">🚪</button>
        </div>

        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            placeholder="Search friends worldwide..."
            value={searchQuery}
            onChange={(e) => searchUsers(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((u) => (
                <button key={u.id} onClick={() => startChat(u.id)}>
                  <span className="result-avatar">{u.username[0].toUpperCase()}</span>
                  <span>@{u.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="section-title">Conversations</div>

        <div className="chat-list">
          {conversations.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">💬</div>
              <p>No conversations yet</p>
              <small>Search a username to start chatting</small>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                className={`chat-item ${c.id === activeChatId ? "active" : ""}`}
                onClick={() => setActiveChatId(c.id)}
              >
                <div className="chat-avatar">{c.name[0].toUpperCase()}</div>
                <div className="chat-meta">
                  <div className="name">@{c.name}</div>
                  <div className="preview">
                    {c.messages.length ? c.messages[c.messages.length - 1].body.slice(0, 32) : "Say hello 👋"}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          Powered by{" "}
          <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noreferrer">
            Denpher Technologies
          </a>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        {!activeChat ? (
          <div className="empty-state">
            <div className="big-globe">🌐</div>
            <h2>Connect with the world</h2>
            <p>Search for your friends and start chatting instantly</p>
            <div className="powered">
              Powered by{" "}
              <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noreferrer">
                Denpher Technologies
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="header-left">
                <div className="header-avatar">{activeChat.name[0].toUpperCase()}</div>
                <div>
                  <h2>@{activeChat.name}</h2>
                  <span className="status">● Online</span>
                </div>
              </div>
            </div>

            <div className="messages">
              {activeChat.messages.length === 0 && (
                <div className="no-messages">
                  <p>No messages yet. Say hi! 👋</p>
                </div>
              )}
              {activeChat.messages.map((m) => (
                <div key={m.id} className={`message ${m.sender_id === user.id ? "mine" : "theirs"}`}>
                  <div className="bubble">{m.body}</div>
                  <div className="time">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="composer-area">
              {showEmoji && (
                <div className="emoji-picker">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => addEmoji(e)}>
                      {e}
                    </button>
                  ))}
                </div>
              )}

              <form className="composer" onSubmit={sendMessage}>
                <button type="button" className="emoji-btn" onClick={() => setShowEmoji(!showEmoji)}>
                  😊
                </button>
                <input
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled={sending}
                />
                <button type="submit" disabled={sending || !messageText.trim()}>
                  ➤
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

