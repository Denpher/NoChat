// NoChat Videos: embedded official videos + founder-only management + durable, de-duplicated view counts.
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { SEED_VIDEOS } from './videos-catalog.js';

export const VIDEO_CATEGORIES = ['Anime', 'Movies', 'Trailers', 'Entertainment'];
export const MAX_UPLOAD_SECONDS = 15 * 60;
const YT_ID = /^[\w-]{11}$/;

/** Accepts YouTube (watch, youtu.be, shorts, embed, nocookie) and Vimeo links. Anything else is rejected. */
export function parseEmbed(input) {
  let url;
  try { url = new URL(String(input || '').trim()); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else { const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/); if (m) id = m[1]; }
  } else if (host === 'youtu.be') id = url.pathname.slice(1, 12);
  if (id && YT_ID.test(id)) return { provider: 'youtube', embedId: id };
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = url.pathname.match(/(?:^|\/)(\d{6,12})(?:\/|$)/);
    if (m) return { provider: 'vimeo', embedId: m[1] };
  }
  return null;
}

export function embedUrl(video) {
  if (video.provider === 'youtube') return `https://www.youtube-nocookie.com/embed/${video.embedId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
  if (video.provider === 'vimeo') return `https://player.vimeo.com/video/${video.embedId}?dnt=1&title=0&byline=0`;
  return null;
}
export function thumbnailFor(video) {
  if (video.thumbnail) return video.thumbnail;
  if (video.provider === 'youtube') return `https://i.ytimg.com/vi/${video.embedId}/mqdefault.jpg`;
  return null;
}

/** One genuine start per (viewer, video) per window. Repeated player events inside the window never count. */
export function createViewDeduper(windowMs = 30 * 60 * 1000, maxEntries = 100000) {
  const seen = new Map();
  return {
    shouldCount(viewerId, videoId, now = Date.now()) {
      const key = viewerId + '\u0000' + videoId;
      const last = seen.get(key);
      if (last !== undefined && now - last < windowMs) return false;
      seen.set(key, now);
      if (seen.size > maxEntries) for (const [k, t] of seen) { if (now - t >= windowMs) seen.delete(k); if (seen.size <= maxEntries / 2) break; }
      return true;
    }
  };
}

/** Reads the real duration of an uploaded file with the bundled FFmpeg. */
export async function probeDurationSeconds(buffer) {
  const file = path.join(os.tmpdir(), 'nochat-probe-' + crypto.randomUUID());
  await fs.promises.writeFile(file, buffer);
  try {
    const stderr = await new Promise((resolve, reject) => {
      const p = spawn(ffmpeg, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
      let out = ''; p.stderr.on('data', (d) => { out += d; });
      const t = setTimeout(() => p.kill('SIGKILL'), 20000);
      p.on('error', reject); p.on('close', () => { clearTimeout(t); resolve(out); });
    });
    const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
  } finally { fs.promises.unlink(file).catch(() => {}); }
}
async function posterFrame(buffer) {
  return new Promise((resolve) => {
    const p = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-ss', '1', '-i', 'pipe:0', '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '6', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1'], { stdio: ['pipe', 'pipe', 'ignore'] });
    const chunks = []; p.stdout.on('data', (c) => chunks.push(c));
    p.on('error', () => resolve(null)); p.on('close', () => resolve(chunks.length ? Buffer.concat(chunks) : null));
    p.stdin.on('error', () => {}); p.stdin.end(buffer);
    setTimeout(() => p.kill('SIGKILL'), 20000);
  });
}

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

export function mountVideos({ app, db, authenticate, saveDB, canManageVideos, persistFile, removeStoredFile, uploadVideo, schema, addLog }) {
  db.videos ??= [];
  // Seed the preloaded catalog once. Founder deletions are soft (deletedAt), so seeds never come back.
  const known = new Set(db.videos.map((v) => v.id));
  const now = new Date().toISOString();
  for (const seed of SEED_VIDEOS) if (!known.has(seed.id)) db.videos.push({ ...seed, views: 0, seed: true, createdAt: now });

  const deduper = createViewDeduper(Number(process.env.VIDEO_VIEW_WINDOW_MINUTES || 30) * 60 * 1000);
  // Coalesce view writes: every request in the same ~1 s window waits for the SAME durable save,
  // so a count is only acknowledged after it is stored, without one database write per view.
  let pendingSave = null;
  const durableSave = () => {
    if (!pendingSave) pendingSave = new Promise((r) => setTimeout(r, 1000)).then(() => { pendingSave = null; return saveDB(); });
    return pendingSave;
  };
  const route = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
  const live = () => db.videos.filter((v) => !v.deletedAt);
  const view = (v, manage) => ({
    id: v.id, title: v.title, description: v.description || '', category: v.category, channel: v.channel || 'NoChat', watchUrl: v.watchUrl || null,
    provider: v.provider, embedId: v.provider === 'upload' ? null : v.embedId, embedUrl: embedUrl(v), fileUrl: v.provider === 'upload' ? v.fileUrl : null,
    thumbnail: thumbnailFor(v), durationSec: v.durationSec ?? null, views: schema.videos ? Number(v.views) || 0 : null,
    createdAt: v.createdAt, ...(manage ? { seed: Boolean(v.seed) } : {})
  });
  const requireFounder = async (req, res) => {
    if (await canManageVideos(req.user)) return true;
    addLog?.(db, { kind: 'audit', actorId: req.user.id, actorUsername: req.user.username, action: 'video-manage', outcome: 'denied', path: req.path });
    res.status(403).json({ error: 'Only the NoChat founder can manage videos.' });
    return false;
  };
  const requirePersistent = (res) => {
    if (schema.videos) return true;
    res.status(503).json({ error: 'Video storage is not enabled yet. Apply database/migrations/2026-11-13-v3.3-videos.sql in Lovable Cloud and restart.', code: 'VIDEO_SCHEMA_MISSING' });
    return false;
  };
  const validateMeta = (body, partial) => {
    const out = {};
    if (!partial || body.title !== undefined) { out.title = clean(body.title, 120); if (out.title.length < 2) throw Object.assign(new Error('Title must be at least 2 characters.'), { status: 400 }); }
    if (!partial || body.category !== undefined) { out.category = clean(body.category, 30); if (!VIDEO_CATEGORIES.includes(out.category)) throw Object.assign(new Error('Choose a valid category.'), { status: 400 }); }
    if (body.description !== undefined) out.description = clean(body.description, 1000);
    if (body.channel !== undefined) out.channel = clean(body.channel, 80) || 'NoChat';
    if (body.watchUrl !== undefined) {
      const raw = clean(body.watchUrl, 500);
      if (!raw) out.watchUrl = null;
      else {
        let parsed;
        try { parsed = new URL(raw); } catch { throw Object.assign(new Error('Where to Watch must be a valid HTTPS URL.'), { status: 400 }); }
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw Object.assign(new Error('Where to Watch must be a valid HTTPS URL.'), { status: 400 });
        out.watchUrl = parsed.toString();
      }
    }
    return out;
  };
  const fail = (res, e) => res.status(e.status || 400).json({ error: e.message });

  app.get('/api/videos', authenticate, route(async (req, res) => {
    const q = clean(req.query.q, 80).toLowerCase();
    const category = VIDEO_CATEGORIES.includes(req.query.category) ? req.query.category : null;
    const sort = req.query.sort === 'popular' ? 'popular' : 'latest';
    const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));
    const page = Math.max(1, Number(req.query.page) || 1);
    let list = live().filter((v) => (!category || v.category === category) && (!q || `${v.title} ${v.description} ${v.channel} ${v.category}`.toLowerCase().includes(q)));
    // Stable sorts: newest founder additions first, then the curated catalog order.
    list = list.slice().sort((a, b) => sort === 'popular' ? (b.views || 0) - (a.views || 0) : String(b.createdAt).localeCompare(String(a.createdAt)));
    const manage = await canManageVideos(req.user);
    res.set('Cache-Control', 'no-store').json({
      videos: list.slice((page - 1) * limit, page * limit).map((v) => view(v, manage)), page, total: list.length,
      hasMore: page * limit < list.length, categories: VIDEO_CATEGORIES, canManage: manage, viewsPersistent: Boolean(schema.videos), maxUploadSeconds: MAX_UPLOAD_SECONDS
    });
  }));
  app.get('/api/videos/:id', authenticate, route(async (req, res) => {
    const v = live().find((x) => x.id === req.params.id);
    if (!v) return res.status(404).json({ error: 'Video not found.' });
    res.set('Cache-Control', 'no-store').json({ video: view(v, await canManageVideos(req.user)) });
  }));

  app.post('/api/videos', authenticate, route(async (req, res) => {
    if (!await requireFounder(req, res) || !requirePersistent(res)) return;
    let meta; try { meta = validateMeta(req.body, false); } catch (e) { return fail(res, e); }
    const embed = parseEmbed(req.body.url);
    if (!embed) return res.status(400).json({ error: 'Paste a YouTube or Vimeo link. Other sites are not supported.' });
    if (live().some((v) => v.provider === embed.provider && v.embedId === embed.embedId)) return res.status(409).json({ error: 'This video is already in the library.' });
    const v = { id: crypto.randomUUID(), ...meta, ...embed, views: 0, createdAt: new Date().toISOString(), createdBy: req.user.id };
    db.videos.push(v); await saveDB();
    res.status(201).json({ video: view(v, true) });
  }));

  app.post('/api/videos/upload', authenticate, route(async (req, res, next) => {
    if (!await requireFounder(req, res) || !requirePersistent(res)) return;
    await new Promise((resolve, reject) => uploadVideo.single('video')(req, res, (e) => e ? reject(e) : resolve()));
    if (!req.file) return res.status(400).json({ error: 'Choose a video file (MP4, MOV or WebM).' });
    let meta; try { meta = validateMeta(req.body, false); } catch (e) { return fail(res, e); }
    const seconds = await probeDurationSeconds(req.file.buffer);
    if (!seconds) return res.status(400).json({ error: 'Could not read this video. Try MP4 (H.264).' });
    if (seconds > MAX_UPLOAD_SECONDS + 0.5) return res.status(400).json({ error: `Videos can be at most 15 minutes. This one is ${Math.ceil(seconds / 60)} minutes.` });
    const fileUrl = await persistFile(req.file, 'reels', req.user.id);
    let thumbnail = null;
    const frame = await posterFrame(req.file.buffer).catch(() => null);
    if (frame) thumbnail = await persistFile({ originalname: 'poster.jpg', mimetype: 'image/jpeg', buffer: frame, size: frame.length }, 'profile', req.user.id).catch(() => null);
    const v = { id: crypto.randomUUID(), ...meta, provider: 'upload', fileUrl, thumbnail, durationSec: Math.round(seconds), views: 0, createdAt: new Date().toISOString(), createdBy: req.user.id };
    db.videos.push(v); await saveDB();
    res.status(201).json({ video: view(v, true) });
  }));

  app.put('/api/videos/:id', authenticate, route(async (req, res) => {
    if (!await requireFounder(req, res) || !requirePersistent(res)) return;
    const v = live().find((x) => x.id === req.params.id);
    if (!v) return res.status(404).json({ error: 'Video not found.' });
    let meta; try { meta = validateMeta(req.body, true); } catch (e) { return fail(res, e); }
    if (req.body.url !== undefined && v.provider !== 'upload') {
      const embed = parseEmbed(req.body.url); if (!embed) return res.status(400).json({ error: 'Paste a YouTube or Vimeo link.' });
      Object.assign(meta, embed);
    }
    Object.assign(v, meta, { updatedAt: new Date().toISOString() }); await saveDB();
    res.json({ video: view(v, true) });
  }));

  app.delete('/api/videos/:id', authenticate, route(async (req, res) => {
    if (!await requireFounder(req, res) || !requirePersistent(res)) return;
    const v = live().find((x) => x.id === req.params.id);
    if (!v) return res.status(404).json({ error: 'Video not found.' });
    v.deletedAt = new Date().toISOString(); v.deletedBy = req.user.id;
    const files = [v.fileUrl, v.thumbnail].filter((u) => u && !u.startsWith('https://'));
    await saveDB();
    for (const f of files) await removeStoredFile(f).catch(() => {});
    res.json({ success: true });
  }));

  app.post('/api/videos/:id/view', authenticate, route(async (req, res) => {
    const v = live().find((x) => x.id === req.params.id);
    if (!v) return res.status(404).json({ error: 'Video not found.' });
    if (!schema.videos) return res.status(503).json({ error: 'View counts are paused until video storage is enabled.', code: 'VIDEO_SCHEMA_MISSING', views: null, counted: false });
    if (!deduper.shouldCount(req.user.id, v.id)) return res.json({ views: Number(v.views) || 0, counted: false });
    v.views = (Number(v.views) || 0) + 1; // synchronous: no lost updates between concurrent requests
    const views = v.views;
    await durableSave();
    res.json({ views, counted: true });
  }));

  return { flush: () => pendingSave || Promise.resolve() };
}
