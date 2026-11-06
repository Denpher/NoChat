import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";

dotenv.config({ override: true });

const app = express();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables.");
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const allowedOrigins = [
  "http://localhost:5173",
  "https://nochat-rust.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const COOKIE_NAME = "nochat_session";
const SESSION_DAYS = 7;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function setSessionCookie(res: express.Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", 
sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

async function createSession(userId: string, res: express.Response) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await db.from("app_sessions").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) throw error;
  setSessionCookie(res, token);
}

async function getCurrentUser(req: express.Request) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token || typeof token !== "string") return null;

  const tokenHash = hashToken(token);

  const { data: session } = await db
    .from("app_sessions")
    .select("user_id")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!session) return null;

  const { data: user } = await db
    .from("app_users")
    .select("id, email, username, created_at")
    .eq("id", session.user_id)
    .maybeSingle();

  return user || null;
}

async function requireUser(req: express.Request, res: express.Response) {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Please log in again." });
    return null;
  }
  return user;
}

// Health
app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "NoChat backend is running!" });
});

// SIGNUP
app.post("/api/auth/signup", authLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Enter a valid email." });
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      res.status(400).json({
        error: "Username must be 3-20 characters (letters, numbers, underscore).",
      });
      return;
    }
    if (password.length < 12 || password.length > 72) {
      res.status(400).json({
        error: "Password must be between 12 and 72 characters.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error } = await db
      .from("app_users")
      .insert({ email, username, password_hash: passwordHash })
      .select("id, email, username, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        res.status(409).json({ error: "Email or username is already registered." });
        return;
      }
      throw error;
    }

    await createSession(user.id, res);
    res.status(201).json({ success: true, user });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Signup failed." });
  }
});

// LOGIN
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const identifier = String(req.body.identifier || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!identifier || !password) {
      res.status(400).json({ error: "Enter your email/username and password." });
      return;
    }

    const column = identifier.includes("@") ? "email" : "username";

    const { data: user, error } = await db
      .from("app_users")
      .select("id, email, username, password_hash, created_at")
      .eq(column, identifier)
      .maybeSingle();

    if (error) throw error;

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: "Invalid login details." });
      return;
    }

    await createSession(user.id, res);
    const { password_hash, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed." });
  }
});

// CURRENT USER
app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Not logged in." });
      return;
    }
    res.json({ success: true, user });
  } catch {
    res.status(500).json({ error: "Could not check session." });
  }
});

// LOGOUT
app.post("/api/auth/logout", async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (token && typeof token === "string") {
      await db.from("app_sessions").delete().eq("token_hash", hashToken(token));
    }
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Logout failed." });
  }
});

// SEARCH USERS
app.get("/api/users/search", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const q = String(req.query.q || "").trim().toLowerCase();
    if (q.length < 2) {
      res.json({ users: [] });
      return;
    }

    const { data, error } = await db
      .from("app_users")
      .select("id, username, email")
      .neq("id", user.id)
      .ilike("username", `%${q}%`)
      .limit(20);

    if (error) throw error;

    res.json({
      users: (data || []).map((person) => ({
        id: person.id,
        username: person.username,
        full_name: person.username,
        avatar_url: null,
      })),
    });
  } catch (error) {
    console.error("User search error:", error);
    res.status(500).json({ error: "Could not search users." });
  }
});

// GET CONVERSATIONS
app.get("/api/chats", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const { data: memberships, error: memberError } = await db
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (memberError) throw memberError;

    const ids = [...new Set((memberships || []).map((m) => m.conversation_id))];
    if (!ids.length) {
      res.json({ conversations: [] });
      return;
    }

    const { data: chats, error: chatError } = await db
      .from("conversations")
      .select("id, name, type, created_at")
      .in("id", ids);

    if (chatError) throw chatError;

    const { data: members, error: allMembersError } = await db
      .from("conversation_members")
      .select("conversation_id, user_id")
      .in("conversation_id", ids);

    if (allMembersError) throw allMembersError;

    const otherIds = [
      ...new Set(
        (members || [])
          .filter((m) => m.user_id !== user.id)
          .map((m) => m.user_id)
      ),
    ];

    const { data: people, error: peopleError } = otherIds.length
      ? await db.from("app_users").select("id, username").in("id", otherIds)
      : { data: [], error: null };

    if (peopleError) throw peopleError;

    const { data: messages, error: messagesError } = await db
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    const conversations = (chats || []).map((chat) => {
      const chatMembers = (members || []).filter(
        (m) => m.conversation_id === chat.id
      );
      const other = chatMembers.find((m) => m.user_id !== user.id);
      const person = (people || []).find((p) => p.id === other?.user_id);

      return {
        id: chat.id,
        name: person?.username || chat.name || "NoChat user",
        otherUserId: other?.user_id || "",
        messages: (messages || [])
          .filter((m) => m.conversation_id === chat.id)
          .map((m) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            body: m.body,
            created_at: m.created_at,
          })),
      };
    });

    res.json({ conversations });
  } catch (error) {
    console.error("Load chats error:", error);
    res.status(500).json({ error: "Could not load chats." });
  }
});

// CREATE OR OPEN DIRECT CHAT
app.post("/api/chats/direct", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const otherUserId = String(req.body.userId || "");
    if (!otherUserId || otherUserId === user.id) {
      res.status(400).json({ error: "Choose another user." });
      return;
    }

    const { data: otherUser, error: otherError } = await db
      .from("app_users")
      .select("id")
      .eq("id", otherUserId)
      .maybeSingle();

    if (otherError) throw otherError;
    if (!otherUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const { data: myMemberships, error: myError } = await db
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (myError) throw myError;

    const myIds = (myMemberships || []).map((m) => m.conversation_id);

    if (myIds.length) {
      const { data: shared, error: sharedError } = await db
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", otherUserId)
        .in("conversation_id", myIds);

      if (sharedError) throw sharedError;

      if (shared?.length) {
        const { data: existing, error: existingError } = await db
          .from("conversations")
          .select("id")
          .in(
            "id",
            shared.map((m) => m.conversation_id)
          )
          .eq("type", "direct")
          .limit(1)
          .maybeSingle();

        if (existingError) throw existingError;
        if (existing) {
          res.json({ conversationId: existing.id });
          return;
        }
      }
    }

    const { data: conversation, error: createError } = await db
      .from("conversations")
      .insert({
        type: "direct",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (createError) throw createError;

    const { error: addMembersError } = await db
      .from("conversation_members")
      .insert([
        { conversation_id: conversation.id, user_id: user.id },
        { conversation_id: conversation.id, user_id: otherUserId },
      ]);

    if (addMembersError) {
      await db.from("conversations").delete().eq("id", conversation.id);
      throw addMembersError;
    }

    res.status(201).json({ conversationId: conversation.id });
  } catch (error) {
    console.error("Create chat error:", error);
    res.status(500).json({ error: "Could not start conversation." });
  }
});

// SEND MESSAGE
app.post("/api/chats/:id/messages", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const conversationId = req.params.id;
    const body = String(req.body.body || "").trim();

    if (!body || body.length > 5000) {
      res.status(400).json({ error: "Message must be 1–5000 characters." });
      return;
    }

    const { data: membership, error: memberError } = await db
      .from("conversation_members")
      .select("conversation_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!membership) {
      res.status(403).json({ error: "You are not a member of this chat." });
      return;
    }

    const { data: message, error } = await db
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body,
      })
      .select("id, conversation_id, sender_id, body, created_at")
      .single();

    if (error) throw error;

    res.status(201).json({ message });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: "Could not send message." });
  }
});

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`NoChat server running on port ${PORT}`);
});