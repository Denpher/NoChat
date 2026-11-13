# NoChat v3.3
Existing NoChat social app — reels, private chats, **group chats**, **Videos**, WebRTC calls with **STUN + TURN** —
upgraded without replacing its Express/Socket.IO architecture, authentication or branding.

Start with **RELEASE-v3.3.md** (what to do before deploying), then **DEPLOY.md**. Calls: **TURN-SETUP.md**.
Production requires a published Lovable Cloud bridge and the stable signing/shared secrets; Render Free is supported but may sleep.

```
npm ci
npm test
npm start
```
For local-only development set `NODE_ENV=development`, leave the Cloud URL empty, and run `npm run dev`. Do not deploy local storage mode.
`database/schema.sql` is the already-applied schema; `database/migrations/` contains the additive v3.3 migration.
