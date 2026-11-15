# CHANGELOG

## Unreleased — founder video
- Added the founder's own YouTube video (3J81gK6QBgc, official embed) to Videos, listed first as "Denpher · NoChat founder".
- Fixed founder video upload error: production reported `videoStorage:false` because the cloud save function rejects a `videos` collection, so uploads returned "Video storage is not enabled yet". Videos are now saved as tagged rows inside the existing `reelUploads` collection when that happens; no database migration or new setting is needed. Applying `database/migrations/2026-11-13-v3.3-videos.sql` later is optional and moves them to their own collection automatically. Test: tests/videos-cloud.test.js.

## v3.3.0 — Videos, group chats, TURN relay, dark design
See RELEASE-v3.3.md for deployment steps and TURN-SETUP.md for calls.

### Videos (new: `videos.js`, `videos-catalog.js`, `public/videos.js`)
- New **Videos** section (sidebar + mobile tab bar, `#/videos`, shareable `#/videos/<id>`).
- 31 preloaded videos in **Anime, Movies, Trailers, Entertainment**, all from official channels
  (Crunchyroll, Netflix, GKIDS, Warner Bros., Universal, Pixar, Sony, TOHO, Kurzgesagt, Mark Rober,
  Sesame Street) or complete Creative-Commons Blender open movies. Embedding was checked with
  YouTube oEmbed. Nothing is downloaded; thumbnails load lazily from YouTube's CDN (320 px, 480 px srcset).
- Search, category chips, Featured / Most viewed sort, featured hero, 12-per-page infinite scroll,
  skeleton / empty / error states, streaming-style player with "Up next", privacy-enhanced
  `youtube-nocookie.com` embeds, Vimeo support.
- **Founder-only management** (server enforced on every route): add by YouTube/Vimeo link, upload a
  file (MP4/MOV/WebM, max 15 minutes checked with FFmpeg on the server, max 100 MB, poster frame
  generated), edit, delete (soft delete; uploaded file removed from storage). Requires the fixed founder
  account, password sign-in, the founder email fingerprint and the existing server-side founder role
  check. Ordinary admins, moderators, verified badges and `FOUNDER_EMAIL` overrides cannot grant it.
  Denied attempts are written to the audit log.
- **View counts**: counted only when the player reports real playback (YouTube IFrame API `PLAYING`,
  Vimeo `play`, `<video>` `playing`); one count per viewer per video per 30 minutes (server-side,
  repeated player events never inflate). Increments are synchronous (no lost updates under
  concurrency) and acknowledged only after the durable Cloud save; writes in the same second are
  coalesced into one save. Stored in the Cloud database, so they survive refreshes, restarts and
  redeploys. Final writes are flushed on SIGTERM.

### Group chats (new: `groups.js`, `public/groups.js`)
- Create a group with name, photo and friends; rename; change photo; add/remove members; owner and
  admin roles (owner promotes/demotes admins, admins manage plain members); leave (ownership passes to
  an admin or the longest-standing member; an empty group is archived, never deleted).
- Uses the existing Socket.IO rooms, persistent `conversations`/`messages`, attachments, typing,
  anti-spam and unread badges. System messages record membership changes. Sender names in bubbles,
  "Seen by N / Seen by all" read status, group notifications, live member updates, removed members are
  disconnected from the room immediately.
- Every private group route returns 404 to non-members; role checks on the server. Calls stay
  one-to-one only. Existing 1-to-1 chats are unchanged (direct lookups now ignore groups).

### Calls (new: `turn.js`; changed: `features.js`, `public/calls.js`)
- STUN + TURN with temporary credentials: coturn REST (`TURN_SECRET`), Cloudflare, Metered, or legacy
  static. Secrets never reach the browser. UDP/TCP/TLS transports reported.
- Removed the hidden shared public relay that was reported as "configured".
- Connection indicator on the call screen (relay / STUN / local), fresh credentials on ICE restart,
  honest failure messages, optional `TURN_FORCE_RELAY`, and a browser **Test connection** tool.

### Design
- Premium dark theme (deep ink surfaces, violet accent, warm highlight), dark mobile tab bar and
  top bar, refined buttons, chips, modals, member lists and call status. NoChat branding unchanged.

### Database
- Additive migration `database/migrations/2026-11-13-v3.3-videos.sql` (see RELEASE-v3.3.md).
  The server detects a Cloud that has not applied it and keeps every existing feature running.

### Tests
- New: `tests/videos.test.js`, `tests/videos-founder.test.js`, `tests/groups.test.js`,
  `tests/turn.test.js`, `tests/helpers.js`. `socket.io-client` added as a dev dependency only.
- `npm test`: 61 passing (34 existing + 27 new). See TEST-RESULTS.md.

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
