const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be']);

export function parseYouTubeId(value = '') {
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || !YT_HOSTS.has(url.hostname.toLowerCase())) return '';
    let id = '';
    if (url.hostname.toLowerCase() === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
    else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] || '';
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
}

export function youtubeEmbedUrl(id, origin = location.origin) {
  const params = new URLSearchParams({ autoplay: '0', rel: '0', modestbranding: '1', playsinline: '1', enablejsapi: '1', controls: '1', mute: '1', origin });
  return `https://www.youtube.com/embed/${id}?${params}`;
}

export function playerMarkup(id, title = 'Watch Party') {
  const safeTitle = String(title).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if (!id) return `<section class="v2-player-error"><strong>Invalid YouTube Link</strong><label>Paste a YouTube link<input data-player-url type="url" placeholder="https://youtube.com/watch?v=…"></label><button type="button" data-player-load>Load video</button></section>`;
  return `<section class="v2-player" data-youtube-id="${id}"><div class="v2-player-frame"><iframe title="YouTube video player" src="${youtubeEmbedUrl(id)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="v2-player-fallback hidden"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="YouTube thumbnail"><div><p>Video unavailable or taking too long to load.</p><button type="button" data-open-youtube="${id}">Open in YouTube</button><button type="button" data-tap-play>Tap to Play</button></div></div></div><div class="v2-player-controls"><button type="button" data-yt-command="playVideo">Play / Pause</button><button type="button" data-yt-command="mute">Mute / Unmute</button><button type="button" data-player-fullscreen>Fullscreen</button><label>Volume <input data-player-volume type="range" min="0" max="100" value="100"></label><label>Progress <input data-player-progress type="range" min="0" max="100" value="0"></label><span>Quality: Auto</span></div><h3>${safeTitle}</h3><p>YouTube · Official video</p></section>`;
}

export function activatePlayer(container, id) {
  const iframe = container?.querySelector('iframe');
  const fallback = container?.querySelector('.v2-player-fallback');
  if (!iframe || !id) return;
  let playing = false; let muted = true;
  setTimeout(() => fallback?.classList.remove('hidden'), 3000);
  container.addEventListener('click', e => {
    const command = e.target.closest('[data-yt-command]')?.dataset.ytCommand;
    const msg = command === 'mute' ? (muted ? 'unMute' : 'mute') : (playing ? 'pauseVideo' : 'playVideo');
    if (command) { iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: msg, args: [] }), 'https://www.youtube.com'); if (command === 'mute') { muted = !muted; const control=e.target.closest('[data-yt-command]'); if(control) control.textContent=muted?'Unmute':'Mute'; } else { playing = !playing; const control=e.target.closest('[data-yt-command]'); if(control) control.textContent=playing?'Pause':'Play'; } }
    if (e.target.closest('[data-open-youtube]')) window.open(`https://www.youtube.com/watch?v=${id}`, '_blank', 'noopener');
    if (e.target.closest('[data-tap-play]')) { fallback?.classList.add('hidden'); iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 'https://www.youtube.com'); }
    if (e.target.closest('[data-player-fullscreen]')) iframe.requestFullscreen?.();
    if (e.target.matches('[data-player-volume]')) iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [Number(e.target.value)] }), 'https://www.youtube.com');
    if (e.target.matches('[data-player-progress]')) iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [Number(e.target.value), true] }), 'https://www.youtube.com');
  });
  container.addEventListener('click', e => { if (e.target.closest('.v2-player-frame iframe')) iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 'https://www.youtube.com'); });
}

export function mountYouTubeReels(root = document) {
  root.querySelectorAll('.reel-video').forEach(video => {
    video.setAttribute('controls', ''); video.setAttribute('preload', 'metadata'); video.setAttribute('playsinline', ''); video.muted = true; video.loop = true;
    const id = parseYouTubeId(video.currentSrc || video.src);
    if (!id || video.dataset.v2Player === '1') return;
    video.dataset.v2Player = '1';
    const wrapper = document.createElement('div');
    wrapper.className = 'v2-reel-player';
    wrapper.innerHTML = `<iframe title="YouTube video player" src="${youtubeEmbedUrl(id)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><a href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">Open in YouTube</a>`;
    video.replaceWith(wrapper);
  });
}
