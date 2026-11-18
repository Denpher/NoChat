/**
 * NoChat v4 - Standardized Global Footer
 * Present on EVERY page with authentic Denpher links.
 */

const socialLinks = `
  <nav class="footer-socials" aria-label="Denpher social profiles">
    <a href="https://www.youtube.com/@denpher_ai" target="_blank" rel="noopener noreferrer" aria-label="Denpher on YouTube" title="YouTube · @denpher_ai">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z"/></svg>
    </a>
    <a href="https://www.instagram.com/denpherai/" target="_blank" rel="noopener noreferrer" aria-label="Denpher on Instagram" title="Instagram · @denpherai">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2.2A2.8 2.8 0 0 0 4.2 7v10A2.8 2.8 0 0 0 7 19.8h10a2.8 2.8 0 0 0 2.8-2.8V7A2.8 2.8 0 0 0 17 4.2H7Zm5 2.1a5.7 5.7 0 1 1 0 11.4 5.7 5.7 0 0 1 0-11.4Zm0 2.2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm5.9-3.3a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z"/></svg>
    </a>
    <a href="https://x.com/denpherai" target="_blank" rel="noopener noreferrer" aria-label="Denpher on X" title="X · @denpherai">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.7 5.7 22H2.5l7.3-8.4L1.8 2h6.5l4.5 6.7L18.9 2Zm-1.1 17.9h1.7L7.3 4H5.5l12.3 15.9Z"/></svg>
    </a>
  </nav>`;

export function renderFooter({ landing = false } = {}) {
  if (landing) return `
    <footer class="global-footer landing-footer">
      <a class="landing-footer-wordmark" href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer" aria-label="Denpher Technologies">
        <span data-wordmark="DENPHER">DENPHER</span>
      </a>
      <div class="landing-footer-lower">
        ${socialLinks}
        <div class="footer-content">
          <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer" class="footer-link">About</a>
          <a href="#/privacy" class="footer-link">Privacy</a>
          <a href="#/terms" class="footer-link">Terms</a>
          <a href="#/contact" class="footer-link">Contact</a>
          <a href="#/trust-safety" class="footer-india-link" aria-label="India — Trust and Safety" title="India — Trust and Safety">🇮🇳</a>
          <span class="footer-text">Developed &amp; designed by <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer" class="footer-author">Denpher Technologies</a></span>
        </div>
      </div>
    </footer>`;
  return `
    <footer class="global-footer">
      <div class="footer-content">
        <span class="footer-brand">NoChat</span>
        <span class="footer-divider">|</span>
        <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer" class="footer-link">About Us</a>
        <span class="footer-divider">|</span>
        <a href="#/privacy" class="footer-link">Privacy</a>
        <span class="footer-divider">|</span>
        <a href="#/terms" class="footer-link">Terms</a>
        <span class="footer-divider">|</span>
        <a href="#/contact" class="footer-link">Contact</a>
        <span class="footer-divider">|</span>
        <a href="#/trust-safety" class="footer-india-link" aria-label="India — Trust and Safety" title="India — Trust and Safety">🇮🇳</a>
        <span class="footer-divider">|</span>
        <span class="footer-text">Developed &amp; designed by <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer" class="footer-author">Denpher Technologies</a></span>
      </div>
    </footer>
  `;
}
