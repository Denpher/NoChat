/**
 * NoChat v4 - Landing Navbar (64px Sticky Blur)
 */

export function renderNavbar(currentUser = null) {
  return `
    <nav class="landing-nav">
      <div class="landing-nav-inner">
        <a href="#/" class="logo" style="display:flex; align-items:center; gap:10px; font-size:22px; font-weight:800; letter-spacing:-0.5px; text-decoration:none; color:#fff;">
          <img src="/icons/icon.svg" alt="NoChat" style="width:32px; height:32px; border-radius:8px; object-fit:cover;" />
          <span>NoChat</span>
        </a>
        <div class="landing-links">
          <a href="#/about">About</a>
          <a href="#features">Features</a>
          <a href="https://denpher-portfolio-6xe8.vercel.app/" target="_blank" rel="noopener noreferrer">Founder</a>
        </div>
        <div>
          ${currentUser ? `
            <a href="#/home" class="btn btn-primary btn-sm">Open Feed</a>
          ` : `
            <button class="btn btn-primary btn-sm" data-action="open-auth">Join NoChat</button>
          `}
        </div>
      </div>
    </nav>
  `;
}
