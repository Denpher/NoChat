/**
 * NoChat v4 - Watch Party Page (Real Full Anime Movies & Official Trailers)
 */

import { renderWatchPartyCard } from '../components/WatchPartyCard.js';
import { renderFooter } from '../components/Footer.js';

export function renderWatchPartyPage({ videos = [], activeCategory = 'All' }) {
  const filtered = activeCategory === 'All'
    ? videos
    : videos.filter(v => v.category === activeCategory || (activeCategory === 'Full Movies' && v.isFullMovie));

  const categories = ['All', 'Full Movies', 'Anime', 'Trailers', 'Entertainment'];

  return `
    <div class="watch-container">
      <div class="disclaimer-banner">
        <i data-lucide="info" style="color:var(--accent-blue); width:20px; height:20px; flex-shrink:0;"></i>
        <span>
          <strong>Legal Disclaimer:</strong> NoChat does not host movies. All media consists of official, legal YouTube embeds directly from authorized rights holders, Blender Foundation open movies, and Creative Commons anime studios.
        </span>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:16px;">
        <div>
          <h1 style="font-size:24px; font-weight:800; letter-spacing:-0.5px;">Watch Party & Open Anime Cinema</h1>
          <p style="font-size:14px; color:var(--muted);">Stream full open-source anime films and official theatrical trailers together.</p>
        </div>
      </div>

      <!-- Filter Tabs -->
      <nav class="watch-filter-tabs" aria-label="Video categories">
        ${categories.map(cat => `
          <button class="watch-tab-btn ${activeCategory === cat ? 'active' : ''}" data-category="${cat}">
            ${cat === 'Full Movies' ? '🎬 Full Movies (CC)' : cat}
          </button>
        `).join('')}
      </nav>

      <!-- Video Grid -->
      <main class="watch-grid">
        ${filtered.length === 0 ? `
          <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--muted);">
            No videos in this category.
          </div>
        ` : filtered.map(v => renderWatchPartyCard(v)).join('')}
      </main>
    </div>

    <!-- YouTube Embed Video Player Modal -->
    <div class="modal-overlay hidden" id="video-player-modal">
      <div class="modal-box" style="max-width:880px; background:#000; padding:0; overflow:hidden;">
        <div style="padding:14px 20px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border);">
          <h3 id="video-player-title" style="font-size:15px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80%;">Watch Party</h3>
          <button class="btn-icon" data-action="close-video-modal"><i data-lucide="x"></i></button>
        </div>
        <div style="position:relative; width:100%; aspect-ratio:16/9; background:#000;">
          <iframe id="video-player-iframe" src="" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%; height:100%; border:none;"></iframe>
        </div>
        <div style="padding:14px 20px; display:flex; justify-content:space-between; align-items:center; background:var(--surface);">
          <span style="font-size:12px; color:var(--muted);">Streaming via official rights holder embed</span>
          <button class="btn btn-primary btn-sm" id="video-discuss-btn"><i data-lucide="message-circle"></i> Discuss in Chat</button>
        </div>
      </div>
    </div>

    ${renderFooter()}
  `;
}
