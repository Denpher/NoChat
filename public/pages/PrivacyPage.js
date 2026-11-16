/**
 * NoChat v4 - /privacy (Privacy Policy Page)
 */

import { renderFooter } from '../components/Footer.js';

export function renderPrivacyPage() {
  return `
    <div class="legal-page-container">
      <div class="legal-card">
        <h1>Privacy Policy</h1>
        <div class="legal-date">Last Updated: November 2026 • Effective Immediately</div>

        <div class="legal-content">
          <section>
            <h2>1. Our First Policy: Privacy First</h2>
            <p>At NoChat, founded by Denpher Technologies, privacy is not an afterthought or an optional toggle — it is the architectural foundation of everything we build. We believe social platforms should connect real humans without extracting, profiling, or monetizing their personal lives.</p>
          </section>

          <section>
            <h2>2. What Data We Collect</h2>
            <p>We only collect the absolute minimum data required to deliver real-time messaging and reels to you:</p>
            <ul>
              <li><strong>Account Credentials:</strong> Your chosen display name, unique username, encrypted password hash (bcrypt), and optional email for account recovery.</li>
              <li><strong>Direct Messages:</strong> Private messages and attachments exchanged between you and your connections. Messages are encrypted in transit and stored strictly for communication delivery.</li>
              <li><strong>Reels & Media:</strong> Videos, captions, and audio titles you voluntarily publish to your profile or feed.</li>
              <li><strong>Social Connections:</strong> Your subscriptions and mutual friendships to display your feed and direct message list.</li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Data</h2>
            <p>Your data is used exclusively to operate NoChat features: authenticating your login, sending your messages to friends, showing your reels to humans, and calculating your sequential Human Member Number (e.g. #21).</p>
          </section>

          <section>
            <h2>4. We Never Sell Data</h2>
            <p>We do not sell, rent, license, or barter your personal information, chats, reels, or activity logs to data brokers, advertisers, or third parties under any circumstances. There is no hidden data harvesting pipeline.</p>
          </section>

          <section>
            <h2>5. Zero Ads Tracking</h2>
            <p>NoChat contains <strong>0 advertising networks</strong>, 0 tracking pixels, 0 behavioral profiling algorithms, and 0 third-party surveillance scripts. We do not track you across the web or spy on your keystrokes.</p>
          </section>

          <section>
            <h2>6. How to Delete Your Account</h2>
            <p>You have full ownership of your data. You may request account deletion at any time directly through your profile settings or by contacting us at <a href="#/contact" style="color:var(--accent-blue);">Contact Us</a>. Upon confirmation, your profile, sessions, messages, and uploaded reels are permanently deleted or soft-deleted per your instructions.</p>
          </section>

          <section>
            <h2>7. Contact & Inquiries</h2>
            <p>For any privacy-related questions or data deletion requests, visit our <a href="#/contact" style="color:var(--accent-blue);">Contact Us</a> page or learn more about the founder at <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer" style="color:var(--accent-blue);">Denpher Portfolio</a>.</p>
          </section>
        </div>
      </div>
    </div>
    ${renderFooter()}
  `;
}
