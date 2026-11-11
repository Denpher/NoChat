# NoChat — reels, friends and private chat

A social web app by Denpher Technologies: post short vertical video reels, like and
comment, add friends, discover creators, and chat 1-on-1 in real time.
Privacy is our first policy — everything is stored on your own computer/server.

## Run it (Windows, macOS or Linux)

1. Install **Node.js 20 or newer** (https://nodejs.org).
2. Unzip this folder and open a terminal inside `nochat` (the folder with `package.json`).
3. Run:

   ```
   npm install
   npm run dev
   ```

4. Open **http://localhost:5000**.
5. Click **Create account**, choose a username and password, and you're in.
   To test chat and friends, open a second browser (or a private window) and create another account.

## What works

- **Accounts** — create an account with username + password (email optional), sign in with
  username or email, change password, log out. Accounts made with the old password-free
  version keep working: the first time you sign in, the password you type is saved.
- **Reels** — full-screen vertical feed with snap scrolling, autoplay when on screen, tap to
  pause, double-tap to like with a heart animation, progress bar, sound on/off, keyboard
  shortcuts (Up/Down or J/K to move, M to mute, Space to pause), share link, delete your own
  reels, live "New reels" notice.
- **Upload** — drag & drop or pick a video (MP4/WebM/MOV, 100 MB), live preview, caption with
  #hashtags, sound label picker with track previews, upload progress bar.
- **Comments** — slide-up panel, post and delete (yours, or any on your reel), live updates.
- **People** — Friends, Requests (accept / decline / cancel), Discover, search by name or
  @username, subscribe to creators, remove friends.
- **Messages** — conversation list with unread counts and online dots, real-time chat,
  typing indicator, emoji picker, big emoji messages, day separators, unread badges in the
  menu and the browser tab title, new-message notifications.
- **Profiles** — your profile with banner, stats and reels grid; edit name, bio and default
  sound; change or remove photo. Tap anyone's name to see their profile and reels.
- **Responsive** — sidebar on desktop, compact icon rail on tablets, bottom tab bar and
  full-screen reels/chat on phones.

## Project structure

- `server.js` — Express API, Socket.IO (chat, typing, presence, notifications), cookie
  sessions, password hashing, local JSON storage, uploads
- `public/index.html` — page structure
- `public/style.css` — design system and responsive layout
- `public/app.js` — all browser logic (no build step needed)
- `data/db.json` — created automatically, holds all accounts/reels/messages
- `public/uploads/` — uploaded profile photos and reels

## Settings (`.env`, optional)

Copy `.env.example` to `.env` to change them.

- `PORT` — default 5000
- `JWT_SECRET` — signs login sessions. Required in production (keep it fixed). If empty locally, a random one is saved in `data/`.
- `DATA_DIR`, `UPLOADS_DIR` — folders on a persistent disk for the database and uploads.
- `FOUNDER_PASSWORD` — password for the official verified `@denpher` account. If you don't set
  it, whoever signs in as `denpher` first chooses its password, so set it before going public.

## Hosting

See **DEPLOY.md** — Render (render.yaml included) or Railway with a persistent disk.
See **CHANGELOG.md** for every fix.

## Notes

- The "sound" picked when uploading is a label shown on the reel; the video plays its own audio.
- Vercel: the included `vercel.json` still works for the pages and API, but Vercel's serverless
  functions don't keep files or live connections, so uploads/data reset and live chat won't be
  reliable there. For a real deployment, use a host that runs a normal Node server
  (Render, Railway, Fly.io, a VPS) and keep the `data/` and `public/uploads/` folders on disk.
- Keep the terminal open while using the app. `Ctrl+C` stops the server.
