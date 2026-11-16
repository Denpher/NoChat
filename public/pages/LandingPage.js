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

      ${renderFooter({ landing: true })}
    </div>
  `;
}
