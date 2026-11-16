# NoChat v3 — Render Free with permanent Cloud storage

> **v3.3:** read `RELEASE-v3.3.md` first (one additive Cloud migration, optional `FOUNDER_EMAIL`, optional TURN variables). For calls across networks follow `TURN-SETUP.md`.

## What changed, and what did not
Your existing Express, Socket.IO, login cookie and UI are retained. PostgreSQL now stores each legacy entity as a separate JSONB row rather than a disk JSON file. Video files, avatars and attachments are private Cloud storage objects. Render's filesystem is used only in explicitly local development. Production refuses to start without permanent Cloud configuration and a stable signing secret.

Render Free can sleep. Saved records/files survive; live calls end when the service disconnects and reconnecting users may wait for a cold start. Free hosting is NOT an always-on service guarantee. Cloud storage and AI usage can cost money and are subject to quotas; this does not make all services free forever.

## First deploy
1. In Lovable, publish this project's Cloud service. It contains the already-applied SQL migration and authenticated `/api/public/nochat` bridge. Keep this service published and Cloud active.
2. On Render, use this ZIP's `nochat` folder as the repository root. `npm ci --omit=dev` installs the locked dependencies, including the platform-specific FFmpeg binary. Build must finish successfully; do not disable installation scripts.
3. Add these required environment variable NAMES: `NODE_ENV`, `JWT_SECRET`, `NOCHAT_CLOUD_URL`, `NOCHAT_BRIDGE_SECRET`, `FOUNDER_PASSWORD` (for founder setup).
   - `NOCHAT_CLOUD_URL`: the origin of the published Lovable service; NOT a preview URL.
   - `NOCHAT_BRIDGE_SECRET`: the exact shared value saved through Lovable's secure form. Enter in Render Environment. Never commit or paste it in chat.
   - `JWT_SECRET`: KEEP YOUR EXISTING VALUE. Rotating it invalidates old sign-in cookies. Do not generate a new value on each deploy.
   - `FOUNDER_PASSWORD`: a password only you know. It initializes the fixed official Denpher account only if that account has no password already.
4. `render.yaml` supports Free, no disk. Keep one Render instance; revision checks reject competing stale writes rather than overwriting data. A failed durable write puts the instance in a safe unavailable state until restart/reload, not fake success.
5. Optional variables: `PORT`, `DAILY_REEL_LIMIT` (default 2; UTC), `STUN_URL`, `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD`, `CORS_ORIGIN`, `COOKIE_SECURE`. `DATA_DIR` and `UPLOADS_DIR` are local-development settings only.
6. For reliable cross-network calls, configure a legitimate TURN service in Render. Its credentials are returned only to signed-in callers and should be short-lived/restricted by your TURN provider. No TURN provider was provisioned here. Browser microphone access requires HTTPS except on localhost.
7. Deploy; `/api/health` must show `persistentStorage: true` and `storageMode: cloud`. Then create an account, upload, refresh, restart Render and read back the same media and account.

## Preserve existing accounts and files BEFORE changing deployments
Stop writes on the old app and back up its `db.json`, uploads and JWT_SECRET. On your local computer, with Cloud environment configured, run:

```
npm ci
npm run migrate:legacy -- /path/to/db.json /path/to/uploads
```

This script refuses to overwrite nonempty Cloud data. Run it before the new Render server initializes the founder row; otherwise use a reviewed merge, not a destructive reset. It keeps originals unchanged and uploads real bytes. Legacy reels are retained privately pending review. Password-free legacy accounts cannot be claimed by strangers anymore; they need a trusted owner's recovery process. Content that already disappeared from Vercel/Render temporary disk cannot be recovered by this upgrade.

## Roles and access
Only the protected `nochat_user_roles` row for the FIXED official founder identifier can authorize global removal; username/email, verified badge or frontend state cannot grant it. Ordinary users delete their own reels/comments and their own sent messages. Denpher can remove any reel/comment and approve or quarantine reported content. Account deletion of other users is not included.

## Moderation bot and retention
Captions are checked for a narrow set of clearly prohibited phrases. Actual reel bytes are sampled by FFmpeg on the server (up to 12 frames, one every 5 seconds). AI reviews those frames and the caption before publication. Clearly prohibited reels are blocked from the feed, ambiguous or failed checks stay pending; ORIGINALS ARE RETAINED privately until their owner or Denpher explicitly deletes them. Denpher's moderation review lists pending, blocked and reported reels. This is not exhaustive video/audio moderation and is not 100% accurate. Videos longer than the sampled interval or violations between frames may be missed. There is no unattended recurring scan of old reels; users report existing reels for admin review. Do not treat this as a legal safety guarantee.

## Seen/unseen and deletion
GET messages never marks read; visible chat explicitly marks read. Turning off read receipts suppresses new receipts. Prior receipts remain. Mark unread changes the local conversation read boundary; it does not undo the other person's history. Sender deletion removes text/attachment for both users, keeping a tombstone. Daily limit counts uploads, including quarantined ones, and cannot be bypassed by deleting a reel.

## Storage/SQL portability
The exact applied PostgreSQL SQL is in `database/schema.sql`. Table access is service-role only; browser sessions never read records directly. Private bucket `nochat-media` was created with the Storage API, 100 MB cap, no public policies. Only the authenticated machine bridge accesses it; downloads check NoChat authorization before issuing a fresh 5-minute signed URL. Stored links are stable `/api/media/...` paths, not expiring tokens.
The privileged Cloud credential is never available for export and is NOT required on Render: the shared-secret bridge performs Cloud operations. This package therefore needs the published Lovable service; it is not a standalone database provider setup without it. Importing SQL into a different provider alone will not wire the app.

## Verify before inviting users
```
npm test
```
Also test: two independent browsers, unread then seen, delete as sender (recipient deletion must fail), attach PDF/image and download, incoming call accept/reject/mute/end, microphone denial, phone profile reel viewer, two daily uploads then third denied, Denpher review, other users denied admin access. Redeploy with the same JWT_SECRET and confirm accounts, media and messages. Real Render redeployment and restrictive-network TURN calls must be tested in your hosting account; they cannot be guaranteed from localhost.

## Updating / rollback
Commit and push the revised folder from your own repository, then deploy on Render. Never commit `.env`, private secrets, live user data or `node_modules`. Keep Cloud migration and media backups. Render rollback should not rotate secrets or delete Cloud objects. Use the Render URL directly; Vercel alone cannot host the existing Socket.IO server. No Vercel/Render account was accessed or redeployed here.
