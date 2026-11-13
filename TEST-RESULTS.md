# TEST RESULTS — NoChat v3.3.0

Run on 2026-11-13 with Node v22, `npm ci` then `npm test` (`node --test tests/*.test.js`).
Each integration test starts the real `server.js` on a temporary local data folder (no Cloud, no production data).

**61 tests — 61 passed, 0 failed.** (34 pre-existing + 27 new)

## New coverage
| Area | File | What is proven |
|---|---|---|
| Founder-only video management | `videos.test.js`, `videos-founder.test.js` | ordinary users get 403 on add / upload / edit / delete; founder can add, edit, delete; a `FOUNDER_EMAIL` override cannot grant management; nobody can register the founder email |
| Video embeds | `videos.test.js` | every preloaded video has a valid 11-char official YouTube id and a `youtube-nocookie` embed; link parser rejects foreign/look-alike domains and `javascript:`; non-video uploads rejected |
| Browsing | `videos.test.js` | sign-in required, pagination without duplicates, category filter, search |
| Views | `videos.test.js` | 10 concurrent player events from one viewer count once; 15 concurrent viewers give exactly 1..15 (no lost updates); counts survive a server restart |
| Groups | `groups.test.js` | friends-only creation; non-members get 404 on read/post/manage/leave and receive no socket messages; members can't manage; owner/admin rules; real-time delivery over Socket.IO; persistent history after restart; "seen by" counts; removed member loses access instantly; owner hand-over on leave; 1-to-1 chats unchanged; group calls refused |
| TURN / signalling | `turn.test.js` | STUN-only reported honestly; HMAC temporary credentials with correct expiry, secret never returned; provider failure falls back to STUN and says so; Cloudflare/static modes; `/api/calls/config` requires sign-in; offer / answer / ICE candidates relayed only between call members; invalid signal types dropped |

## Browser checks (Playwright, Chromium, local server)
- Videos page, category filter, featured hero, cards with real thumbnails, player modal, mobile (390 px) layout: rendered without page errors.
- Founder signed in through the UI, uploaded a 6-second WebM: duration read as 0:06, played in the player, **view count went 0 → 1 and stayed 1 after a page reload**; adding a duplicate link was refused.
- Group created through the UI with two friends; a message from another member arrived live; "Seen by 1" shown; group info shows owner/admin controls.
- Settings → Call connectivity shows "No TURN relay is configured" when none is set.

## Could not be verified here
- **YouTube playback in the test browser**: the sandbox's datacenter IP gets YouTube's "Sign in to confirm you're not a bot" screen, so YouTube's PLAYING event (and therefore YouTube view counting) could not be exercised end-to-end. The same counting path was verified with an uploaded video. Check on a normal device after deploying.
- **TURN relay across real networks**: no TURN server/credentials were provided. See TURN-SETUP.md for the verification steps.
- **Lovable Cloud + Render**: nothing was deployed. The v3.3 migration was not applied to your Cloud database; until it is, video views/management return 503 (other features unaffected).
- Real two-device WebRTC audio/video calls (unchanged code path, signalling tested).

## Full list
```
PASS  setup: founder signs in, two members register
PASS  ordinary users get 403 from every admin endpoint
PASS  admin finds users by username and by exact user ID
PASS  founder account is protected and the attempt is audited
PASS  suspension needs confirmation, then blocks the existing session and sign-in; appeal + restore works
PASS  deleted accounts are hidden from search but kept and restorable
PASS  verified badge shows on profile without granting admin
PASS  flooding a chat is stopped by the server, logged, and appealable
PASS  create requires a name and friends only
PASS  non-members cannot see, read, post, join or manage the group
PASS  plain members cannot add, remove, rename or promote
PASS  real-time messages reach every member over Socket.IO and persist in history
PASS  read status counts members who opened the chat
PASS  owner promotes an admin; admin adds/removes members but cannot remove the owner or other admins
PASS  leave: owner leaving hands ownership to an admin; history survives restart
PASS  one-to-one chats are unchanged and groups cannot be called
PASS  role rules (unit)
PASS  default upload limit is exactly two reels per user per UTC day
PASS  configured reel limit is validated on the server
PASS  only content owner or authorized admin can remove reels and comments
PASS  messages remain unseen until recipient actually marks read
PASS  spoofed file content is rejected even with allowed MIME and extension
PASS  attachment size restriction is exactly 20 MB
PASS  clear prohibited violent captions are blocked before publishing
PASS  production refuses temporary storage rather than losing reels on sleep
PASS  normal fast conversation (10 different messages in 10 s) is never blocked
PASS  the 11th message within 10 s is flooding and gets a 15 s first-strike cooldown
PASS  the same text a 5th time within 60 s is repetition
PASS  cooldowns escalate 15s, 1m, 5m, 30m and cap at 2h — never permanent
PASS  suspended, banned and deleted accounts are restricted; expired suspension is not
PASS  revoking sessions invalidates older tokens; tokens issued afterwards and legacy tokens work
PASS  founder account cannot be modified by any admin action
PASS  destructive actions need the typed username and a reason
PASS  delete is a soft delete that keeps the record and can be restored
PASS  verified badge is display-only and separate from admin permissions
PASS  control characters are stripped from user text
PASS  moderation auto-removes only high-confidence violations; uncertain content is quarantined
PASS  founder email is never written in plain text in shipped code
PASS  register sets a session cookie and /api/me works
PASS  protected routes reject requests without a session
PASS  session survives a server restart
PASS  socket.io client is served as JavaScript
PASS  every audio library track is a real playable mp3
PASS  no TURN configured: STUN only, reported honestly as not configured
PASS  TURN_SECRET mode issues temporary HMAC credentials and never exposes the secret
PASS  TTL is clamped and REST credentials expire
PASS  provider failure falls back to STUN and says so (no fake TURN)
PASS  Cloudflare provider credentials are passed through, TURN urls only
PASS  static legacy credentials are labelled static
PASS  /api/calls/config needs sign-in and returns temporary TURN credentials only
PASS  offer/answer/ICE candidates are relayed only between the two call members
PASS  FOUNDER_EMAIL override cannot grant video management
PASS  nobody can register with the founder email
PASS  catalog: every category is populated with valid official YouTube embeds
PASS  embed parser accepts YouTube/Vimeo links and rejects everything else
PASS  members can browse, search, filter and paginate; listing requires sign-in
PASS  only the founder can add, edit and delete videos (ordinary users get 403 on every call)
PASS  founder upload rejects files that are not real videos
PASS  repeated player events from one viewer count once
PASS  concurrent genuine starts from many viewers are all counted (no lost updates) and survive a restart
PASS  view deduper window
```
