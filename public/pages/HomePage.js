/**
 * NoChat v4 - Home Feed Page (470px)
 */

import { renderPostCard } from '../components/PostCard.js';
import { renderStoryCircle } from '../components/StoryCircle.js';
import { renderWelcomeBanner, renderAnnouncementBanner } from '../components/AnnouncementBanner.js';
import { renderFooter } from '../components/Footer.js';

export function renderHomePage({ posts = [], users = [], currentUser = null, announcement = null }) {
  // Sort posts chronologically (real data only)
  const sortedPosts = [...posts].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return `
    <div class="feed-container">
      ${renderWelcomeBanner(currentUser)}
      ${renderAnnouncementBanner(announcement)}

      <!-- Stories Row (56px circles) -->
      <section class="stories-bar" aria-label="Stories">
        ${renderStoryCircle(currentUser, false)}
        ${users.filter(u => u.id !== currentUser?.id).slice(0, 15).map(u => renderStoryCircle(u, true)).join('')}
      </section>

      <!-- Post Feed (470px Cards) -->
      <main class="posts-stream">
        ${sortedPosts.length === 0 ? `
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-card); padding:48px 24px; text-align:center;">
            <div style="width:64px; height:64px; border-radius:50%; background:var(--card); display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
              <i data-lucide="clapperboard" style="width:28px;height:28px;color:var(--muted);"></i>
            </div>
            <h3 style="font-size:16px; font-weight:700; margin-bottom:8px;">No Posts Yet</h3>
            <p style="color:var(--muted); font-size:13px; margin-bottom:20px;">Be the first human to share a reel or photo!</p>
            <button class="btn btn-primary" data-action="open-upload-modal">
              <i data-lucide="plus"></i>
              <span>Create Reel</span>
            </button>
          </div>
        ` : sortedPosts.map(p => renderPostCard(p, currentUser)).join('')}
      </main>
    </div>
    ${renderFooter()}
  `;
}
