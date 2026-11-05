import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { Server } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

/* =========================================================
   NOCHAT — DENPHER TECHNOLOGIES
   Backend • Authentication • Profiles • Recommendations
   Real-time messaging • JSON persistence
========================================================= */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in .env");
}

const DB_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DB_DIR, "db.json");

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads", "profile");

fs.mkdirSync(DB_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* =========================================================
   DATABASE
========================================================= */

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      { users: [], conversations: [], messages: [] },
      null,
      2
    )
  );
}

let db;

try {
  db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
} catch {
  throw new Error("Database file is invalid. Check data/db.json.");
}

db.users ??= [];
db.conversations ??= [];
db.messages ??= [];

let saveQueue = Promise.resolve();

function saveDB() {
  saveQueue = saveQueue.then(async () => {
    const tempFile = `${DB_FILE}.tmp`;

    await fs.promises.writeFile(
      tempFile,
      JSON.stringify(db, null, 2),
      "utf8"
    );

    await fs.promises.rename(tempFile, DB_FILE);
  });

  return saveQueue;
}

/* =========================================================
   HELPERS
========================================================= */

const makeId = () => crypto.randomUUID();

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
}

function safeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    profilePicture: user.profilePicture || null,
    createdAt: user.createdAt
  };
}

function findConversation(userA, userB) {
  return db.conversations.find(conversation =>
    conversation.members.includes(userA) &&
    conversation.members.includes(userB)
  );
}

function createToken(user) {
  return jwt.sign(
    { sub: user.id },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function setSession(res, user) {
  res.cookie("nochat_session", createToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

function removeOldProfilePicture(profilePicture) {
  if (!profilePicture) return;

  const filename = path.basename(profilePicture);
  const filePath = path.join(UPLOAD_DIR, filename);

  if (!filename || !filePath.startsWith(UPLOAD_DIR)) return;

  fs.promises.unlink(filePath).catch(() => {});
}

/* =========================================================
   MIDDLEWARE
========================================================= */

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" }
  })
);

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(cookieParser());

app.use(
  express.static(PUBLIC_DIR, {
    index: "index.html",
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again later."
  }
});

app.use("/api", apiLimiter);

/* =========================================================
   AUTHENTICATION
========================================================= */

function authenticate(req, res, next) {
  try {
    const token = req.cookies.nochat_session;

    if (!token) {
      return res.status(401).json({
        error: "Please sign in to continue."
      });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const user = db.users.find(
      item => item.id === payload.sub
    );

    if (!user) {
      return res.status(401).json({
        error: "Account not found. Please sign in again."
      });
    }

    req.user = user;
    next();

  } catch {
    return res.status(401).json({
      error: "Your session has expired. Please sign in again."
    });
  }
}

/* =========================================================
   PROFILE IMAGE UPLOAD CONFIGURATION
========================================================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 1
  },

  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPG, PNG, WebP and GIF images are allowed.")
      );
    }

    callback(null, true);
  }
});

function detectImage(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return "png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  if (
    buffer.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))
  ) {
    return "gif";
  }

  return null;
}

const profileUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many profile picture uploads. Try again later."
  }
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (_req, res) => {
  res.json({
    status: "online",
    application: "NoChat",
    poweredBy: "Denpher Technologies",
    features: [
      "Authentication",
      "Profile pictures",
      "People recommendations",
      "Real-time messaging"
    ]
  });
});

/* =========================================================
   REGISTER
========================================================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || "");

    if (username.length < 3) {
      return res.status(400).json({
        error: "Username must contain at least 3 characters."
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        error: "Password must contain 8–128 characters."
      });
    }

    const exists = db.users.some(
      user => user.username === username
    );

    if (exists) {
      return res.status(409).json({
        error: "Username already exists."
      });
    }

    const user = {
      id: makeId(),
      username,
      passwordHash: await bcrypt.hash(password, 12),
      profilePicture: null,
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    await saveDB();

    setSession(res, user);

    res.status(201).json({
      user: safeUser(user)
    });

  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      error: "Registration failed. Please try again."
    });
  }
});

/* =========================================================
   LOGIN
========================================================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || "");

    const user = db.users.find(
      item => item.username === username
    );

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        error: "Invalid username or password."
      });
    }

    setSession(res, user);

    res.json({
      user: safeUser(user)
    });

  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "Login failed. Please try again."
    });
  }
});

/* =========================================================
   LOGOUT
========================================================= */

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("nochat_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  res.json({ success: true });
});

/* =========================================================
   CURRENT USER
========================================================= */

app.get("/api/me", authenticate, (req, res) => {
  res.json({
    user: safeUser(req.user)
  });
});

/* =========================================================
   PROFILE — UPLOAD PICTURE
========================================================= */

app.post(
  "/api/profile/avatar",
  authenticate,
  profileUploadLimiter,
  (req, res, next) => {
    upload.single("avatar")(req, res, error => {
      if (error) {
        if (error instanceof multer.MulterError) {
          if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
              error: "Image must be smaller than 3 MB."
            });
          }

          return res.status(400).json({
            error: "Please select one valid image."
          });
        }

        return res.status(400).json({
          error: error.message || "Image upload failed."
        });
      }

      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Please select an image first."
        });
      }

      const extension = detectImage(req.file.buffer);

      if (!extension) {
        return res.status(400).json({
          error: "The uploaded file is not a valid supported image."
        });
      }

      const filename = `${req.user.id}-${makeId()}.${extension}`;
      const destination = path.join(UPLOAD_DIR, filename);

      await fs.promises.writeFile(destination, req.file.buffer, {
        flag: "wx"
      });

      const oldPicture = req.user.profilePicture;

      req.user.profilePicture = `/uploads/profile/${filename}`;

      try {
        await saveDB();
      } catch (error) {
        await fs.promises.unlink(destination).catch(() => {});
        throw error;
      }

      if (oldPicture) {
        removeOldProfilePicture(oldPicture);
      }

      res.json({
        success: true,
        user: safeUser(req.user),
        profilePicture: req.user.profilePicture
      });

    } catch (error) {
      console.error("Profile upload error:", error);

      res.status(500).json({
        error: "Could not save your profile picture."
      });
    }
  }
);

/* =========================================================
   PROFILE — REMOVE PICTURE
========================================================= */

app.delete("/api/profile/avatar", authenticate, async (req, res) => {
  try {
    const oldPicture = req.user.profilePicture;

    req.user.profilePicture = null;

    await saveDB();

    if (oldPicture) {
      removeOldProfilePicture(oldPicture);
    }

    res.json({
      success: true,
      user: safeUser(req.user)
    });

  } catch (error) {
    console.error("Profile removal error:", error);

    res.status(500).json({
      error: "Could not remove your profile picture."
    });
  }
});

/* =========================================================
   USER SEARCH
========================================================= */

app.get("/api/users", authenticate, (req, res) => {
  const query = normalizeUsername(req.query.q);

  const users = db.users
    .filter(user =>
      user.id !== req.user.id &&
      user.username.includes(query)
    )
    .slice(0, 30)
    .map(safeUser);

  res.json({ users });
});

/* =========================================================
   PEOPLE YOU MAY KNOW
========================================================= */

app.get("/api/recommendations", authenticate, (req, res) => {
  const connectedUserIds = new Set();

  for (const conversation of db.conversations) {
    if (conversation.members.includes(req.user.id)) {
      for (const memberId of conversation.members) {
        if (memberId !== req.user.id) {
          connectedUserIds.add(memberId);
        }
      }
    }
  }

  const recommendations = db.users
    .filter(user =>
      user.id !== req.user.id &&
      !connectedUserIds.has(user.id)
    )
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(
        String(a.createdAt || "")
      )
    )
    .slice(0, 30)
    .map(safeUser);

  res.json({ users: recommendations });
});

/* =========================================================
   CREATE OR OPEN CONVERSATION
========================================================= */

app.post("/api/conversations", authenticate, async (req, res) => {
  try {
    const otherUser = db.users.find(
      user =>
        user.id === req.body.userId &&
        user.id !== req.user.id
    );

    if (!otherUser) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    let conversation = findConversation(
      req.user.id,
      otherUser.id
    );

    if (!conversation) {
      conversation = {
        id: makeId(),
        members: [req.user.id, otherUser.id],
        createdAt: new Date().toISOString()
      };

      db.conversations.push(conversation);
      await saveDB();
    }

    res.json({
      conversation,
      user: safeUser(otherUser)
    });

  } catch (error) {
    console.error("Conversation error:", error);

    res.status(500).json({
      error: "Could not open this conversation."
    });
  }
});

/* =========================================================
   CONVERSATION LIST
========================================================= */

app.get("/api/conversations", authenticate, (req, res) => {
  const conversations = db.conversations
    .filter(conversation =>
      conversation.members.includes(req.user.id)
    )
    .map(conversation => {
      const otherId = conversation.members.find(
        id => id !== req.user.id
      );

      const otherUser = db.users.find(
        user => user.id === otherId
      );

      const lastMessage = db.messages
        .filter(message =>
          message.conversationId === conversation.id
        )
        .at(-1);

      return {
        id: conversation.id,
        user: safeUser(otherUser),
        lastMessage: lastMessage?.text || "",
        lastAt: lastMessage?.createdAt || conversation.createdAt
      };
    })
    .filter(conversation => conversation.user)
    .sort((a, b) =>
      String(b.lastAt).localeCompare(String(a.lastAt))
    );

  res.json({ conversations });
});

/* =========================================================
   MESSAGE HISTORY
========================================================= */

app.get(
  "/api/conversations/:id/messages",
  authenticate,
  (req, res) => {
    const conversation = db.conversations.find(
      item =>
        item.id === req.params.id &&
        item.members.includes(req.user.id)
    );

    if (!conversation) {
      return res.status(404).json({
        error: "Conversation not found."
      });
    }

    const messages = db.messages
      .filter(message =>
        message.conversationId === conversation.id
      )
      .slice(-150);

    res.json({ messages });
  }
);

/* =========================================================
   SOCKET.IO AUTHENTICATION
========================================================= */

io.use((socket, next) => {
  try {
    const cookies = socket.handshake.headers.cookie || "";

    const cookie = cookies
      .split(";")
      .map(item => item.trim())
      .find(item =>
        item.startsWith("nochat_session=")
      );

    const token = cookie
      ? decodeURIComponent(
          cookie.substring("nochat_session=".length)
        )
      : "";

    const payload = jwt.verify(token, JWT_SECRET);

    const user = db.users.find(
      item => item.id === payload.sub
    );

    if (!user) {
      return next(new Error("Unauthorized"));
    }

    socket.user = user;
    next();

  } catch {
    next(new Error("Unauthorized"));
  }
});

/* =========================================================
   REAL-TIME MESSAGING & PRESENCE
========================================================= */

const onlineUsers = new Map();

io.on("connection", socket => {
  const userId = socket.user.id;

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socket.id);
  socket.join(`user:${userId}`);

  io.emit("presence:update", {
    userId,
    online: true
  });

  /* JOIN CONVERSATION */

  socket.on("conversation:join", conversationId => {
    const id = String(conversationId || "");

    const conversation = db.conversations.find(item =>
      item.id === id &&
      item.members.includes(userId)
    );

    if (conversation) {
      socket.join(`conversation:${id}`);
    }
  });

  /* SEND MESSAGE */

  socket.on("message:send", async (payload = {}, callback) => {
    const acknowledge = typeof callback === "function"
      ? callback
      : () => {};

    try {
      const conversationId = String(
        payload.conversationId || ""
      );

      const messageText = String(
        payload.text ?? payload.content ?? ""
      ).trim();

      const conversation = db.conversations.find(item =>
        item.id === conversationId &&
        item.members.includes(userId)
      );

      if (!conversation) {
        return acknowledge({
          error: "Invalid conversation."
        });
      }

      if (!messageText || messageText.length > 2000) {
        return acknowledge({
          error: "Message must be 1–2000 characters."
        });
      }

      const message = {
        id: makeId(),
        conversationId,
        senderId: userId,
        senderUsername: socket.user.username,
        text: messageText,
        createdAt: new Date().toISOString()
      };

      db.messages.push(message);
      await saveDB();

      io.to(`conversation:${conversationId}`).emit(
        "message:new",
        message
      );

      conversation.members
        .filter(memberId => memberId !== userId)
        .forEach(memberId => {
          io.to(`user:${memberId}`).emit(
            "conversation:update",
            { conversationId }
          );
        });

      acknowledge({
        success: true,
        message
      });

    } catch (error) {
      console.error("Message error:", error);

      acknowledge({
        error: "Message could not be sent."
      });
    }
  });

  /* DISCONNECT */

  socket.on("disconnect", () => {
    const sockets = onlineUsers.get(userId);

    if (!sockets) return;

    sockets.delete(socket.id);

    if (sockets.size === 0) {
      onlineUsers.delete(userId);

      io.emit("presence:update", {
        userId,
        online: false
      });
    }
  });
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((error, _req, res, _next) => {
  console.error("Server error:", error);

  if (res.headersSent) return;

  res.status(500).json({
    error: "Internal server error."
  });
});

/* =========================================================
   START SERVER
========================================================= */

server.listen(PORT, () => {
  console.log("");
  console.log("====================================");
  console.log("          NOCHAT SERVER");
  console.log("====================================");
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log("  Status:   Online");
  console.log("  Profiles: Enabled");
  console.log("  Realtime: Enabled");
  console.log("  Company:  Denpher Technologies");
  console.log("====================================");
  console.log("");
});