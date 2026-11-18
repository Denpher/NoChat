/**
 * NoChat — Trust & Safety
 * Public information page for platform safeguards and community standards.
 */
import { renderFooter } from '../components/Footer.js';

export function renderTrustSafetyPage() {
  return `
    <div class="nc-trust-page">
      <style>
        .nc-trust-page{--trust-lime:#C6FF3E;min-height:100%;padding:clamp(28px,5vw,64px) 18px;color:#f5f5f5;background:#0A0A0A}
        .nc-trust-page *{box-sizing:border-box}
        .nc-trust-page .trust-wrap{width:min(1040px,100%);margin:0 auto}
        .nc-trust-page .trust-hero{max-width:720px;margin:0 auto 34px;text-align:center}
        .nc-trust-page .trust-eyebrow{display:inline-flex;padding:7px 11px;border:1px solid rgba(198,255,62,.35);border-radius:999px;color:var(--trust-lime);background:rgba(198,255,62,.06);font-size:10px;font-weight:800;letter-spacing:.14em}
        .nc-trust-page h1{margin:16px 0 12px;font-size:clamp(30px,5vw,48px);line-height:1.08;letter-spacing:-.04em}
        .nc-trust-page h2{margin:0 0 9px;font-size:clamp(21px,3vw,28px);letter-spacing:-.025em}
        .nc-trust-page .trust-intro,.nc-trust-page .trust-section-intro{color:#a4a4a4;font-size:14px;line-height:1.75}
        .nc-trust-page .trust-section{margin:0 0 46px}
        .nc-trust-page .trust-section-head{margin-bottom:19px}
        .nc-trust-page .trust-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .nc-trust-page .trust-card{min-width:0;padding:20px;border:1px solid #292929;border-radius:14px;background:linear-gradient(145deg,#151515,#101010)}
        .nc-trust-page .trust-icon{display:grid;place-items:center;width:36px;height:36px;margin-bottom:13px;border:1px solid rgba(198,255,62,.2);border-radius:10px;color:var(--trust-lime);background:rgba(198,255,62,.07)}
        .nc-trust-page .trust-icon svg{width:18px;height:18px}
        .nc-trust-page .trust-card h3{margin:0 0 7px;font-size:14px;font-weight:750}
        .nc-trust-page .trust-card p{margin:0;color:#a5a5a5;font-size:12px;line-height:1.7}
        .nc-trust-page .trust-card a{color:var(--trust-lime)}
        .nc-trust-page .trust-data{display:grid;grid-template-columns:1fr 1fr;margin-top:13px;border:1px solid #292929;border-radius:14px;overflow:hidden;background:#111}
        .nc-trust-page .trust-data section{padding:20px}
        .nc-trust-page .trust-data section+section{border-left:1px solid #292929}
        .nc-trust-page .trust-data h3{margin:0 0 12px;color:var(--trust-lime);font-size:10px;letter-spacing:.13em}
        .nc-trust-page .trust-tags{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
        .nc-trust-page .trust-tags li{padding:7px 10px;border:1px solid #303030;border-radius:999px;color:#ddd;background:#181818;font-size:11px}
        .nc-trust-page .trust-policy{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-top:14px;padding:18px 20px;border:1px solid #292929;border-radius:14px;background:#111}
        .nc-trust-page .trust-policy nav{display:flex;flex-wrap:wrap;gap:8px}
        .nc-trust-page .trust-policy a{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 12px;border:1px solid #383838;border-radius:9px;color:#eee;font-size:12px;font-weight:700;text-decoration:none}
        .nc-trust-page a:hover,.nc-trust-page a:focus-visible{border-color:var(--trust-lime);color:var(--trust-lime);outline-offset:3px}
        .nc-trust-page .trust-note{margin-top:14px;color:#858585;font-size:11px;line-height:1.7}
        .nc-trust-page .trust-india{padding:clamp(22px,4vw,34px);border:1px solid rgba(198,255,62,.45);border-radius:18px;background:radial-gradient(ellipse at 50% 0%,rgba(198,255,62,.07),transparent 58%),#0e0e0e;text-align:center}
        .nc-trust-page .trust-flag{display:block;margin-bottom:10px;font-size:36px}
        .nc-trust-page .trust-points{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:20px;text-align:left}
        .nc-trust-page .trust-point{padding:14px;border:1px solid #292929;border-radius:12px;background:rgba(255,255,255,.025)}
        .nc-trust-page .trust-point strong{display:block;margin-bottom:5px;font-size:12px}
        .nc-trust-page .trust-point span{color:#aaa;font-size:11px;line-height:1.6}
        @media(max-width:720px){.nc-trust-page{padding:30px 14px}.nc-trust-page .trust-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.nc-trust-page .trust-data{grid-template-columns:1fr}.nc-trust-page .trust-data section+section{border-top:1px solid #292929;border-left:0}.nc-trust-page .trust-policy{align-items:flex-start;flex-direction:column}.nc-trust-page .trust-points{grid-template-columns:1fr}}
        @media(max-width:420px){.nc-trust-page .trust-grid{grid-template-columns:1fr}.nc-trust-page .trust-card{display:grid;grid-template-columns:34px minmax(0,1fr);gap:0 11px}.nc-trust-page .trust-icon{grid-row:span 2;margin:0}.nc-trust-page .trust-card h3{align-self:end}.nc-trust-page .trust-card p{grid-column:2}}
        @media(prefers-reduced-motion:reduce){.nc-trust-page *{scroll-behavior:auto!important;transition:none!important}}
      </style>
      <div class="trust-wrap">
        <header class="trust-hero">
          <span class="trust-eyebrow">NOCHAT · TRUST &amp; SAFETY</span>
          <h1>Clear standards. Practical safeguards.</h1>
          <p class="trust-intro">A straightforward look at the account, privacy and moderation measures used across NoChat. No security system can promise zero risk, so we explain what is in place without overstating it.</p>
        </header>
        <main>
          <section class="trust-section" aria-labelledby="trust-security-heading">
            <header class="trust-section-head"><h2 id="trust-security-heading">Account &amp; platform security</h2><p class="trust-section-intro">The controls below help protect account access and reduce abuse.</p></header>
            <div class="trust-grid">
              <article class="trust-card"><span class="trust-icon"><i data-lucide="shield-check" aria-hidden="true"></i></span><h3>HTTPS in transit</h3><p>Use the secure HTTPS version of NoChat to protect data while it travels between your browser and the service.</p></article>
              <article class="trust-card"><span class="trust-icon"><i data-lucide="lock" aria-hidden="true"></i></span><h3>Password hashing</h3><p>Passwords are stored as one-way hashes rather than readable passwords.</p></article>
              <article class="trust-card"><span class="trust-icon"><i data-lucide="timer" aria-hidden="true"></i></span><h3>Sign-in rate limits</h3><p>Authentication requests are rate-limited to reduce repeated automated sign-in attempts.</p></article>
              <article class="trust-card"><span class="trust-icon"><i data-lucide="bot" aria-hidden="true"></i></span><h3>Anti-spam checks</h3><p>Server-side checks look for rapid message bursts and repeated messages, then apply temporary cooldowns.</p></article>
              <article class="trust-card"><span class="trust-icon"><i data-lucide="shield-alert" aria-hidden="true"></i></span><h3>Moderation review</h3><p>Reported or flagged content can be reviewed under NoChat's moderation process.</p></article>
              <article class="trust-card"><span class="trust-icon"><i data-lucide="refresh-ccw" aria-hidden="true"></i></span><h3>Session revocation</h3><p>Account sessions can be revoked so older sign-in sessions no longer remain valid.</p></article>
              <article class="trust-card"><span class="trust-icon"><i data-lucide="flag" aria-hidden="true"></i></span><h3>Report a concern</h3><p>Use the <a href="#/contact">Contact page</a> to tell us about a safety or account issue.</p></article>
            </div>
          </section>
          <section class="trust-section" aria-labelledby="trust-data-heading">
            <header class="trust-section-head"><h2 id="trust-data-heading">Your information</h2><p class="trust-section-intro">NoChat needs some account and service information to run its features. The Privacy Policy explains the details.</p></header>
            <div class="trust-data">
              <section aria-labelledby="trust-used-heading"><h3 id="trust-used-heading">ACCOUNT INFORMATION USED</h3><ul class="trust-tags"><li>Username</li><li>Display name</li><li>Password hash</li><li>Optional email</li><li>Messages you send</li><li>Media you upload</li></ul></section>
              <section aria-labelledby="trust-not-heading"><h3 id="trust-not-heading">NOT USED FOR AD PROFILING</h3><ul class="trust-tags"><li>Ad tracking pixels</li><li>Ad profiling</li><li>Selling personal data</li></ul></section>
            </div>
            <p class="trust-note">We do not claim that NoChat stores all data in India. Please read the Privacy Policy for information about data handling and service providers.</p>
          </section>
          <section class="trust-section" aria-labelledby="trust-community-heading">
            <header class="trust-section-head"><h2 id="trust-community-heading">Community standards</h2><p class="trust-section-intro">A safer community depends on clear rules and people reporting problems.</p></header>
            <div class="trust-grid">
              <article class="trust-card"><span class="trust-icon"><i data-lucide="scale" aria-hidden="true"></i></span><h3>Respect the rules</h3><p>NoChat's Terms set expectations against harassment, hate, impersonation, spam and harmful uploads.</p></article>
              <article class="trust-card"><span class="trust-icon"><i data-lucide="users" aria-hidden="true"></i></span><h3>For younger users</h3><p>If you are under 18, involve a parent or trusted adult when deciding what to share online.</p></article>
              <article class="trust-card"><span class="trust-icon"><i data-lucide="message-square" aria-hidden="true"></i></span><h3>Get support</h3><p>Contact the team through the Contact page. We will review your message as soon as we can.</p></article>
            </div>
            <div class="trust-policy"><strong>Read the policies</strong><nav aria-label="NoChat policies"><a href="#/privacy">Privacy Policy</a><a href="#/terms">Terms of Service</a><a href="#/terms">Community Guidelines</a></nav></div>
          </section>
          <section class="trust-section trust-india" aria-labelledby="trust-india-heading">
            <span class="trust-flag" role="img" aria-label="Indian flag">🇮🇳</span><span class="trust-eyebrow">MADE IN INDIA</span>
            <h2 id="trust-india-heading" style="margin-top:14px;">Built with care. Made for people.</h2>
            <p class="trust-intro">An independent social platform built in India, with a focus on real connections and clear community standards.</p>
            <div class="trust-points"><div class="trust-point"><strong>Built in India</strong><span>Created by an independent Indian developer.</span></div><div class="trust-point"><strong>Free to join</strong><span>Core community features are available without a paid plan.</span></div><div class="trust-point"><strong>Community first</strong><span>Designed to support thoughtful and respectful connections.</span></div></div>
            <p class="trust-note">We aim to respect Indian culture and applicable law. This page is an overview, not a claim of government certification or legal approval.</p>
          </section>
        </main>
      </div>
    </div>
    ${renderFooter()}
  `;
}