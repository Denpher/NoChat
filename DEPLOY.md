# Deploying NoChat so it keeps working (no "Session expired", live chat, audio)

## Why it broke on Vercel (root cause)

Vercel runs `server.js` as short-lived serverless functions:

1. Every function instance had its **own** `/tmp/db.json` and, without `JWT_SECRET`,
   its **own random secret**. The next request often hit a different instance, so the
   session token could not be verified or the user "did not exist" → **"Session expired"**.
2. `/tmp` is wiped all the time → accounts, reels and profile photos disappear.
3. Vercel functions cannot keep a Socket.IO / WebSocket connection open → live chat,
   typing and online dots cannot work there, and `/socket.io/socket.io.js` failed (MIME error).
4. All 8 audio library links (assets.mixkit.co) now return **403 Forbidden** → no sound played.

Fixes 1 (partly), 3's MIME error, and 4 are in the code. Fixes 1–3 fully need a host that
runs a normal always-on Node server with a disk. **Render** is set up for you (`render.yaml`).
Railway or any VPS also works.

## Option A — Render (recommended, ~$7/month for the disk)

1. Push this folder to a GitHub repository (commands below).
2. Go to https://dashboard.render.com → **New → Blueprint** → pick the repo → **Apply**.
   `render.yaml` creates the server, a 5 GB persistent disk, and a random `JWT_SECRET`.
3. When asked, enter `FOUNDER_PASSWORD` (password for the @denpher account).
4. Open the `https://nochat-xxxx.onrender.com` link. Check `/api/health` shows `"persistentStorage": true`.
5. Custom domain: Render → service → **Settings → Custom Domains**.

### Windows CMD — first upload to GitHub

```
cd C:\path\to\nochat
git init
git add .
git commit -m "NoChat production fixes"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/nochat.git
git push -u origin main
```

### Windows CMD — later updates

```
cd C:\path\to\nochat
git add .
git commit -m "Update"
git push
```
Render redeploys automatically; data on the disk is kept.

## Option B — Railway

1. https://railway.app → **New Project → Deploy from GitHub repo**.
2. Service → **Settings → Volumes → Add volume**, mount path `/data`.
3. **Variables**: `NODE_ENV=production`, `JWT_SECRET=<long random>`, `DATA_DIR=/data/db`,
   `UPLOADS_DIR=/data/uploads`, `FOUNDER_PASSWORD=<yours>`.
4. **Settings → Networking → Generate Domain**.

Generate a JWT secret in Windows CMD:
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Option C — keep the nochat-rust.vercel.app address

Deploy the server on Render/Railway as above, then in your Vercel project replace
`vercel.json` with a rewrite to it so the old address keeps working:
```
{ "rewrites": [ { "source": "/(.*)", "destination": "https://YOUR-RENDER-URL.onrender.com/$1" } ] }
```
Pages, login, uploads and audio work through this. Live chat falls back to polling through
Vercel; for the fastest real-time chat, share the Render URL directly. (Not tested from here.)

## Moving existing data

If you have an existing `data/db.json` and `public/uploads/` from a computer running NoChat,
copy them to the disk: `db.json` → `DATA_DIR`, `profile/` and `reels/` → `UPLOADS_DIR`
(Render: service → **Shell**, or upload via `scp`). Files still in `public/uploads/` are
also served automatically. Data that lived only in Vercel's `/tmp` was already lost by Vercel.

## Run locally (Windows CMD)

```
cd C:\path\to\nochat
copy .env.example .env
npm install
npm test
npm run dev
```
Open http://localhost:5000 (for local use set `NODE_ENV=` empty in `.env`).

## Rollback

- Render: service → **Events** → pick the previous deploy → **Rollback**.
- Git: `git revert HEAD` then `git push`.
- Original files: your untouched `NoChat-Improved.zip`.
