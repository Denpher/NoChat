/**
 * NoChat v4 - Full-Screen Vertical Reels Page
 */

import { renderReelItem } from '../components/ReelPlayer.js';

export function renderReelsPage({ reels = [], currentUser = null, followingIds = new Set() }) {
  if (reels.length === 0) {
    return `
      <div style="height:calc(100vh - var(--navbar-height)); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:24px;">
        <div style="width:72px; height:72px; border-radius:50%; background:var(--card); display:flex; align-items:center; justify-content:center; margin-bottom:16px;">
          <i data-lucide="clapperboard" style="width:36px; height:36px; color:var(--muted);"></i>
        </div>
        <h2 style="font-size:20px; font-weight:700; margin-bottom:8px;">No Reels Found</h2>
        <p style="color:var(--muted); font-size:14px; margin-bottom:24px;">Upload the first vertical reel to start the feed.</p>
        <button class="btn btn-primary" data-action="open-upload-modal">
          <i data-lucide="plus"></i>
          <span>Upload Reel</span>
        </button>
      </div>
    `;
  }

  return `
    <div style="position:relative; height:calc(100vh - var(--navbar-height)); width:100%; overflow:hidden;">
      <!-- Floating Upload Reel Button -->
      <div style="position:absolute; top:20px; right:20px; z-index:30;">
        <button class="btn btn-primary btn-sm" data-action="open-upload-modal" style="box-shadow:var(--shadow-md); border-radius:20px;">
          <i data-lucide="plus"></i>
          <span>Post Reel</span>
        </button>
      </div>

      <div class="reels-container" id="reels-snap-feed">
        ${reels.map(r => renderReelItem(r, currentUser, followingIds.has(r.userId))).join('')}
      </div>
    </div>
  `;
}
