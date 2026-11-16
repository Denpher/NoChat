/**
 * NoChat v4 - Standardized Global Footer
 * Present on EVERY page with authentic Denpher links.
 */

export function renderFooter() {
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
        <span class="footer-text">Made by <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer" class="footer-author">Denpher</a></span>
      </div>
    </footer>
  `;
}
