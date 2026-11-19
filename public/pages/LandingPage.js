/**
 * NoChat v4 - Landing Page (Premium Hero & Detailing)
 */

import { renderNavbar } from '../components/Navbar.js';
import { renderFooter } from '../components/Footer.js';

export function renderLandingPage(currentUser = null, sampleVideos = []) {
  return `
    <div class="landing-page">
      ${renderNavbar(currentUser)}

      <main id="main-content" class="landing-main">
      <header class="hero-section">
        <div class="hero-terminal" aria-label="NoChat welcome terminal">
          <span class="hero-terminal-prompt" aria-hidden="true">›</span>
          <span data-landing-terminal></span><span class="hero-terminal-cursor" aria-hidden="true"></span>
        </div>
        <div class="hero-pill"><span class="hero-live-dot" aria-hidden="true"></span><span><span data-member-counter data-suffix="+">40</span> Members and Growing</span><span class="hero-live-label">LIVE</span></div>
        <div class="hero-intro-frame">
          <iframe
            src="/intro-video.html"
            title="NoChat introduction"
            loading="eager"
            sandbox="allow-scripts"
            referrerpolicy="no-referrer"
            allow="autoplay"
          ></iframe>
        </div>
        <h1 class="hero-headline">Humans. <span class="accent">Not Algorithms.</span></h1>
        <p class="hero-subtext">
          A calmer corner of the internet, built around people, conversations and a feed that stays in chronological order. No surveillance advertising or black-box ranking deciding what you see.
        </p>

        <div class="hero-buttons">
          ${currentUser ? `
            <a href="#/home" class="btn btn-primary" style="height:48px; padding:0 28px; font-size:15px;">Enter NoChat Feed</a>
          ` : `
            <button class="btn btn-primary" data-action="open-auth" style="height:48px; padding:0 28px; font-size:15px;">Join NoChat — It's Free</button>
            <button class="btn btn-secondary" data-action="open-auth" style="height:48px; padding:0 24px; font-size:15px;">40+ Members Already Here</button>
          `}
        </div>

        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-number" data-member-counter data-suffix="+">40</span>
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
            <p>Profiles are created by people. Server-side rate limits and anti-spam checks help reduce automated abuse.</p>
          </article>

          <article class="feature-card">
            <div class="feature-icon"><i data-lucide="clapperboard"></i></div>
            <h3>Full-Screen Reels</h3>
            <p>Full-screen vertical reels with smooth snap scrolling, double-tap heart animations, music disc spinning, and instant comment bottom sheets.</p>
          </article>

          <article class="feature-card">
            <div class="feature-icon"><i data-lucide="message-circle"></i></div>
            <h3>Private & Group Chat</h3>
            <p>Direct messaging with message edits, reactions, replies, and privacy-focused account controls.</p>
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
          <article class="step-card">
            <div class="step-number">01</div>
            <h3 style="font-size:18px; font-weight:700; margin-bottom:8px;">Claim Your Human Number</h3>
            <p style="color:var(--muted); font-size:14px; line-height:1.6;">Register with your username. You receive a sequential member number (your own member number) forever.</p>
          </article>

          <article class="step-card">
            <div class="step-number">02</div>
            <h3 style="font-size:18px; font-weight:700; margin-bottom:8px;">Chronological Content</h3>
            <p style="color:var(--muted); font-size:14px; line-height:1.6;">See posts and reels in the exact order they were uploaded. No AI decides who deserves visibility.</p>
          </article>

          <article class="step-card">
            <div class="step-number">03</div>
            <h3 style="font-size:18px; font-weight:700; margin-bottom:8px;">Watch & Connect</h3>
            <p style="color:var(--muted); font-size:14px; line-height:1.6;">Enjoy open-source anime films, discuss them live in chat, and talk directly with creators.</p>
          </article>
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

      <section class="india-cta" aria-labelledby="india-cta-title">
        <div class="india-flag-art" aria-hidden="true">
          <svg viewBox="0 0 480 300" role="img" focusable="false">
            <defs>
              
            </defs>
            <path d="M14 35 Q120 12 232 42 T466 34 L466 104 Q350 122 232 105 T14 112Z" fill="#FF9933"/>
            <path d="M14 112 Q120 90 232 105 T466 104 L466 190 Q350 205 232 190 T14 190Z" fill="#FFFFFF"/>
            <path d="M14 190 Q120 175 232 190 T466 190 L466 266 Q350 286 232 262 T14 266Z" fill="#138808"/>
            <circle cx="240" cy="151" r="35" fill="none" stroke="#183b7a" stroke-width="4"/>
            <circle cx="240" cy="151" r="5" fill="#183b7a"/>
            <g stroke="#183b7a" stroke-width="2">
              <path d="M240 116V186 M205 151H275 M215.25 126.25L264.75 175.75 M264.75 126.25L215.25 175.75"/>
              <path d="M226.6 118.7L253.4 183.3 M208 137.6L272 164.4 M208 164.4L272 137.6 M226.6 183.3L253.4 118.7"/>
            </g>
            <path d="M14 35 Q120 12 232 42 T466 34" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="3"/>
          </svg>
        </div>
        <div class="india-cta-copy">
          <span class="india-cta-eyebrow">A homegrown social space</span>

          <h2 id="india-cta-title">NoChat</h2>
          <p>Proudly Made in <span class="india-accent">India</span> <span aria-label="India flag" role="img">🇮🇳</span></p>
          <button class="btn btn-primary india-cta-button" data-action="open-auth">
            <span>Start Watching — Free</span>
            <i data-lucide="arrow-up-right" aria-hidden="true"></i>
          </button>
        </div>
      </section>
      </main>

      ${renderFooter({ landing: true })}
    </div>
  `;
}
