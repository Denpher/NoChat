/**
 * NoChat v4 - Watch Party Video Card Component
 */

import { escapeHtml } from '../utils/dom.js';

export function renderWatchPartyCard(video, canManage = false) {
  const thumb = video.thumbnail || (video.provider === 'youtube' && video.embedId ? `https://i.ytimg.com/vi/${video.embedId}/hqdefault.jpg` : '/icons/icon-512.png');
  const title = escapeHtml(video.title);
  const channel = escapeHtml(video.channel || 'Official Channel');
  const seconds = Number(video.durationSec);
  const duration = video.duration || (seconds > 0 ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : 'Video');
  const rating = video.rating || '9.8';
  const platforms = video.streamPlatforms || ['YouTube Official'];
  const isFullMovie = video.isFullMovie || video.category === 'Full Movies';

  return `
    <article class="watch-card" data-video-id="${escapeHtml(video.id)}" data-embed-id="${escapeHtml(video.embedId || '')}" data-video-provider="${escapeHtml(video.provider || 'youtube')}" data-video-url="${escapeHtml(video.fileUrl || '')}">
      <div class="watch-poster-wrap">
        <img src="${thumb}" alt="${title}" class="watch-poster" loading="lazy" />
        <div class="watch-play-overlay">
          <div style="width:52px; height:52px; border-radius:50%; background:var(--accent-blue); display:flex; align-items:center; justify-content:center; box-shadow:var(--shadow-md);">
            <i data-lucide="play" style="width:24px; height:24px; fill:#fff; margin-left:3px;"></i>
          </div>
        </div>
        <div style="position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.75); padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600;">
          ${duration}
        </div>
        ${isFullMovie ? `
          <div style="position:absolute; top:8px; left:8px; background:var(--verified-mint); color:#000; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:800; text-transform:uppercase;">
            Full Movie
          </div>
        ` : ''}
      </div>

      <div class="watch-details">
        <div class="watch-meta">
          <span style="font-size:12px; color:var(--muted);">${channel}</span>
          <span class="badge badge-mint">⭐ ${rating}</span>
        </div>

        <h3 class="watch-title">${title}</h3>

        <div class="watch-platforms">
          ${platforms.map(p => `<span class="platform-tag">${escapeHtml(p)}</span>`).join('')}
        </div>

        <div style="margin-top:auto; padding-top:12px; display:flex; gap:8px;">
          <button type="button" class="btn btn-primary btn-sm" style="flex:1;" data-action="watch-video" data-video-id="${escapeHtml(video.id)}" data-provider="${escapeHtml(video.provider || 'youtube')}" data-embed-id="${escapeHtml(video.embedId || '')}" data-embed-url="${escapeHtml(video.embedUrl || '')}" data-video-url="${escapeHtml(video.fileUrl || '')}" data-title="${title}">
            <i data-lucide="play"></i> Watch Now
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="discuss-chat" data-title="${title}" title="Discuss in Chat" aria-label="Discuss ${title} in chat">
            <i data-lucide="message-circle"></i>
          </button>
          ${canManage ? `<button type="button" class="btn btn-secondary btn-sm" data-action="delete-catalog-video" data-video-id="${escapeHtml(video.id)}" aria-label="Delete ${title}" title="Delete video"><i data-lucide="trash-2"></i></button>` : ''}
        </div>
      </div>
    </article>
  `;
}
