NoChat v4 app update

This ZIP is a patch bundle based on the supplied NoChat-v4-Ultimate-Banger archive.
It leaves public/js/app.js untouched. app-old.js is the original app.js backup.

Included changes:
- v4 app entry and app-only styling, delegated actions, YouTube player helpers
- creator search/recommendations; like, comment, follow, share, save, profile-photo update
- image/video post uploads, video reels, server-backed 24-hour stories
- notification panel, per-user chat clearing, Socket.IO room joins, WebRTC voice/video signaling
- chat contact-name normalization and media sound toggles

Install the files at their paths in the original project. The updated index.html selects app-v4.js and app-v4.css. The updated server.js adds the supporting APIs/signaling. Keep the existing .env, data/db.json, and data/.jwt-secret from the original project; they are intentionally not included in this ZIP.

Verification performed: JavaScript syntax checks, import-graph checks, YouTube ID/embed helper checks, video/iframe sound-toggle on/off checks, route/entry checks, and CSS brace balance. The supplied project has no test files (npm test reports 0 tests). Browser-to-backend upload, chat, and calling sessions were not run in this environment.
