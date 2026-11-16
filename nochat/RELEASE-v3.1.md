# NoChat v3.1 — admin, safety, calls and design

No new environment variables. No database schema change. Existing users, password hashes,
sessions (cookies keep working), chats, media and settings are untouched.

## What's new
- **Admin console** (founder only, checked on the server for every request): search users by
  username, name or exact user ID; view status; suspend (1h–30d), ban, restore, soft-delete,
  sign out everywhere, give/remove verified badge, clear spam limits. Destructive actions need a
  reason and the typed username. Every action — including denied attempts — goes to the audit log.
  The founder account cannot be modified.
- **Soft delete**: deleted accounts are hidden and cannot sign in, but every record is kept and the
  account can be restored.
- **Sign out everywhere**: tokens now carry a session version; revoking bumps it. Old cookies
  without a version keep working until revoked.
- **Anti-spam** (server-enforced on messages, attachments and comments): more than 10 messages in
  10 s, or the same text more than 4 times in 60 s. Progressive pauses 15 s -> 1 min -> 5 min ->
  30 min -> 2 h max; strikes forgotten after 24 h; never a permanent ban. Logged; appealable.
- **Appeals**: restricted accounts appeal from the sign-in screen (password required); messaging
  pauses from Settings; reel decisions from the reel tile. Admin accepts (restores) or rejects.
- **Video moderation policy**: automatic removal only for prohibited captions or a model verdict of
  "blocked" with confidence >= 0.9. Everything uncertain is privately quarantined for review.
  Removed reels are visible to admins only. Every decision is logged. The visual check uses the
  existing Cloud `moderate` operation; it samples frames and is not exhaustive.
- **Verified badge**: display-only; grants no permissions. Give it from Admin console -> search the
  person -> "Give verified badge" (pick by exact user ID if several accounts match).
- **Calls**: real WebRTC voice and video, incoming screen with accept/decline, mute, camera on/off,
  front/back camera switch (when the device has two cameras), live duration, reconnecting state,
  full cleanup. Default STUN is used when `STUN_URL` is empty; set `TURN_URL`, `TURN_USERNAME`,
  `TURN_PASSWORD` for reliable calls across mobile/corporate networks.
- **Design**: premium white-and-purple theme, new purple app icon, "Made with Love by Denpher ❤️"
  on sign-in/sign-up, sidebar footer and Settings -> About.

## Data layout
New fields on user records: `status`, `statusReason`, `statusUntil`, `deletedAt`, `sessionVersion`,
`sessionsRevokedAt`, `verifiedBadge`, `spam`. Logs and appeals are rows in the existing `reports`
collection with a `kind` of `audit`, `spam`, `moderation` or `appeal` (existing reel reports have no
`kind` and behave exactly as before).
