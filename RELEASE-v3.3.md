# NoChat v3.3 — Videos, group chats, TURN relay, dark design

## Before deploying
1. **Database (Lovable Cloud):** apply `database/migrations/2026-11-13-v3.3-videos.sql` in the Lovable
   project that hosts the NoChat Cloud bridge. It only replaces `nochat_save` so it also accepts the
   `videos` collection. Nothing is dropped, truncated or deleted. Group chats need no migration.
   If you deploy before applying it, NoChat still starts and works; only video view counts and founder
   video management answer `503 VIDEO_SCHEMA_MISSING` until it is applied (then restart Render).
2. **Founder video management:** the founder account must have the founder email stored. If
   Videos does not show **Add video** for the founder, set `FOUNDER_EMAIL` to the founder's email in
   Render and restart once.
3. **Calls:** configure one TURN option from `TURN-SETUP.md` (optional but needed for reliable calls).
4. Keep `JWT_SECRET`, `NOCHAT_CLOUD_URL`, `NOCHAT_BRIDGE_SECRET`, `FOUNDER_PASSWORD` unchanged.
5. `npm ci --omit=dev` then `npm start` (unchanged). Keep one Render instance (unchanged).

No users, messages, reels, subscriptions or files are deleted or rewritten by this release.
