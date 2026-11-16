# NoChat v4 — Ultimate Banger Edition
> **Humans. Not Algorithms.** • Powered by [Denpher Technologies](https://denpher-portfolio-6xe8.vercel.app/)

NoChat v4 is a premium social platform engineered strictly for real human connection. No AI slop, no bot farms, zero advertising tracking, and no black-box algorithm dictating what you see.

---

## 🔒 Critical Data Safety Checklist (21 Real Users Preserved)

All 21 existing user accounts and their complete history are 100% safe, untouched, and preserved:

| Safety Requirement | Status | Verification Guarantee |
| :--- | :---: | :--- |
| **21/21 Users Preserved** | ✅ SAFE | No delete, no drop table, no reset DB. |
| **User IDs 1–21 Identical** | ✅ SAFE | IDs remain identical strings/UUIDs. |
| **Passwords & JWT Sessions** | ✅ SAFE | `JWT_SECRET` untouched; active logins persist 365 days. |
| **Member Numbers** | ✅ SAFE | Existing users keep #1 to #21; new users start sequentially at #22+. |
| **Chats & Message History** | ✅ SAFE | All 1-to-1, group messages, replies, and attachments preserved. |
| **Reels & Media Uploads** | ✅ SAFE | Vertical reels, likes, and comments remain intact. |
| **Database Schema** | ✅ SAFE | Strict additive-only updates (`ADD COLUMN IF NOT EXISTS`). |
| **Env & Secrets Untouched** | ✅ SAFE | `NOCHAT_CLOUD_URL`, `NOCHAT_BRIDGE_SECRET`, API keys unaltered. |

---

## 🔗 Official Founder Links Integration

Every page and footer links directly to Denpher's official portfolio:
- **Main Portfolio Link:** [https://denpher-portfolio-6xe8.vercel.app/](https://denpher-portfolio-6xe8.vercel.app/)
- **Landing Navbar:** "Founder" link opens portfolio.
- **Founder Spotlight Section:** "Know The Founder" button opens portfolio.
- **Global Footer (Every Page):** `NoChat | About Us | Privacy | Terms | Contact | Made by Denpher`
- **About Us Page:** Detailed founder background, mission statement, and portfolio links.

---

## 🛡️ Founder Authentication & Moderation Security

Access to the administrator dashboard and content moderation is strictly enforced at the server level:
- **Authorized Email:** `denpherai@gmail.com`
- **Authorized Username:** `denpher`
- **Founder Password:** `Denpher` (configured via `FOUNDER_PASSWORD` or defaults to `Denpher`)
- **Restricted Endpoints:** All `/api/admin/*` and `/api/admin/reels/:id/review` routes reject any user that is not `denpherai@gmail.com`.

---

## 🎬 Watch Party & Real Open-Source Anime Movies

The Watch Party catalog features full-length open-source films, Creative Commons studio masterpieces, and official anime trailers:
1. **Spring** — Award-winning open anime fantasy short by Blender Studio (Full Movie, CC BY).
2. **Sintel** — 4K fantasy adventure anime action film by Blender Foundation (Full Movie, CC BY).
3. **CHARGE** — High-octane cyberpunk anime action film by Blender Studio (Full Movie, CC BY).
4. **Big Buck Bunny** — 60fps 4K classic open film by Blender Foundation (Full Movie, CC BY).
5. **Tears of Steel** — Sci-fi dystopian cyberpunk VFX film by Blender Foundation (Full Movie, CC BY).
6. **Sprite Fright** — 80s horror-comedy animated film by Blender Studio (Full Movie, CC BY).
7. **Cosmos Laundromat** — Surrealist cosmic open film by Blender Foundation (Full Movie, CC BY).
8. **Demon Slayer: Infinity Castle** — Official Crunchyroll 4K Cinema Special.
9. **Jujutsu Kaisen: Shibuya Incident** — Official Crunchyroll cinematic trailer.
10. **Solo Leveling** — Official A-1 Pictures presentation.
11. **Frieren: Beyond Journey's End** — Official Madhouse / Crunchyroll trailer.
12. **SPY x FAMILY CODE: White** — Official theatrical trailer.
13. **My Neighbor Totoro** — Studio Ghibli official release (GKIDS).
14. **Dune: Part Two & Spider-Man: Across the Spider-Verse** — Official trailers.

*Legal Notice: NoChat does not host movies. All media streams through official, legal YouTube embeds directly from rights holders.*

---

## 📁 Clean Codebase Organization

The client is completely decoupled into modular ES modules and TypeScript definitions (no 2000-line monolithic files):

```
nochat/
├── database/
│   ├── migration.sql             # Additive migration with backup commands first
│   └── migrations/               # Database migration files
├── scripts/
│   └── backup-and-recovery.js    # Point-in-time JSON database backup script
├── src/
│   ├── types/index.ts            # Complete TypeScript types (User, Reel, Message, etc.)
│   └── tsconfig.json             # TypeScript compiler config
├── public/
│   ├── css/
│   │   ├── tokens.css            # Exact design tokens (#000000, #0095F6, #FF3040, #10B981)
│   │   └── style.css             # Modular premium stylesheet
│   ├── services/
│   │   ├── api.js                # Clean fetch wrapper
│   │   ├── socket.js             # Socket.IO realtime presence and events
│   │   ├── auth.js               # Auth state manager
│   │   └── webrtc.js             # Webcam calling (front-cam default, flip, mute)
│   ├── utils/
│   │   ├── dom.js                # DOM query helpers, escapeHtml, toast
│   │   ├── formatters.js         # Relative time, "Human #21", countdown timer
│   │   └── cache.js              # 50 messages LRU memory cache for 60fps speed
│   ├── hooks/
│   │   ├── useAuth.js            # Reactive auth hook
│   │   ├── useRealtime.js        # Socket event listener hook
│   │   └── useDoubleTap.js       # Double-tap heart detector
│   ├── components/
│   │   ├── Navbar.js             # 64px sticky blur navbar
│   │   ├── Sidebar.js            # 240px desktop sidebar
│   │   ├── BottomNav.js          # Mobile navigation tabbar
│   │   ├── PostCard.js           # 470px post card (4:5 media, heart bounce)
│   │   ├── StoryCircle.js        # 56px story circles with gradient ring
│   │   ├── ReelPlayer.js         # Vertical snap reel player + music disc
│   │   ├── CommentSheet.js       # Slide-up bottom sheet drawer
│   │   ├── ReelUploadModal.js    # Reel upload with live progress bar
│   │   ├── ChatList.js           # 72px chat list row with 48px avatar + online dot
│   │   ├── ChatWindow.js         # Bubbles (#3797F0 mine, #262626 other, 240px reel card)
│   │   ├── WebcamModal.js        # Webcam call UI with settings helper
│   │   ├── WatchPartyCard.js     # 2:3 poster, rating, streaming badges
│   │   ├── AnnouncementBanner.js # Announcements & 24h new user welcome banner
│   │   └── Footer.js             # Global footer on every page
│   ├── pages/
│   │   ├── LandingPage.js        # Hero 64px, 21 humans pill, 6 features, 3 steps
│   │   ├── HomePage.js           # Home feed with stories
│   │   ├── ReelsPage.js          # Vertical snap reels stream
│   │   ├── ChatPage.js           # Split-screen direct messaging
│   │   ├── ProfilePage.js        # 150px avatar, Human #21, 3-column grid
│   │   ├── WatchPartyPage.js     # Anime full movies & trailers
│   │   ├── AdminPage.js          # Founder admin console (5d/30d/perm verify)
│   │   ├── PrivacyPage.js        # /privacy legal document
│   │   ├── TermsPage.js          # /terms legal document
│   │   ├── AboutPage.js          # /about with Denpher story & mission
│   │   └── ContactPage.js        # /contact form with portfolio links
│   ├── js/
│   │   └── app.js                # Main router and application orchestrator
│   ├── index.html                # HTML5 shell with OpenGraph SEO & Inter font
│   └── og-image.png              # 1200x630 pixel-perfect social preview card
├── server.js                     # Node.js Express & Socket.IO server
├── admin.js                      # Admin security module
├── videos.js                     # Deduplicated video viewing engine
├── videos-catalog.js             # Preloaded catalog with full movies
└── migration.sql                 # SQL migration with safe backup commands
```

---

## 💾 Database Migration & Backup Instructions

### Step 1: Create a Point-in-Time Backup First
Run the backup command in your terminal before running any migration:
```bash
# PostgreSQL / Supabase CLI command:
pg_dump --clean --if-exists --no-owner --no-privileges "$DATABASE_URL" > "nochat_backup_before_v4_$(date +%Y%m%d_%H%M%S).sql"

# Or execute the snapshot queries in your SQL console:
CREATE TABLE IF NOT EXISTS public.nochat_records_backup_v3 AS SELECT * FROM public.nochat_records;
CREATE TABLE IF NOT EXISTS public.nochat_revision_backup_v3 AS SELECT * FROM public.nochat_revision;
```

### Step 2: Apply the Additive Migration
Execute `migration.sql` in your PostgreSQL console. It creates indexes and updates `nochat_save` safely without deleting any user records or altering IDs 1–21.

---

## 🚀 Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Start server
npm start

# 3. Development with auto-restart
npm run dev
```

Visit `http://localhost:5000` to view NoChat v4.
Sign in with `denpherai@gmail.com` and password `Denpher` to access Founder Admin.
