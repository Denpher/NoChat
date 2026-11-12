# NoChat v3
Existing NoChat social app, upgraded without replacing its Express/Socket.IO architecture or visual branding.

Start with **DEPLOY.md**. Production requires a published Lovable Cloud bridge and the stable signing/shared secrets; Render Free is supported but may sleep. Storage survives sleep; active calls do not.

```
npm ci
npm test
npm start
```
For local-only development set `NODE_ENV=development`, leave the Cloud URL empty, and run `npm run dev`. Do not deploy local storage mode. `RELEASE-v3.md` and `RELEASE-v3.1.md` summarize the changes; `database/schema.sql` contains the exact PostgreSQL schema.
