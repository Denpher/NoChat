# CHANGELOG

## v3.1
See RELEASE-v3.1.md: admin console with audit log, suspend/ban/restore/soft-delete, sign out
everywhere, server anti-spam with appeals, confidence-gated video moderation with logs, display-only
verified badge, real WebRTC video calls, white-and-purple redesign. Tests: `npm test` (33 passing).

## v3.0 — production fixes

No features, design or UI were removed or changed.

## server.js
- **Audio library**: all 8 tracks pointed to assets.mixkit.co links that now return 403.
  They now use bundled files `/audio/track-1.mp3 … track-8.mp3` (titles/artists unchanged).
- **Persistent storage**: new `DATA_DIR` and `UPLOADS_DIR` env vars point the database and
  uploads at a persistent disk. Default local paths are unchanged.
- **Uploads**: `/uploads/*` is always served from the uploads folder, with fallback to old
  files in `public/uploads/` (existing profile photos and reels keep working).
- **Sessions**: `trust proxy` enabled; cookie `secure` flag now follows the real HTTPS request
  (previously `NODE_ENV=production` over plain http silently dropped the cookie → logged out).
  Active users get their 30-day cookie renewed daily (sliding session). Invalid cookies are
  cleared. Missing `JWT_SECRET` in production is now logged as an error.
- **Socket.IO**: CORS restricted via optional `CORS_ORIGIN` (defaults to same origin reflect),
  explicit ping settings, and an Express fallback that serves the client JS with the correct
  MIME type.
- `/api/health` reports `persistentStorage`.

## public/app.js
- Live chat auto-reconnects after an authentication rejection (e.g. server restart), after
  re-checking the session.

## New files
- `public/audio/track-1..8.mp3` + `CREDITS.txt` — bundled audio previews.
- `render.yaml` — Render deployment with persistent disk and generated `JWT_SECRET`.
- `DEPLOY.md` — root cause, deployment steps, Windows CMD commands, data move, rollback.
- `tests/smoke.test.js` + `npm test` — login, protected routes, restart persistence,
  Socket.IO client, audio files.

## Changed config
- `vercel.json` — removed broken `/uploads` route that bypassed the server.
- `.env.example` — documents every variable.
- `package.json` — added `test` script.

## Tested here
- `npm test`: 5/5 pass.
- Browser: sign-up, refresh stays signed in, server restart stays signed in, reel upload and
  playback URL, profile photo upload, audio track plays (35 s), Socket.IO connects and a
  message from one user arrives live for another.

## Not tested here
- Real Render/Railway deployment and custom domain, the Vercel rewrite option, and
  WebSocket upgrade through a real HTTPS proxy (tested over polling locally).

## v2: no "session expired", professional polish, every device
- **Sessions**: login now lasts 1 year and renews itself daily while used. Users never see
  "Session expired". If a sign-in is truly needed they land on the sign-in screen with a
  friendly "Welcome back — please sign in to continue." (server.js, app.js)
- Raw sign-in errors are no longer shown inside lists or pop-ups (app.js).
- **Audio**: preview retries once automatically and shows a friendly hint instead of an error.
- **Every device**: fallbacks for older iPhones/Android (screen height, blur effects),
  no zoom-on-tap in iOS forms, no grey tap flashes, reduced-motion support (style.css).
- **Install as app**: icons + manifest so NoChat can be added to the home screen on
  Android/iPhone; iOS/Android/social-share tags (index.html, icon.svg, icon-192/512.png,
  manifest.webmanifest).
- Tested on iPhone 12, Pixel 5, iPad and desktop sizes: no page errors; an invalid cookie
  shows the normal sign-in screen with no "expired" text. `npm test` 5/5 pass.
- The browser side uses no extra libraries (plain JavaScript). Server libraries run on
  Node 20+ on Windows, macOS and Linux.
