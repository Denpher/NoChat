/**
 * NoChat v4 - /contact (Contact Us Page)
 */

import { renderFooter } from '../components/Footer.js';

export function renderContactPage() {
  return `
    <div class="legal-page-container">
      <div class="legal-card">
        <h1>Contact Us</h1>
        <p style="color:var(--muted); font-size:15px; margin-bottom:28px;">
          Have questions, security reports, or want to connect with the team? Reach out directly.
        </p>

        <div style="display:flex; flex-wrap:wrap; gap:24px; margin-bottom:32px;">
          <div style="flex:1; min-width:240px; background:var(--card); padding:20px; border-radius:var(--radius-card); border:1px solid var(--border);">
            <div style="font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Official Email</div>
            <a href="mailto:contact@nochat.app" style="color:var(--accent-blue); font-weight:600; font-size:15px;">contact@nochat.app</a>
          </div>

          <div style="flex:1; min-width:240px; background:var(--card); padding:20px; border-radius:var(--radius-card); border:1px solid var(--border);">
            <div style="font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Founder Portfolio</div>
            <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer" style="color:var(--accent-blue); font-weight:600; font-size:15px;">
              denpher-portfolio-6xe8.vercel.app ↗
            </a>
          </div>
        </div>

        <form id="contact-form" class="contact-form">
          <div class="form-field">
            <label for="contact-name">Your Full Name</label>
            <input type="text" id="contact-name" name="name" placeholder="John Doe" required />
          </div>

          <div class="form-field">
            <label for="contact-email">Your Email Address</label>
            <input type="email" id="contact-email" name="email" placeholder="you@domain.com" required />
          </div>

          <div class="form-field">
            <label for="contact-message">Message</label>
            <textarea id="contact-message" name="message" rows="5" placeholder="Tell us how we can help..." required></textarea>
          </div>

          <p id="contact-feedback" class="hidden" style="padding:10px 14px; border-radius:var(--radius-btn); font-size:13px;"></p>

          <button type="submit" class="btn btn-primary" id="contact-submit-btn" style="height:44px; margin-top:8px;">
            <i data-lucide="send"></i>
            <span>Send Message</span>
          </button>
        </form>
      </div>
    </div>
    ${renderFooter()}
  `;
}
