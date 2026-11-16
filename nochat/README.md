# NoChat v3.3.1

Premium dark social product — reels, private & group chats, Watch Party (official trailers), WebRTC calls with STUN/TURN.

**Design:** Obsidian dark (#0A0A0A), Electric Violet accent, Inter / Plus Jakarta Sans, Lucide icons only.

```
npm ci
npm test
npm start
```

Production requires `JWT_SECRET`, `NOCHAT_CLOUD_URL`, `NOCHAT_BRIDGE_SECRET`. See `DEPLOY.md`, `RELEASE-v3.3.md`, `TURN-SETUP.md`, `SECURITY.md`.

Landing, SPA shell, chat optimistic UI, full-screen reels, videos browse, profile and founder admin are in `public/`. Backend is the existing Express + Socket.IO engine.
