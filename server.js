import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { Server } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

/* =========================================================
   NOCHAT — NEXT-GEN SOCIAL & REELS ENGINE
   Privacy is our first policy • Powered by Denpher
   Self-Hosted Backend • 100% Cloud-Free • Vercel Ready
========================================================= */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map(s => s.trim()) : true,
    credentials: true
  },
  pingInterval: 25000,
  pingTimeout: 20000
});

const PORT = Number(process.env.PORT) || 5000;
let JWT_SECRET = process.env.JWT_SECRET || "";
const IS_PROD = process.env.NODE_ENV === "production";
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.NOW_REGION);

// STRICT OFFICIAL DENPHER CREDENTIALS (ONLY DENPHER GETS VERIFIED TICK)
const DENPHER_EMAIL = "denpherai@gmail.com";
const DENPHER_USERNAME = "denpher";

// Support both local storage and Vercel serverless /tmp fallback
// DATA_DIR / UPLOADS_DIR let you point storage at a persistent disk (Render disk, Railway volume, VPS folder).
const DB_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : (IS_VERCEL ? path.join("/tmp", "nochat_data") : path.join(__dirname, "data"));
const DB_FILE = path.join(DB_DIR, "db.json");

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : (IS_VERCEL ? path.join("/tmp", "uploads") : path.join(PUBLIC_DIR, "uploads"));
const LEGACY_UPLOADS_ROOT = path.join(PUBLIC_DIR, "uploads");
const UPLOAD_PROFILE_DIR = path.join(UPLOADS_ROOT, "profile");
const UPLOAD_REELS_DIR = path.join(UPLOADS_ROOT, "reels");

try {
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_PROFILE_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_REELS_DIR, { recursive: true });
} catch {
  // Directory creation fallback
}

// If no JWT_SECRET is configured, generate one and keep it in the data folder so
// sessions survive restarts. Never ship a hardcoded secret.
if (!JWT_SECRET) {
  const secretFile = path.join(DB_DIR, ".jwt-secret");
  try {
    JWT_SECRET = fs.readFileSync(secretFile, "utf8").trim();
  } catch {
    JWT_SECRET = "";
  }
  if (!JWT_SECRET) {
    JWT_SECRET = crypto.randomBytes(48).toString("hex");
    try { fs.writeFileSync(secretFile, JWT_SECRET, { mode: 0o600 }); } catch { /* read-only fs */ }
    if (IS_VERCEL || IS_PROD) {
      console.error("[NoChat] WARNING: JWT_SECRET is not set. Set it in your environment so sessions stay valid across instances.");
    }
  }
}

/* =========================================================
   CURATED TRENDING AUDIO TRACKS CATALOG (SEARCHABLE)
========================================================= */

const TRENDING_AUDIO = [
  { id: "audio-1", title: "Cyberpunk Night Drive", artist: "Denpher Beats", duration: "0:30", url: "/audio/track-1.mp3", category: "Trending" },
  { id: "audio-2", title: "Neon Skyline Synthwave", artist: "Future Sounds", duration: "0:45", url: "/audio/track-2.mp3", category: "Synthwave" },
  { id: "audio-3", title: "Midnight Lo-Fi Chill", artist: "Lo-Fi Dreamer", duration: "0:35", url: "/audio/track-3.mp3", category: "Lo-Fi" },
  { id: "audio-4", title: "Phonk Drift 2026", artist: "Underground Phonk", duration: "0:28", url: "/audio/track-4.mp3", category: "Phonk" },
  { id: "audio-5", title: "Viral Reels Energy", artist: "Beat Drop Nation", duration: "0:32", url: "/audio/track-5.mp3", category: "Viral" },
  { id: "audio-6", title: "Privacy First (Founder Anthem)", artist: "Denpher", duration: "0:40", url: "/audio/track-6.mp3", category: "Denpher Special" },
  { id: "audio-7", title: "Futuristic Bassline", artist: "Sub Zero", duration: "0:33", url: "/audio/track-7.mp3", category: "EDM" },
  { id: "audio-8", title: "Soulful Sunset Guitar", artist: "Acoustic Sunset", duration: "0:38", url: "/audio/track-8.mp3", category: "Chill" }
];

/* =========================================================
   DATABASE PERSISTENCE & DENPHER OFFICIAL ACCOUNT
========================================================= */

const initialSchema = {
  users: [],
  subscriptions: [],
  friends: [],
  friendRequests: [],
  reels: [],
  reelLikes: [],
  reelComments: [],
  conversations: [],
  messages: []
};

let db = { ...initialSchema };
const localSeedFile = path.join(__dirname, "data", "db.json");

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    db = { ...initialSchema };
  }
} else if (fs.existsSync(localSeedFile)) {
  try {
    db = JSON.parse(fs.readFileSync(localSeedFile, "utf8"));
  } catch {
    db = { ...initialSchema };
  }
}

db.users ??= [];
db.subscriptions ??= [];
db.friends ??= [];
db.friendRequests ??= [];
db.reels ??= [];
db.reelLikes ??= [];
db.reelComments ??= [];
db.conversations ??= [];
db.messages ??= [];

// Ensure Official Denpher Account exists & is the ONLY verified account
let denpher = db.users.find(
  u => (u.email && u.email.toLowerCase() === DENPHER_EMAIL) ||
       (u.username && u.username.toLowerCase() === DENPHER_USERNAME)
);

if (denpher) {
  denpher.email = DENPHER_EMAIL;
  denpher.username = DENPHER_USERNAME;
  denpher.displayName = "Denpher";
  denpher.isVerified = true;
  denpher.role = "Founder & Official Creator";
  denpher.bio = "Founder of NoChat & Denpher Technologies ⚡ Privacy is our first policy.";
} else {
  denpher = {
    id: "denpher-official-founder-id",
    email: DENPHER_EMAIL,
    username: DENPHER_USERNAME,
    displayName: "Denpher",
    role: "Founder & Official Creator",
    bio: "Founder of NoChat & Denpher Technologies ⚡ Privacy is our first policy.",
    profilePicture: null,
    isVerified: true,
    soundEnabled: true,
    createdAt: new Date().toISOString()
  };
  db.users.unshift(denpher);
}

// Optional: lock the founder account with a password from the environment
if (process.env.FOUNDER_PASSWORD && !denpher.passwordHash) {
  denpher.passwordHash = bcrypt.hashSync(String(process.env.FOUNDER_PASSWORD), 10);
}

// No dummy reels seeded - real user reels only

// Ensure no other user mistakenly has isVerified = true
db.users.forEach(u => {
  if (u.id !== denpher.id && u.username !== DENPHER_USERNAME && u.email !== DENPHER_EMAIL) {
    u.isVerified = false;
  }
});

let saveQueue = Promise.resolve();
function saveDB() {
  saveQueue = saveQueue.then(async () => {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      await fs.promises.writeFile(tempFile, JSON.stringify(db, null, 2), "utf8");
      await fs.promises.rename(tempFile, DB_FILE);
    } catch {
      // In-memory fallback on Vercel lambda
    }
  }).catch(() => {});
  return saveQueue;
}

saveDB();

/* =========================================================
   HELPERS & SAFE USER TRANSFORMATION
========================================================= */

const makeId = () => crypto.randomUUID();

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function isUserDenpher(user) {
  if (!user) return false;
  const email = String(user.email || "").toLowerCase().trim();
  const username = String(user.username || "").toLowerCase().trim();
  return email === DENPHER_EMAIL || username === DENPHER_USERNAME;
}

function safeUser(user, currentUserId = null) {
  if (!user) return null;

  const isSelf = Boolean(currentUserId && user.id === currentUserId);
  const isVerified = isUserDenpher(user);
  const subscribersCount = db.subscriptions.filter(s => s.creatorId === user.id).length;
  const isSubscribed = currentUserId
    ? db.subscriptions.some(s => s.creatorId === user.id && s.subscriberId === currentUserId)
    : false;

  const safe = {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    bio: user.bio || "",
    role: isVerified ? "Founder & Official Creator" : "Member",
    profilePicture: user.profilePicture || null,
    isVerified, // STRICTLY TRUE FOR DENPHER ONLY (denpherai@gmail.com / denpher)
    subscribersCount,
    isSubscribed,
    createdAt: user.createdAt,
    soundEnabled: user.soundEnabled !== false
  };

  // 100% STRICT PRIVACY: User email is ONLY returned to the user themselves, NEVER to others!
  if (isSelf && user.email) {
    safe.email = user.email;
  }

  return safe;
}

function createToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
}

const SESSION_DAYS = 365;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60 * 1000;
function isSecureRequest(req) {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return Boolean(req && (req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https"));
}

function setSession(res, user) {
  // Local (http): secure=false, sameSite=lax
  // Vercel / production (https): secure=true, sameSite=lax
  const isHttps = isSecureRequest(res.req);
  res.cookie("nochat_session", createToken(user), {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE, // 1 year, renewed daily while active
    path: "/"
  });
}

function clearSession(res) {
  const isHttps = isSecureRequest(res.req);
  res.clearCookie("nochat_session", {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/"
  });
}

function authenticate(req, res, next) {
  try {
    const token = req.cookies?.nochat_session;
    if (!token) {
      return res.status(401).json({ error: "Please sign in to continue.", code: "AUTH_REQUIRED" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.users.find(u => u.id === payload.sub);

    if (!user) {
      return res.status(401).json({ error: "Please sign in to continue.", code: "AUTH_REQUIRED" });
    }

    req.user = user;
    // Sliding session: active users get a fresh 30-day cookie once a day,
    // so they are never logged out while using the app.
    if (payload.iat && Date.now() / 1000 - payload.iat > 24 * 60 * 60) {
      setSession(res, user);
    }
    next();
  } catch {
    clearSession(res);
    return res.status(401).json({ error: "Please sign in to continue.", code: "AUTH_REQUIRED" });
  }
}

/* =========================================================
   MULTER CONFIGURATION (LOCAL FILE STORAGE)
========================================================= */

const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_PROFILE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const filename = `${req.user.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    cb(null, filename);
  }
});

const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, WebP, and GIF images are allowed."));
    }
  }
});

const reelsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_REELS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    const filename = `reel-${req.user.id}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, filename);
  }
});

const uploadReel = multer({
  storage: reelsStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-matroska",
      "video/ogg"
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(file.mimetype) || [".mp4", ".webm", ".mov", ".mkv"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only MP4, WebM, and MOV videos are supported."));
    }
  }
});

/* =========================================================
   MIDDLEWARE & STATIC ASSETS
========================================================= */

app.disable("x-powered-by");
// Render / Railway / Vercel / Nginx terminate HTTPS in front of Node.
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(cookieParser());

app.use(express.static(PUBLIC_DIR, { index: "index.html" }));

// Uploaded files: persistent folder first, then any files that already live in public/uploads.
app.use("/uploads", express.static(UPLOADS_ROOT, { maxAge: "7d" }));
if (LEGACY_UPLOADS_ROOT !== UPLOADS_ROOT) {
  app.use("/uploads", express.static(LEGACY_UPLOADS_ROOT, { maxAge: "7d" }));
}

// Fallback for the Socket.IO browser client (avoids "MIME type text/html" errors when
// the Socket.IO engine is not attached, e.g. on Vercel serverless).
const SOCKET_CLIENT_FILE = path.join(__dirname, "node_modules", "socket.io", "client-dist", "socket.io.min.js");
app.get("/socket.io/socket.io.js", (_req, res, next) => {
  if (!fs.existsSync(SOCKET_CLIENT_FILE)) return next();
  res.type("application/javascript").sendFile(SOCKET_CLIENT_FILE);
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." }
});
app.use("/api", apiLimiter);

/* =========================================================
   HEALTH CHECK & BRAND POLICIES
========================================================= */

app.get("/api/health", (_req, res) => {
  res.json({
    status: "online",
    name: "NoChat",
    poweredBy: "Denpher — Websites for small businesses",
    poweredByUrl: "https://denpher-portfolio-6xe8.vercel.app/",
    privacyPolicy: "Privacy is our first policy",
    officialFounder: DENPHER_EMAIL,
    usersCount: db.users.length,
    persistentStorage: !IS_VERCEL || Boolean(process.env.DATA_DIR),
    reelsCount: db.reels.length
  });
});

/* =========================================================
   AUDIO & SONG SEARCH ENDPOINT
========================================================= */

app.get("/api/audio/search", (_req, res) => {
  const q = String(_req.query.q || "").toLowerCase().trim();
  if (!q) {
    return res.json({ tracks: TRENDING_AUDIO });
  }
  const filtered = TRENDING_AUDIO.filter(t =>
    t.title.toLowerCase().includes(q) ||
    t.artist.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q)
  );
  return res.json({ tracks: filtered });
});

/* =========================================================
   AUTH: CREATE ACCOUNT / SIGN IN (PASSWORD PROTECTED)
   Accounts created by the old password-free version have no
   password yet: the first sign-in saves the password they type.
========================================================= */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please wait a few minutes." }
});
app.use("/api/auth", authLimiter);

const MIN_PASSWORD = 6;

function findUserByIdentifier(identifier) {
  const clean = String(identifier || "").trim().toLowerCase();
  if (!clean) return null;
  const asUsername = normalizeUsername(clean.replace(/^@/, ""));
  return db.users.find(
    u => (u.email && u.email.toLowerCase() === clean) ||
         (u.username && u.username.toLowerCase() === asUsername)
  ) || null;
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const displayName = String(req.body.displayName || "").trim().slice(0, 50);

    if (!username || username.length < 3) {
      return res.status(400).json({ error: "Usernames need at least 3 letters, numbers or underscores." });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "That email address doesn't look right." });
    }
    if (password.length < MIN_PASSWORD) {
      return res.status(400).json({ error: `Passwords need at least ${MIN_PASSWORD} characters.` });
    }
    if (username === DENPHER_USERNAME || email === DENPHER_EMAIL) {
      return res.status(409).json({ error: "That account already exists. Sign in instead." });
    }
    if (db.users.some(u => u.username === username)) {
      return res.status(409).json({ error: "That username is taken. Try another one." });
    }
    if (email && db.users.some(u => u.email && u.email.toLowerCase() === email)) {
      return res.status(409).json({ error: "An account with that email already exists. Sign in instead." });
    }

    const newUser = {
      id: makeId(),
      email: email || null,
      username,
      displayName: displayName.length >= 2 ? displayName : username,
      bio: "",
      profilePicture: null,
      isVerified: false,
      soundEnabled: true,
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    await saveDB();

    setSession(res, newUser);
    return res.status(201).json({ success: true, user: safeUser(newUser, newUser.id), message: "Welcome to NoChat!" });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Could not create your account. Try again." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.username || req.body.email || "").trim();
    const password = String(req.body.password || "");

    if (!identifier) {
      return res.status(400).json({ error: "Enter your username or email." });
    }
    if (!password) {
      return res.status(400).json({ error: "Enter your password." });
    }

    const user = findUserByIdentifier(identifier);
    if (!user) {
      return res.status(404).json({ error: "No account found with that username or email.", code: "NOT_FOUND" });
    }

    let message = "Welcome back!";
    if (user.passwordHash) {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: "Incorrect password." });
      }
    } else {
      // Legacy account from the password-free version: claim it with this password.
      if (password.length < MIN_PASSWORD) {
        return res.status(400).json({ error: `Your account needs a password now — choose one with at least ${MIN_PASSWORD} characters.` });
      }
      user.passwordHash = await bcrypt.hash(password, 10);
      await saveDB();
      message = "Password saved — use it next time you sign in.";
    }

    if (isUserDenpher(user)) user.isVerified = true;

    setSession(res, user);
    return res.json({ success: true, user: safeUser(user, user.id), message });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Sign in failed. Try again." });
  }
});

app.put("/api/account/password", authenticate, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    if (newPassword.length < MIN_PASSWORD) {
      return res.status(400).json({ error: `New password needs at least ${MIN_PASSWORD} characters.` });
    }
    if (req.user.passwordHash) {
      const ok = await bcrypt.compare(currentPassword, req.user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Your current password is incorrect." });
    }
    req.user.passwordHash = await bcrypt.hash(newPassword, 10);
    await saveDB();
    return res.json({ success: true, message: "Password updated." });
  } catch (error) {
    console.error("Password change error:", error);
    return res.status(500).json({ error: "Could not update password." });
  }
});

app.get("/api/me", authenticate, (req, res) => {
  const currentUserId = req.user.id;

  const friendsCount = db.friends.filter(
    f => f.userA === currentUserId || f.userB === currentUserId
  ).length;

  const pendingRequestsCount = db.friendRequests.filter(
    r => r.toId === currentUserId
  ).length;

  const reelsCount = db.reels.filter(r => r.userId === currentUserId).length;
  const subscribersCount = db.subscriptions.filter(s => s.creatorId === currentUserId).length;
  const unreadMessagesCount = db.conversations
    .filter(c => c.members.includes(currentUserId))
    .reduce((sum, c) => sum + unreadCountFor(c, currentUserId), 0);

  return res.json({
    user: { ...safeUser(req.user, currentUserId), hasPassword: Boolean(req.user.passwordHash) },
    stats: {
      friendsCount,
      subscribersCount,
      pendingRequestsCount,
      reelsCount,
      unreadMessagesCount
    }
  });
});

app.post("/api/auth/logout", (_req, res) => {
  clearSession(res);
  return res.json({ success: true, message: "Logged out successfully." });
});

/* =========================================================
   USER SETTINGS & PROFILE MANAGEMENT
========================================================= */

app.put("/api/profile", authenticate, async (req, res) => {
  try {
    const { displayName, bio, soundEnabled } = req.body || {};

    if (displayName !== undefined) {
      const cleanName = String(displayName).trim().slice(0, 50);
      if (cleanName.length >= 2) {
        req.user.displayName = cleanName;
      }
    }

    if (bio !== undefined) {
      req.user.bio = String(bio).trim().slice(0, 200);
    }

    if (soundEnabled !== undefined) {
      req.user.soundEnabled = Boolean(soundEnabled);
    }

    await saveDB();
    return res.json({ success: true, user: safeUser(req.user, req.user.id) });
  } catch (error) {
    console.error("Profile update error:", error);
    return res.status(500).json({ error: "Failed to update profile." });
  }
});

app.post("/api/profile/avatar", authenticate, uploadProfile.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please choose an image file." });
    }

    const oldPicture = req.user.profilePicture;
    const newRelativePath = `/uploads/profile/${req.file.filename}`;
    req.user.profilePicture = newRelativePath;

    await saveDB();

    if (oldPicture && oldPicture.startsWith("/uploads/profile/")) {
      const oldFilename = path.basename(oldPicture);
      const oldPath = path.join(UPLOAD_PROFILE_DIR, oldFilename);
      fs.promises.unlink(oldPath).catch(() => {});
    }

    return res.json({ success: true, user: safeUser(req.user, req.user.id) });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return res.status(500).json({ error: "Could not upload profile picture." });
  }
});

app.delete("/api/profile/avatar", authenticate, async (req, res) => {
  try {
    const oldPicture = req.user.profilePicture;
    req.user.profilePicture = null;
    await saveDB();

    if (oldPicture && oldPicture.startsWith("/uploads/profile/")) {
      const oldFilename = path.basename(oldPicture);
      const oldPath = path.join(UPLOAD_PROFILE_DIR, oldFilename);
      fs.promises.unlink(oldPath).catch(() => {});
    }

    return res.json({ success: true, user: safeUser(req.user, req.user.id) });
  } catch (error) {
    console.error("Avatar delete error:", error);
    return res.status(500).json({ error: "Could not remove profile picture." });
  }
});

/* =========================================================
   SUBSCRIBERS SYSTEM (FOLLOW / SUBSCRIBE TO CREATOR)
========================================================= */

app.post("/api/users/:userId/subscribe", authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: "You cannot subscribe to yourself." });
    }

    const targetUser = db.users.find(u => u.id === targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const subIndex = db.subscriptions.findIndex(
      s => s.creatorId === targetUserId && s.subscriberId === currentUserId
    );

    let isSubscribed = false;

    if (subIndex !== -1) {
      db.subscriptions.splice(subIndex, 1);
      isSubscribed = false;
    } else {
      db.subscriptions.push({
        id: makeId(),
        subscriberId: currentUserId,
        creatorId: targetUserId,
        createdAt: new Date().toISOString()
      });
      isSubscribed = true;

      io.to(`user:${targetUserId}`).emit("user:subscribed", {
        subscriber: safeUser(req.user, targetUserId)
      });
    }

    await saveDB();

    const subscribersCount = db.subscriptions.filter(s => s.creatorId === targetUserId).length;

    return res.json({
      success: true,
      isSubscribed,
      subscribersCount
    });
  } catch (error) {
    console.error("Subscribe error:", error);
    return res.status(500).json({ error: "Failed to update subscription." });
  }
});

/* =========================================================
   FRIENDS SYSTEM: REQUESTS, ACCEPT, UNFRIEND, SEARCH
========================================================= */

function areFriends(userA, userB) {
  return db.friends.some(
    f => (f.userA === userA && f.userB === userB) ||
         (f.userA === userB && f.userB === userA)
  );
}

function getFriendshipStatus(myId, targetId) {
  if (myId === targetId) return "self";
  if (areFriends(myId, targetId)) return "friend";

  const outgoing = db.friendRequests.find(r => r.fromId === myId && r.toId === targetId);
  if (outgoing) return "pending_outgoing";

  const incoming = db.friendRequests.find(r => r.fromId === targetId && r.toId === myId);
  if (incoming) return "pending_incoming";

  return "none";
}

app.get("/api/friends", authenticate, (req, res) => {
  const currentUserId = req.user.id;

  const friendIds = db.friends
    .filter(f => f.userA === currentUserId || f.userB === currentUserId)
    .map(f => (f.userA === currentUserId ? f.userB : f.userA));

  const friends = friendIds
    .map(id => db.users.find(u => u.id === id))
    .filter(Boolean)
    .map(u => ({
      ...safeUser(u, currentUserId),
      isOnline: onlineUsers.has(u.id)
    }));

  return res.json({ friends });
});

app.get("/api/friends/requests", authenticate, (req, res) => {
  const currentUserId = req.user.id;

  const incoming = db.friendRequests
    .filter(r => r.toId === currentUserId)
    .map(r => {
      const fromUser = db.users.find(u => u.id === r.fromId);
      return {
        id: r.id,
        user: safeUser(fromUser, currentUserId),
        createdAt: r.createdAt
      };
    })
    .filter(r => r.user);

  const outgoing = db.friendRequests
    .filter(r => r.fromId === currentUserId)
    .map(r => {
      const toUser = db.users.find(u => u.id === r.toId);
      return {
        id: r.id,
        user: safeUser(toUser, currentUserId),
        createdAt: r.createdAt
      };
    })
    .filter(r => r.user);

  return res.json({ incoming, outgoing });
});

app.post("/api/friends/request", authenticate, async (req, res) => {
  try {
    const targetUserId = String(req.body.userId || "").trim();
    const currentUserId = req.user.id;

    if (!targetUserId || targetUserId === currentUserId) {
      return res.status(400).json({ error: "Invalid target user." });
    }

    const targetUser = db.users.find(u => u.id === targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    if (areFriends(currentUserId, targetUserId)) {
      return res.status(400).json({ error: "You are already friends with this user." });
    }

    const reverseReq = db.friendRequests.find(r => r.fromId === targetUserId && r.toId === currentUserId);
    if (reverseReq) {
      db.friendRequests = db.friendRequests.filter(r => r.id !== reverseReq.id);
      db.friends.push({
        id: makeId(),
        userA: currentUserId,
        userB: targetUserId,
        createdAt: new Date().toISOString()
      });
      await saveDB();

      io.to(`user:${targetUserId}`).emit("friend:accepted", { user: safeUser(req.user, targetUserId) });
      return res.json({ success: true, status: "friend", message: "Connected as friends!" });
    }

    const existingReq = db.friendRequests.find(r => r.fromId === currentUserId && r.toId === targetUserId);
    if (existingReq) {
      return res.status(400).json({ error: "Friend request already sent." });
    }

    const newRequest = {
      id: makeId(),
      fromId: currentUserId,
      toId: targetUserId,
      createdAt: new Date().toISOString()
    };

    db.friendRequests.push(newRequest);
    await saveDB();

    io.to(`user:${targetUserId}`).emit("friend:request", {
      id: newRequest.id,
      fromUser: safeUser(req.user, targetUserId)
    });

    return res.status(201).json({ success: true, status: "pending_outgoing", message: "Friend request sent!" });
  } catch (error) {
    console.error("Friend request error:", error);
    return res.status(500).json({ error: "Failed to send friend request." });
  }
});

app.post("/api/friends/accept/:requestId", authenticate, async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.user.id;

    const requestIndex = db.friendRequests.findIndex(r => r.id === requestId && r.toId === currentUserId);
    if (requestIndex === -1) {
      return res.status(404).json({ error: "Friend request not found." });
    }

    const request = db.friendRequests[requestIndex];
    const sender = db.users.find(u => u.id === request.fromId);

    db.friendRequests.splice(requestIndex, 1);

    if (!areFriends(currentUserId, request.fromId)) {
      db.friends.push({
        id: makeId(),
        userA: currentUserId,
        userB: request.fromId,
        createdAt: new Date().toISOString()
      });
    }

    await saveDB();

    io.to(`user:${request.fromId}`).emit("friend:accepted", { user: safeUser(req.user, request.fromId) });

    return res.json({ success: true, friend: safeUser(sender, currentUserId) });
  } catch (error) {
    console.error("Accept friend error:", error);
    return res.status(500).json({ error: "Could not accept request." });
  }
});

app.post("/api/friends/reject/:requestId", authenticate, async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.user.id;

    const requestIndex = db.friendRequests.findIndex(
      r => r.id === requestId && (r.toId === currentUserId || r.fromId === currentUserId)
    );

    if (requestIndex === -1) {
      return res.status(404).json({ error: "Friend request not found." });
    }

    db.friendRequests.splice(requestIndex, 1);
    await saveDB();

    return res.json({ success: true, message: "Friend request removed." });
  } catch (error) {
    console.error("Reject friend error:", error);
    return res.status(500).json({ error: "Could not remove request." });
  }
});

app.delete("/api/friends/:friendUserId", authenticate, async (req, res) => {
  try {
    const { friendUserId } = req.params;
    const currentUserId = req.user.id;

    const initialCount = db.friends.length;
    db.friends = db.friends.filter(
      f => !((f.userA === currentUserId && f.userB === friendUserId) ||
             (f.userA === friendUserId && f.userB === currentUserId))
    );

    if (db.friends.length === initialCount) {
      return res.status(404).json({ error: "Friendship not found." });
    }

    await saveDB();
    io.to(`user:${friendUserId}`).emit("friend:removed", { userId: currentUserId });
    return res.json({ success: true, message: "Unfriended successfully." });
  } catch (error) {
    console.error("Unfriend error:", error);
    return res.status(500).json({ error: "Failed to remove friend." });
  }
});

app.get("/api/users/search", authenticate, (req, res) => {
  const query = normalizeUsername(req.query.q);
  const currentUserId = req.user.id;

  if (!query || query.length < 1) {
    return res.json({ users: [] });
  }

  const matches = db.users
    .filter(u => u.id !== currentUserId && (
      u.username.includes(query) ||
      (u.displayName && u.displayName.toLowerCase().includes(query))
    ))
    .slice(0, 25)
    .map(u => ({
      ...safeUser(u, currentUserId),
      friendshipStatus: getFriendshipStatus(currentUserId, u.id),
      isOnline: onlineUsers.has(u.id)
    }));

  return res.json({ users: matches });
});

app.get("/api/recommendations", authenticate, (req, res) => {
  const currentUserId = req.user.id;

  const candidates = db.users
    .filter(u => u.id !== currentUserId && !areFriends(currentUserId, u.id))
    .slice(0, 20)
    .map(u => ({
      ...safeUser(u, currentUserId),
      friendshipStatus: getFriendshipStatus(currentUserId, u.id),
      isOnline: onlineUsers.has(u.id)
    }));

  return res.json({ users: candidates });
});

app.get("/api/users/profile/:userId", authenticate, (req, res) => {
  const targetUser = db.users.find(u => u.id === req.params.userId);
  if (!targetUser) {
    return res.status(404).json({ error: "User not found." });
  }

  const friendsCount = db.friends.filter(
    f => f.userA === targetUser.id || f.userB === targetUser.id
  ).length;

  const subscribersCount = db.subscriptions.filter(s => s.creatorId === targetUser.id).length;
  const isSubscribed = db.subscriptions.some(
    s => s.creatorId === targetUser.id && s.subscriberId === req.user.id
  );

  const userReels = db.reels
    .filter(r => r.userId === targetUser.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(r => formatReel(r, req.user.id));

  return res.json({
    user: safeUser(targetUser, req.user.id),
    friendshipStatus: getFriendshipStatus(req.user.id, targetUser.id),
    isOnline: onlineUsers.has(targetUser.id),
    isSubscribed,
    stats: {
      friendsCount,
      subscribersCount,
      reelsCount: userReels.length
    },
    reels: userReels
  });
});

/* =========================================================
   REELS SYSTEM: FEED, UPLOAD, LIKE, COMMENTS, DELETE
========================================================= */

function formatReel(reel, currentUserId) {
  const author = db.users.find(u => u.id === reel.userId);
  const likes = db.reelLikes.filter(l => l.reelId === reel.id);
  const commentsCount = db.reelComments.filter(c => c.reelId === reel.id).length;
  return {
    id: reel.id,
    userId: reel.userId,
    videoUrl: reel.videoUrl,
    caption: reel.caption || "",
    musicTitle: reel.musicTitle || "Original Audio",
    createdAt: reel.createdAt,
    user: safeUser(author, currentUserId),
    likesCount: likes.length,
    isLiked: likes.some(l => l.userId === currentUserId),
    commentsCount
  };
}

app.get("/api/reels", authenticate, (req, res) => {
  const currentUserId = req.user.id;

  const reels = db.reels
    .filter(reel => db.users.some(u => u.id === reel.userId))
    .map(reel => formatReel(reel, currentUserId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.json({ reels });
});

app.post("/api/reels", authenticate, uploadReel.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please choose a video file to upload." });
    }

    const caption = String(req.body.caption || "").trim().slice(0, 2200);
    const musicTitle = String(req.body.musicTitle || "").trim().slice(0, 80) || "Original Audio";

    const relativeUrl = `/uploads/reels/${req.file.filename}`;
    const newReel = {
      id: makeId(),
      userId: req.user.id,
      videoUrl: relativeUrl,
      caption,
      musicTitle,
      createdAt: new Date().toISOString()
    };

    db.reels.unshift(newReel);
    await saveDB();

    const formatted = {
      ...newReel,
      user: safeUser(req.user, req.user.id),
      likesCount: 0,
      isLiked: false,
      commentsCount: 0
    };

    io.emit("reel:new", formatted);

    return res.status(201).json({ success: true, reel: formatted });
  } catch (error) {
    console.error("Reel upload error:", error);
    return res.status(500).json({ error: "Failed to upload reel." });
  }
});

app.delete("/api/reels/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const reelIndex = db.reels.findIndex(r => r.id === id);

    if (reelIndex === -1) {
      return res.status(404).json({ error: "Reel not found." });
    }

    const reel = db.reels[reelIndex];
    if (reel.userId !== req.user.id) {
      return res.status(403).json({ error: "You can only delete your own reels." });
    }

    if (reel.videoUrl && reel.videoUrl.startsWith("/uploads/reels/")) {
      const filename = path.basename(reel.videoUrl);
      const filePath = path.join(UPLOAD_REELS_DIR, filename);
      fs.promises.unlink(filePath).catch(() => {});
    }

    db.reels.splice(reelIndex, 1);
    db.reelLikes = db.reelLikes.filter(l => l.reelId !== id);
    db.reelComments = db.reelComments.filter(c => c.reelId !== id);

    await saveDB();

    io.emit("reel:deleted", { id });
    return res.json({ success: true, message: "Reel deleted successfully." });
  } catch (error) {
    console.error("Delete reel error:", error);
    return res.status(500).json({ error: "Could not delete reel." });
  }
});

app.post("/api/reels/:id/like", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    const reel = db.reels.find(r => r.id === id);
    if (!reel) {
      return res.status(404).json({ error: "Reel not found." });
    }

    const likeIndex = db.reelLikes.findIndex(l => l.reelId === id && l.userId === currentUserId);
    let isLiked = false;

    if (likeIndex !== -1) {
      db.reelLikes.splice(likeIndex, 1);
      isLiked = false;
    } else {
      db.reelLikes.push({
        id: makeId(),
        reelId: id,
        userId: currentUserId,
        createdAt: new Date().toISOString()
      });
      isLiked = true;

      if (reel.userId !== currentUserId) {
        io.to(`user:${reel.userId}`).emit("reel:liked", {
          reelId: id,
          user: safeUser(req.user, reel.userId)
        });
      }
    }

    await saveDB();

    const likesCount = db.reelLikes.filter(l => l.reelId === id).length;
    io.emit("reel:like_update", { reelId: id, likesCount });

    return res.json({ success: true, isLiked, likesCount });
  } catch (error) {
    console.error("Like reel error:", error);
    return res.status(500).json({ error: "Failed to update like." });
  }
});

app.get("/api/reels/:id/comments", authenticate, (req, res) => {
  const { id } = req.params;

  const comments = db.reelComments
    .filter(c => c.reelId === id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(c => {
      const author = db.users.find(u => u.id === c.userId);
      return {
        id: c.id,
        reelId: c.reelId,
        content: c.content,
        createdAt: c.createdAt,
        user: safeUser(author, req.user.id)
      };
    });

  return res.json({ comments });
});

app.post("/api/reels/:id/comments", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const content = String(req.body.content || "").trim().slice(0, 1000);

    if (!content) {
      return res.status(400).json({ error: "Comment cannot be empty." });
    }

    const reel = db.reels.find(r => r.id === id);
    if (!reel) {
      return res.status(404).json({ error: "Reel not found." });
    }

    const newComment = {
      id: makeId(),
      reelId: id,
      userId: req.user.id,
      content,
      createdAt: new Date().toISOString()
    };

    db.reelComments.push(newComment);
    await saveDB();

    const formattedComment = {
      ...newComment,
      user: safeUser(req.user, req.user.id)
    };

    io.emit("reel:comment_new", { reelId: id, comment: formattedComment });

    return res.status(201).json({ success: true, comment: formattedComment });
  } catch (error) {
    console.error("Add comment error:", error);
    return res.status(500).json({ error: "Failed to post comment." });
  }
});

app.delete("/api/reels/:id/comments/:commentId", authenticate, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const commentIndex = db.reelComments.findIndex(c => c.id === commentId && c.reelId === id);

    if (commentIndex === -1) {
      return res.status(404).json({ error: "Comment not found." });
    }

    const comment = db.reelComments[commentIndex];
    const reel = db.reels.find(r => r.id === id);

    if (comment.userId !== req.user.id && reel?.userId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this comment." });
    }

    db.reelComments.splice(commentIndex, 1);
    await saveDB();

    io.emit("reel:comment_deleted", { reelId: id, commentId });
    return res.json({ success: true, message: "Comment deleted." });
  } catch (error) {
    console.error("Delete comment error:", error);
    return res.status(500).json({ error: "Failed to delete comment." });
  }
});

/* =========================================================
   CONVERSATIONS & REALTIME MESSAGING
========================================================= */

function unreadCountFor(conversation, userId) {
  const lastRead = conversation.lastRead?.[userId] || "";
  return db.messages.filter(
    m => m.conversationId === conversation.id && m.senderId !== userId && m.createdAt > lastRead
  ).length;
}

function markRead(conversation, userId) {
  conversation.lastRead ??= {};
  conversation.lastRead[userId] = new Date().toISOString();
}

function findConversation(userA, userB) {
  return db.conversations.find(
    c => c.members.includes(userA) && c.members.includes(userB)
  );
}

app.get("/api/conversations", authenticate, (req, res) => {
  const currentUserId = req.user.id;

  const convos = db.conversations
    .filter(c => c.members.includes(currentUserId))
    .map(c => {
      const otherId = c.members.find(id => id !== currentUserId);
      const otherUser = db.users.find(u => u.id === otherId);
      const lastMessage = db.messages
        .filter(m => m.conversationId === c.id)
        .at(-1);

      return {
        id: c.id,
        user: safeUser(otherUser, currentUserId),
        isOnline: Boolean(otherId && onlineUsers.has(otherId)),
        lastMessage: lastMessage ? lastMessage.text : "",
        lastMessageFromMe: Boolean(lastMessage && lastMessage.senderId === currentUserId),
        lastAt: lastMessage ? lastMessage.createdAt : c.createdAt,
        unreadCount: unreadCountFor(c, currentUserId)
      };
    })
    .filter(c => c.user)
    .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

  return res.json({ conversations: convos });
});

app.post("/api/conversations", authenticate, async (req, res) => {
  try {
    const targetUserId = String(req.body.userId || "").trim();
    const currentUserId = req.user.id;

    if (!targetUserId || targetUserId === currentUserId) {
      return res.status(400).json({ error: "Invalid target user." });
    }

    const targetUser = db.users.find(u => u.id === targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    let conversation = findConversation(currentUserId, targetUserId);
    if (!conversation) {
      conversation = {
        id: makeId(),
        members: [currentUserId, targetUserId],
        createdAt: new Date().toISOString()
      };
      db.conversations.push(conversation);
      await saveDB();
    }

    return res.json({
      conversation,
      user: safeUser(targetUser, currentUserId)
    });
  } catch (error) {
    console.error("Open conversation error:", error);
    return res.status(500).json({ error: "Could not open conversation." });
  }
});

app.get("/api/conversations/:id/messages", authenticate, (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user.id;

  const conversation = db.conversations.find(
    c => c.id === id && c.members.includes(currentUserId)
  );

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found." });
  }

  const messages = db.messages
    .filter(m => m.conversationId === id)
    .slice(-300);

  markRead(conversation, currentUserId);
  saveDB();

  return res.json({ messages });
});

app.post("/api/conversations/:id/read", authenticate, async (req, res) => {
  const conversation = db.conversations.find(
    c => c.id === req.params.id && c.members.includes(req.user.id)
  );
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found." });
  }
  markRead(conversation, req.user.id);
  await saveDB();
  return res.json({ success: true });
});

app.post("/api/conversations/:id/messages", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const text = String(req.body.text || req.body.content || "").trim().slice(0, 4000);

    if (!text) {
      return res.status(400).json({ error: "Message cannot be empty." });
    }

    const conversation = db.conversations.find(
      c => c.id === id && c.members.includes(currentUserId)
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const isVerifiedSender = isUserDenpher(req.user);

    const message = {
      id: makeId(),
      conversationId: id,
      senderId: currentUserId,
      senderUsername: req.user.username,
      senderDisplayName: req.user.displayName || req.user.username,
      isVerified: isVerifiedSender, // ONLY DENPHER
      text,
      createdAt: new Date().toISOString()
    };

    db.messages.push(message);
    await saveDB();

    io.to(`conversation:${id}`).emit("message:new", message);
    conversation.members
      .filter(mId => mId !== currentUserId)
      .forEach(mId => {
        io.to(`user:${mId}`).emit("conversation:update", { conversationId: id, message });
      });

    return res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({ error: "Failed to send message." });
  }
});

/* =========================================================
   SOCKET.IO REAL-TIME CHAT & PRESENCE
========================================================= */

const onlineUsers = new Map();

io.use((socket, next) => {
  try {
    const rawCookies = socket.handshake.headers.cookie || "";
    const cookie = rawCookies
      .split(";")
      .map(c => c.trim())
      .find(c => c.startsWith("nochat_session="));

    const token = cookie ? decodeURIComponent(cookie.substring("nochat_session=".length)) : "";
    if (!token) return next(new Error("Unauthorized"));

    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.users.find(u => u.id === payload.sub);

    if (!user) return next(new Error("Unauthorized"));

    socket.user = user;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", socket => {
  const userId = socket.user.id;

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);
  socket.join(`user:${userId}`);

  io.emit("presence:update", { userId, isOnline: true });

  socket.on("conversation:join", conversationId => {
    const id = String(conversationId || "");
    const conversation = db.conversations.find(
      c => c.id === id && c.members.includes(userId)
    );
    if (conversation) {
      socket.join(`conversation:${id}`);
    }
  });

  socket.on("typing:start", ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit("typing:active", {
      conversationId,
      userId,
      username: socket.user.username
    });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit("typing:inactive", {
      conversationId,
      userId
    });
  });

  socket.on("message:send", async (payload = {}, callback) => {
    const ack = typeof callback === "function" ? callback : () => {};

    try {
      const conversationId = String(payload.conversationId || "");
      const text = String(payload.text || payload.content || "").trim().slice(0, 4000);

      const conversation = db.conversations.find(
        c => c.id === conversationId && c.members.includes(userId)
      );

      if (!conversation || !text) {
        return ack({ error: "Invalid conversation or empty message." });
      }

      const isVerified = isUserDenpher(socket.user);

      const message = {
        id: makeId(),
        conversationId,
        senderId: userId,
        senderUsername: socket.user.username,
        senderDisplayName: socket.user.displayName || socket.user.username,
        isVerified,
        text,
        createdAt: new Date().toISOString()
      };

      db.messages.push(message);
      await saveDB();

      io.to(`conversation:${conversationId}`).emit("message:new", message);

      conversation.members
        .filter(mId => mId !== userId)
        .forEach(mId => {
          io.to(`user:${mId}`).emit("conversation:update", {
            conversationId,
            message
          });
        });

      ack({ success: true, message });
    } catch (err) {
      console.error("Socket message error:", err);
      ack({ error: "Could not send message." });
    }
  });

  socket.on("disconnect", () => {
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit("presence:update", { userId, isOnline: false });
      }
    }
  });
});

/* =========================================================
   ERROR HANDLER & SPA ROUTING
========================================================= */

app.use((err, _req, res, _next) => {
  console.error("Internal Server Error:", err);
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File exceeds maximum size (100MB)." });
    }
    return res.status(400).json({ error: err.message });
  }

  if (res.headersSent) return;
  res.status(500).json({ error: err.message || "Internal server error." });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* =========================================================
   START SERVER & EXPORT FOR VERCEL
========================================================= */

if (!IS_VERCEL && process.env.NODE_ENV !== "test") {
  server.listen(PORT, "0.0.0.0", () => {
    console.log("====================================================");
    console.log(`⚡ NoChat Social Engine is running at http://localhost:${PORT}`);
    console.log(`🛡️ Privacy is our first policy`);
    console.log(`✨ Powered by Denpher — Websites for small businesses`);
    console.log(`🚀 Official Verified Account: ${DENPHER_EMAIL} / @${DENPHER_USERNAME}`);
    console.log("====================================================");
  });
}

export default app;
