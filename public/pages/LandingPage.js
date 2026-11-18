/**
 * NoChat v4 - Landing Page (Premium Hero & Detailing)
 */

import { renderNavbar } from '../components/Navbar.js';
import { renderFooter } from '../components/Footer.js';

export function renderLandingPage(currentUser = null, sampleVideos = []) {
  return `
    <div class="landing-page">
      ${renderNavbar(currentUser)}

      <header class="hero-section">
        <div class="hero-pill">21 Real Humans Inside</div>
        <h1 class="hero-headline">Humans. <span class="accent">Not Algorithms.</span></h1>
        <p class="hero-subtext">
          NoChat is the world's first social network engineered purely for real human connection. No bot farms, no surveillance advertising, and no black-box algorithm deciding who you see.
        </p>

        <div class="hero-buttons">
          ${currentUser ? `
            <a href="#/home" class="btn btn-primary" style="height:48px; padding:0 28px; font-size:15px;">Enter NoChat Feed</a>
          ` : `
            <button class="btn btn-primary" data-action="open-auth" style="height:48px; padding:0 28px; font-size:15px;">Join NoChat — It's Free</button>
            <button class="btn btn-secondary" data-action="open-auth" style="height:48px; padding:0 24px; font-size:15px;">Live Humans Inside: 21</button>
          `}
        </div>

        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-number">21</span>
            <span class="stat-label">Humans</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">100%</span>
            <span class="stat-label">Real Data</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">0</span>
            <span class="stat-label">Ad Trackers</span>
          </div>
        </div>
      </header>

      <!-- Features Section (6 Cards) -->
      <section id="features" style="padding: 20px 0;">
        <div style="text-align:center; max-width:680px; margin:0 auto 40px; padding:0 20px;">
          <h2 style="font-size:32px; font-weight:800; margin-bottom:12px;">Engineered for Authentic Connection</h2>
          <p style="color:var(--muted); font-size:16px;">Pure social craftsmanship without algorithmic manipulation.</p>
        </div>

        <div class="features-grid">
          <article class="feature-card">
            <div class="feature-icon"><i data-lucide="users"></i></div>
            <h3>Real Humans Only</h3>
            <p>Every profile is an authentic verified person. Zero automated bots, zero ghost accounts, and zero fake engagement farms.</p>
          </article>

          <article class="feature-card">
            <div class="feature-icon"><i data-lucide="clapperboard"></i></div>
            <h3>Full-Screen Reels</h3>
            <p>Full-screen vertical reels with smooth snap scrolling, double-tap heart animations, music disc spinning, and instant comment bottom sheets.</p>
          </article>

          <article class="feature-card">
            <div class="feature-icon"><i data-lucide="message-circle"></i></div>
            <h3>Private & Group Chat</h3>
            <p>Direct messaging with 15-minute message edits, instant message reactions, replies, and end-to-end privacy with zero ad profiling.</p>
          </article>

          <article class="feature-card">
            <div class="feature-icon"><i data-lucide="share-2"></i></div>
            <h3>Reels in Chat</h3>
            <p>Share any reel into conversation as an interactive 240px media card. One tap launches full-screen playback.</p>
          </article>

          <article class="feature-card">
            <div class="feature-icon"><i data-lucide="video"></i></div>
            <h3>HD Webcam Video Calls</h3>
            <p>One-to-one video calling with front-camera default, instant camera flip, audio mute, and browser permission fallback.</p>
          </article>

          <article class="feature-card">
            <div class="feature-icon"><i data-lucide="tv"></i></div>
            <h3>Anime & Watch Party</h3>
            <p>Stream official open-source anime movies and theatrical trailers legally with your friends in dedicated chat rooms.</p>
          </article>
        </div>
      </section>

      <!-- How It Works (3 Steps) -->
      <section style="padding: 40px 0; background:var(--surface); border-top:1px solid var(--border); border-bottom:1px solid var(--border); margin-bottom:80px;">
        <div style="text-align:center; max-width:680px; margin:0 auto 48px; padding:0 20px;">
          <h2 style="font-size:32px; font-weight:800; margin-bottom:12px;">How NoChat Works</h2>
          <p style="color:var(--muted); font-size:16px;">Three straightforward principles for real people.</p>
        </div>

        <div class="steps-grid">
          <div class="step-card">
            <div class="step-number">01</div>
            <h3 style="font-size:18px; font-weight:700; margin-bottom:8px;">Claim Your Human Number</h3>
            <p style="color:var(--muted); font-size:14px; line-height:1.6;">Register with your username. You receive a sequential member number (e.g. Human #21) forever.</p>
          </div>

          <div class="step-card">
            <div class="step-number">02</div>
            <h3 style="font-size:18px; font-weight:700; margin-bottom:8px;">Chronological Content</h3>
            <p style="color:var(--muted); font-size:14px; line-height:1.6;">See posts and reels in the exact order they were uploaded. No AI decides who deserves visibility.</p>
          </div>

          <div class="step-card">
            <div class="step-number">03</div>
            <h3 style="font-size:18px; font-weight:700; margin-bottom:8px;">Watch & Connect</h3>
            <p style="color:var(--muted); font-size:14px; line-height:1.6;">Enjoy open-source anime films, discuss them live in chat, and talk directly with creators.</p>
          </div>
        </div>
      </section>

      <!-- Founder Card with Live Link -->
      <section style="padding: 0 24px;">
        <div class="founder-card">
          <div style="width:64px; height:64px; border-radius:50%; background:var(--card); border:2px solid var(--accent-blue); margin:0 auto 16px; overflow:hidden;">
            <img src="/icons/nochat-mark.svg" alt="Denpher" style="width:100%; height:100%; object-fit:cover;" />
          </div>
          <p class="founder-quote">"Built for humans, by a human, for the Earth."</p>
          <p class="founder-author">— Denpher, Founder of NoChat & Denpher Technologies</p>
          <div>
            <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="height:44px; padding:0 24px;">
              <i data-lucide="external-link"></i>
              <span>Know The Founder</span>
            </a>
          </div>
        </div>
      </section>


      <style>
        #nochat-trust-sections { --nc-lime:#C6FF3E; --nc-ink:#0A0A0A; color:#fff; background:#0A0A0A; padding:clamp(34px,6vw,76px) 18px; }
        #nochat-trust-sections * { box-sizing:border-box; }
        #nochat-trust-sections .nc-wrap { width:min(1120px,100%); margin:0 auto; }
        #nochat-trust-sections .nc-section { margin:0 auto clamp(54px,8vw,104px); }
        #nochat-trust-sections .nc-section:last-child { margin-bottom:0; }
        #nochat-trust-sections .nc-heading { max-width:720px; margin:0 auto 28px; text-align:center; }
        #nochat-trust-sections .nc-badge { display:inline-flex; align-items:center; gap:7px; padding:7px 11px; border:1px solid rgba(198,255,62,.35); border-radius:999px; color:var(--nc-lime); background:rgba(198,255,62,.07); font-size:10px; font-weight:800; letter-spacing:.13em; }
        #nochat-trust-sections h2 { margin:15px 0 10px; color:#fff; font-size:clamp(27px,4.4vw,42px); line-height:1.12; letter-spacing:-.035em; font-weight:850; }
        #nochat-trust-sections .nc-lead { margin:0 auto; max-width:610px; color:#aaa; font-size:14px; line-height:1.75; }
        #nochat-trust-sections .nc-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:13px; }
        #nochat-trust-sections .nc-card { min-width:0; padding:21px; border:1px solid #292929; border-radius:16px; background:linear-gradient(145deg,#151515,#101010); }
        #nochat-trust-sections .nc-card-icon { display:grid; place-items:center; width:38px; height:38px; margin-bottom:15px; border:1px solid rgba(198,255,62,.22); border-radius:11px; color:var(--nc-lime); background:rgba(198,255,62,.08); }
        #nochat-trust-sections .nc-card-icon svg { width:19px; height:19px; }
        #nochat-trust-sections .nc-card h3 { margin:0 0 8px; color:#fff; font-size:15px; font-weight:750; }
        #nochat-trust-sections .nc-card p { margin:0; color:#a5a5a5; font-size:13px; line-height:1.7; }
        #nochat-trust-sections .nc-data-box { display:grid; grid-template-columns:1fr 1fr; margin-top:16px; overflow:hidden; border:1px solid #292929; border-radius:16px; background:#111; }
        #nochat-trust-sections .nc-data-side { padding:22px; }
        #nochat-trust-sections .nc-data-side + .nc-data-side { border-left:1px solid #292929; }
        #nochat-trust-sections .nc-data-side h3 { margin:0 0 13px; color:var(--nc-lime); font-size:11px; font-weight:850; letter-spacing:.12em; }
        #nochat-trust-sections .nc-data-side ul { display:flex; flex-wrap:wrap; gap:8px; margin:0; padding:0; list-style:none; }
        #nochat-trust-sections .nc-data-side li { padding:7px 10px; border:1px solid #303030; border-radius:999px; color:#ddd; background:#181818; font-size:12px; }
        #nochat-trust-sections .nc-policy-box { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-top:17px; padding:20px 22px; border:1px solid #292929; border-radius:16px; background:#111; }
        #nochat-trust-sections .nc-policy-box strong { color:#fff; font-size:15px; }
        #nochat-trust-sections .nc-policy-links { display:flex; flex-wrap:wrap; gap:9px; }
        #nochat-trust-sections .nc-policy-links a { display:inline-flex; align-items:center; justify-content:center; min-height:39px; padding:0 13px; border:1px solid #383838; border-radius:10px; color:#eee; text-decoration:none; font-size:12px; font-weight:700; transition:border-color .18s ease,color .18s ease,background .18s ease; }
        #nochat-trust-sections .nc-policy-links a:hover,#nochat-trust-sections .nc-policy-links a:focus-visible { border-color:var(--nc-lime); color:var(--nc-lime); outline:none; }
        #nochat-trust-sections .nc-india-card { padding:clamp(24px,5vw,46px); border:1px solid rgba(198,255,62,.5); border-radius:22px; background:radial-gradient(ellipse at 50% 0%,rgba(198,255,62,.08),transparent 56%),#0e0e0e; text-align:center; }
        #nochat-trust-sections .nc-flag { display:block; margin:0 auto 13px; font-size:42px; line-height:1.2; }
        #nochat-trust-sections .nc-india-card h2 { margin-top:15px; }
        #nochat-trust-sections .nc-india-points { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin:28px 0 20px; text-align:left; }
        #nochat-trust-sections .nc-point { padding:15px; border:1px solid #292929; border-radius:13px; background:rgba(255,255,255,.025); }
        #nochat-trust-sections .nc-point strong { display:block; margin-bottom:6px; color:#fff; font-size:13px; }
        #nochat-trust-sections .nc-point span { display:block; color:#aaa; font-size:12px; line-height:1.6; }
        #nochat-trust-sections .nc-guidance { max-width:760px; margin:0 auto 22px; color:#888; font-size:11px; line-height:1.7; }
        #nochat-trust-sections .nc-start { display:inline-flex; align-items:center; justify-content:center; min-height:47px; padding:0 22px; border:1px solid var(--nc-lime); border-radius:11px; background:var(--nc-lime); color:#090909; font-size:13px; font-weight:850; text-decoration:none; cursor:pointer; transition:transform .18s ease,filter .18s ease; }
        #nochat-trust-sections .nc-start:hover { transform:translateY(-2px); filter:brightness(1.04); }
        #nochat-trust-sections .nc-start:focus-visible { outline:2px solid #fff; outline-offset:3px; }
        #nochat-trust-sections .nc-made-note { margin:13px 0 0; color:#777; font-size:10px; letter-spacing:.04em; }
        @media(max-width:760px) {
          #nochat-trust-sections { padding:38px 15px; }
          #nochat-trust-sections .nc-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
          #nochat-trust-sections .nc-card { padding:16px; border-radius:13px; }
          #nochat-trust-sections .nc-data-box { grid-template-columns:1fr; }
          #nochat-trust-sections .nc-data-side + .nc-data-side { border-top:1px solid #292929; border-left:0; }
          #nochat-trust-sections .nc-policy-box { align-items:flex-start; flex-direction:column; }
          #nochat-trust-sections .nc-india-points { grid-template-columns:1fr; margin:22px 0 18px; }
        }
        @media(max-width:420px) {
          #nochat-trust-sections .nc-grid { grid-template-columns:1fr; }
          #nochat-trust-sections .nc-card { display:grid; grid-template-columns:36px minmax(0,1fr); column-gap:12px; align-items:start; }
          #nochat-trust-sections .nc-card-icon { grid-row:span 2; margin:0; }
          #nochat-trust-sections .nc-card h3 { margin:1px 0 5px; }
          #nochat-trust-sections .nc-card p { grid-column:2; }
          #nochat-trust-sections .nc-policy-links { width:100%; }
          #nochat-trust-sections .nc-policy-links a { flex:1; }
        }
        @media(prefers-reduced-motion:reduce) {
          #nochat-trust-sections *,#nochat-trust-sections *::before,#nochat-trust-sections *::after { scroll-behavior:auto!important; transition:none!important; }
        }
      </style>

      <div id="nochat-trust-sections">
        <div class="nc-wrap">
          <section class="nc-section" aria-labelledby="nc-security-title">
            <div class="nc-heading">
              <span class="nc-badge">SECURITY FIRST</span>
              <h2 id="nc-security-title">Safe by design. Not by promise.</h2>
              <p class="nc-lead">We don't track you for ads or sell your personal data. Here's how NoChat works to protect your account and content.</p>
            </div>
            <div class="nc-grid">
              <article class="nc-card">
                <span class="nc-card-icon"><i data-lucide="shield-check" aria-hidden="true"></i></span>
                <h3>HTTPS Encrypted</h3>
                <p>Pages use HTTPS to help protect information while it travels between your browser and NoChat.</p>
              </article>
              <article class="nc-card">
                <span class="nc-card-icon"><i data-lucide="lock" aria-hidden="true"></i></span>
                <h3>Hashed Passwords</h3>
                <p>Passwords are stored as one-way hashes, not as readable text.</p>
              </article>
              <article class="nc-card">
                <span class="nc-card-icon"><i data-lucide="eye-off" aria-hidden="true"></i></span>
                <h3>No Ad Tracking</h3>
                <p>No ad pixels or ad profiling. We do not sell personal data.</p>
              </article>
              <article class="nc-card">
                <span class="nc-card-icon"><i data-lucide="bot" aria-hidden="true"></i></span>
                <h3>Bot &amp; Spam Checks</h3>
                <p>Server-side checks help slow repeated and rapid activity. No CAPTCHA claim is made.</p>
              </article>
              <article class="nc-card">
                <span class="nc-card-icon"><i data-lucide="monitor-smartphone" aria-hidden="true"></i></span>
                <h3>Session Controls</h3>
                <p>Sessions can be revoked when an account needs protection.</p>
              </article>
              <article class="nc-card">
                <span class="nc-card-icon"><i data-lucide="flag" aria-hidden="true"></i></span>
                <h3>Report a Concern</h3>
                <p>Found a problem? Send a report from our <a href="#/contact" style="color:#C6FF3E;text-decoration:underline;">Contact page</a>.</p>
              </article>
            </div>
            <div class="nc-data-box" aria-label="Information we use and do not use">
              <div class="nc-data-side">
                <h3>WE TAKE</h3>
                <ul><li>Display name</li><li>Username</li><li>Email (if provided)</li></ul>
              </div>
              <div class="nc-data-side">
                <h3>WE DON'T ASK FOR</h3>
                <ul><li>Location</li><li>Contacts</li><li>Browsing history for ads</li><li>Data for ads</li></ul>
              </div>
            </div>
          </section>

          <section class="nc-section" aria-labelledby="nc-rules-title">
            <div class="nc-heading">
              <span class="nc-badge">INDIAN-BUILT • SAFETY-FOCUSED</span>
              <h2 id="nc-rules-title">Indian rules matter. Safety comes first.</h2>
              <p class="nc-lead">We aim to follow applicable Indian rules and keep our community standards clear. Read our policies to understand how the platform works.</p>
            </div>
            <div class="nc-grid">
              <article class="nc-card">
                <span class="nc-card-icon"><i data-lucide="scale" aria-hidden="true"></i></span>
                <h3>IT Rules 2021</h3>
                <p>We take online safety reports seriously and review concerns under our platform rules.</p>
              </article>
              <article class="nc-card">
                <span class="nc-card-icon"><i data-lucide="file-check" aria-hidden="true"></i></span>
                <h3>Privacy &amp; Data</h3>
                <p>We do not sell personal data. Our Privacy Policy explains the account information we use.</p>
              </article>
              <article class="nc-card">
                <span class="nc-card-icon"><i data-lucide="message-circle" aria-hidden="true"></i></span>
                <h3>Support</h3>
                <p>Send us a message from the Contact page. Response times may vary.</p>
              </article>
              <article class="nc-card">
                <span class="nc-card-icon"><i data-lucide="users" aria-hidden="true"></i></span>
                <h3>Parent Guidance</h3>
                <p>Under 18? Ask a parent or trusted adult before sharing personal details or uploading content.</p>
              </article>
            </div>
            <div class="nc-policy-box">
              <strong>We don't hide anything.</strong>
              <nav class="nc-policy-links" aria-label="NoChat policies">
                <a href="#/privacy">Privacy Policy</a>
                <a href="#/terms">Terms</a>
                <a href="#/terms">Community Guidelines</a>
              </nav>
            </div>
          </section>

          <section class="nc-section" aria-labelledby="nc-india-title">
            <div class="nc-india-card">
              <span class="nc-flag" role="img" aria-label="Indian flag">🇮🇳</span>
              <span class="nc-badge">MADE IN INDIA</span>
              <h2 id="nc-india-title">Proudly Made in India, For India.</h2>
              <p class="nc-lead">Built by an Indian student. For Indian creators. Privacy comes first.</p>
              <div class="nc-india-points">
                <div class="nc-point"><strong>Built in India</strong><span>Made in Meerut, India.</span></div>
                <div class="nc-point"><strong>Free for Creators</strong><span>Join and create without a paid plan.</span></div>
                <div class="nc-point"><strong>For Indian Youth</strong><span>Made for young Indian creators, with care and respect.</span></div>
              </div>
              <p class="nc-guidance">Guidance: We respect Indian culture, Indian law, and Indian parents. No vulgar, no hate, no fake news.</p>
              <button type="button" class="nc-start" data-action="open-auth">Start Watching - Free</button>
              <p class="nc-made-note">Made in India | Privacy First</p>
            </div>
          </section>
        </div>
      </div>

      ${renderFooter({ landing: true })}
    </div>
  `;
}
