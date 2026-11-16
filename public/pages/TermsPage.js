/**
 * NoChat v4 - /terms (Terms of Service Page)
 */

import { renderFooter } from '../components/Footer.js';

export function renderTermsPage() {
  return `
    <div class="legal-page-container">
      <div class="legal-card">
        <h1>Terms of Service</h1>
        <div class="legal-date">Last Updated: November 2026 • Effective Immediately</div>

        <div class="legal-content">
          <section>
            <h2>1. Welcome to NoChat</h2>
            <p>NoChat is an authentic human-to-human communication platform developed by Denpher Technologies. By accessing or using NoChat, you agree to abide by these Terms of Service.</p>
          </section>

          <section>
            <h2>2. Real Humans Only — Zero Tolerance for Bots</h2>
            <p>NoChat is reserved exclusively for living human beings. Automated bot accounts, scraping spiders, engagement farms, artificial comment loops, and fake accounts are strictly prohibited and subject to immediate termination.</p>
          </section>

          <section>
            <h2>3. Code of Conduct: No Hate, No Harassment, No Spam</h2>
            <p>Every member of NoChat is expected to treat fellow humans with dignity. The following behaviors are grounds for immediate suspension or permanent ban:</p>
            <ul>
              <li>Hate speech, racism, threats of physical harm, or harassment.</li>
              <li>Mass automated direct messaging, unsolicited advertising, or spam campaigns.</li>
              <li>Impersonating existing members, creators, or the founder.</li>
              <li>Uploading malicious payloads, exploits, or non-consensual imagery.</li>
            </ul>
          </section>

          <section>
            <h2>4. Administrative & Moderation Enforcement</h2>
            <p>The NoChat administrative team reserves the right to review reported reels, suspend accounts violating community standards, revoke active sessions, or permanently ban malicious actors to ensure safety for all real humans.</p>
          </section>

          <section>
            <h2>5. Verified Human Rules</h2>
            <p>The Verified badge (Mint Green Check) is a display indicator of identity confirmation and community trust. Badges may be temporary (5 days, 30 days) or permanent. Verified status cannot be purchased, does not grant administrative privileges, and may be revoked if the account violates terms.</p>
          </section>

          <section>
            <h2>6. Third-Party Content & Watch Party</h2>
            <p>NoChat provides embedded previews and metadata of official movie trailers and open-source films hosted on YouTube and Creative Commons studio repositories. <strong>NoChat does not host copyright-protected video files</strong>.</p>
          </section>

          <section>
            <h2>7. Governing Structure</h2>
            <p>These terms are governed by the creator guidelines established by Denpher Technologies. Discover more at <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer" style="color:var(--accent-blue);">Denpher Technologies</a>.</p>
          </section>
        </div>
      </div>
    </div>
    ${renderFooter()}
  `;
}
