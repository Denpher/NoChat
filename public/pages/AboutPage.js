/**
 * NoChat v4 - /about (About Us Page)
 * Authentic story, mission, and live links to Denpher's official portfolio.
 */

import { renderFooter } from '../components/Footer.js';

export function renderAboutPage() {
  return `
    <div class="legal-page-container">
      <div class="legal-card" style="text-align:center;">
        <span class="badge badge-mint" style="margin-bottom:16px;">Humans. Not Algorithms.</span>
        <h1 style="font-size:36px; margin-bottom:16px;">About NoChat</h1>
        <p style="font-size:16px; color:var(--muted); max-width:600px; margin:0 auto 36px; line-height:1.6;">
          NoChat was created with one single, stubborn conviction: social media was meant to connect real people, not addict them to black-box dopamine algorithms.
        </p>

        <div class="stats-bar" style="margin: 0 auto 48px;">
          <div class="stat-item">
            <span class="stat-number">21</span>
            <span class="stat-label">Real Humans</span>
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

        <div class="legal-content" style="text-align:left;">
          <section>
            <h2>Who Built NoChat?</h2>
            <p>
              NoChat was envisioned, architected, and built by <strong>Denpher</strong>, founder of Denpher Technologies. Starting software and hardware engineering at age 14, Denpher designed NoChat to prove that high-performance social technology can exist with 100% privacy and zero surveillance capitalism.
            </p>
          </section>

          <section>
            <h2>Why Was NoChat Built?</h2>
            <p>
              Modern social platforms are optimized for screen addiction, outrage harvesting, and fake engagement bot farms. Real human connections were buried under sponsored reels and manipulative recommendations. NoChat strips all of that away: chronological feeds, direct messaging with 15-minute edits, real-time video calling, verified sequential human member numbers (#1 to #21), and honest trailer watch parties.
            </p>
          </section>

          <section>
            <h2>Our Core Mission</h2>
            <p style="font-size:18px; font-weight:600; color:#fff; border-left:3px solid var(--accent-blue); padding-left:16px; margin:16px 0;">
              "Humans. Not Algorithms. Built for humans, by a human, for the Earth."
            </p>
            <p>
              Every single account inside NoChat belongs to an authentic person. No ghost followers. No AI spam slop. Just genuine conversations between humans.
            </p>
          </section>
        </div>

        <!-- Founder Spotlight Card -->
        <div class="founder-card" style="margin:40px auto 24px; border:1px solid var(--border-light); background:var(--card);">
          <div style="width:72px; height:72px; border-radius:50%; background:var(--surface); border:2px solid var(--accent-blue); margin:0 auto 16px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
            <img src="/icons/icon-192.png" alt="Denpher" style="width:100%; height:100%; object-fit:cover;" />
          </div>
          <h3 style="font-size:18px; font-weight:700; margin-bottom:4px;">Denpher</h3>
          <p style="font-size:13px; color:var(--muted); margin-bottom:16px;">Founder & Official Creator · NoChat & Denpher Technologies</p>
          <p style="font-size:14px; color:var(--text); line-height:1.6; margin-bottom:24px;">
            "We don't need algorithms to tell us what to feel. We need honest tools to talk to each other."
          </p>
          <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
            <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
              <i data-lucide="external-link"></i> Know The Founder
            </a>
            <a href="#/contact" class="btn btn-secondary">
              <i data-lucide="mail"></i> Contact Denpher
            </a>
          </div>
        </div>
      </div>
    </div>
    ${renderFooter()}
  `;
}
