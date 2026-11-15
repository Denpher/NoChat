// Videos: preloaded embeds, founder-only management, durable and concurrency-safe view counts.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from './helpers.js';
import { parseEmbed, embedUrl, createViewDeduper, VIDEO_CATEGORIES } from '../videos.js';
import { SEED_VIDEOS } from '../videos-catalog.js';

const S = server(5101, { FOUNDER_PASSWORD: 'Founder-Pass-1', FOUNDER_EMAIL: 'denpherai@gmail.com' });
let founder, alice, bob;
before(async () => {
  await S.start();
  founder = (await S.call('/api/auth/login', { method: 'POST', body: { identifier: 'denpher', password: 'Founder-Pass-1' } })).cookie;
  alice = await S.register('alice'); bob = await S.register('bob');
});
after(async () => { await S.stop(); S.cleanup(); });

test('catalog: every category is populated with valid official YouTube embeds', () => {
  for (const c of VIDEO_CATEGORIES) assert.ok(SEED_VIDEOS.filter((v) => v.category === c).length >= 6, c);
  for (const v of SEED_VIDEOS) {
    assert.match(v.embedId, /^[\w-]{11}$/); assert.ok(v.title && v.channel && v.description, v.id);
    assert.equal(embedUrl(v), `https://www.youtube-nocookie.com/embed/${v.embedId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`);
  }
  assert.equal(new Set(SEED_VIDEOS.map((v) => v.embedId)).size, SEED_VIDEOS.length, 'no duplicates');
});

test('embed parser accepts YouTube/Vimeo links and rejects everything else', () => {
  assert.deepEqual(parseEmbed('https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=5'), { provider: 'youtube', embedId: 'aqz-KE-bpKQ' });
  assert.deepEqual(parseEmbed('https://youtu.be/aqz-KE-bpKQ'), { provider: 'youtube', embedId: 'aqz-KE-bpKQ' });
  assert.deepEqual(parseEmbed('https://www.youtube.com/shorts/aqz-KE-bpKQ'), { provider: 'youtube', embedId: 'aqz-KE-bpKQ' });
  assert.deepEqual(parseEmbed('https://vimeo.com/76979871'), { provider: 'vimeo', embedId: '76979871' });
  for (const bad of ['javascript:alert(1)', 'https://evil.example/watch?v=aqz-KE-bpKQ', 'https://youtube.com.evil.io/watch?v=aqz-KE-bpKQ', 'https://www.youtube.com/watch?v=<script>', '']) assert.equal(parseEmbed(bad), null, bad);
});

test('members can browse, search, filter and paginate; listing requires sign-in', async () => {
  assert.equal((await S.call('/api/videos')).status, 401);
  const all = await S.call('/api/videos?limit=12', { cookie: alice.cookie });
  assert.equal(all.status, 200); assert.equal(all.data.videos.length, 12); assert.equal(all.data.total, SEED_VIDEOS.length); assert.equal(all.data.hasMore, true);
  assert.equal(all.data.canManage, false); assert.equal(all.data.viewsPersistent, true);
  const p2 = await S.call('/api/videos?limit=12&page=2', { cookie: alice.cookie });
  assert.equal(new Set([...all.data.videos, ...p2.data.videos].map((v) => v.id)).size, 24);
  const anime = await S.call('/api/videos?category=Anime&limit=48', { cookie: alice.cookie });
  assert.ok(anime.data.videos.every((v) => v.category === 'Anime'));
  const q = await S.call('/api/videos?q=sintel', { cookie: alice.cookie });
  assert.ok(q.data.videos.some((v) => v.embedId === 'eRsGyueVLvQ'));
  assert.ok(all.data.videos.every((v) => v.thumbnail.startsWith('https://i.ytimg.com/vi/') && v.embedUrl.startsWith('https://www.youtube-nocookie.com/embed/')));
});

test('only the founder can add, edit and delete videos (ordinary users get 403 on every call)', async () => {
  const body = { url: 'https://www.youtube.com/watch?v=YE7VzlLtp-4', title: 'Big Buck Bunny (classic)', category: 'Movies', description: 'Test' };
  assert.equal((await S.call('/api/videos', { cookie: alice.cookie, method: 'POST', body })).status, 403);
  const created = await S.call('/api/videos', { cookie: founder, method: 'POST', body });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.video.id;
  assert.equal((await S.call('/api/videos', { cookie: founder, method: 'POST', body })).status, 409, 'duplicates rejected');
  assert.equal((await S.call('/api/videos', { cookie: founder, method: 'POST', body: { ...body, url: 'https://evil.example/x' } })).status, 400);
  assert.equal((await S.call('/api/videos/' + id, { cookie: alice.cookie, method: 'PUT', body: { title: 'Hacked' } })).status, 403);
  assert.equal((await S.call('/api/videos/' + id, { cookie: bob.cookie, method: 'DELETE' })).status, 403);
  assert.equal((await S.call('/api/videos/upload', { cookie: alice.cookie, method: 'POST', form: new FormData() })).status, 403);
  const edited = await S.call('/api/videos/' + id, { cookie: founder, method: 'PUT', body: { title: 'Big Buck Bunny', category: 'Entertainment' } });
  assert.equal(edited.status, 200); assert.equal(edited.data.video.title, 'Big Buck Bunny'); assert.equal(edited.data.video.category, 'Entertainment');
  assert.equal((await S.call('/api/videos/' + id, { cookie: founder, method: 'DELETE' })).status, 200);
  assert.equal((await S.call('/api/videos/' + id, { cookie: alice.cookie })).status, 404);
  assert.equal((await S.call('/api/videos?limit=1', { cookie: founder })).data.canManage, true);
});

test('founder upload rejects files that are not real videos', async () => {
  const form = new FormData(); form.set('title', 'Clip'); form.set('category', 'Entertainment');
  form.set('video', new Blob([Buffer.from('not a video')], { type: 'video/mp4' }), 'clip.mp4');
  const r = await S.call('/api/videos/upload', { cookie: founder, method: 'POST', form });
  assert.equal(r.status, 400);
});

test('repeated player events from one viewer count once', async () => {
  const id = 'yt-aqz-KE-bpKQ';
  const results = await Promise.all(Array.from({ length: 10 }, () => S.call(`/api/videos/${id}/view`, { cookie: alice.cookie, method: 'POST' })));
  assert.equal(results.filter((r) => r.data.counted).length, 1);
  assert.equal((await S.call('/api/videos/' + id, { cookie: bob.cookie })).data.video.views, 1);
});

test('concurrent genuine starts from many viewers are all counted (no lost updates) and survive a restart', async () => {
  const id = 'yt-eRsGyueVLvQ';
  const viewers = await Promise.all(Array.from({ length: 15 }, (_, i) => S.register('viewer' + i)));
  const results = await Promise.all(viewers.map((v) => S.call(`/api/videos/${id}/view`, { cookie: v.cookie, method: 'POST' })));
  assert.ok(results.every((r) => r.status === 200 && r.data.counted));
  assert.deepEqual(results.map((r) => r.data.views).sort((a, b) => a - b), Array.from({ length: 15 }, (_, i) => i + 1));
  await S.stop(); await S.start();
  assert.equal((await S.call('/api/videos/' + id, { cookie: alice.cookie })).data.video.views, 15);
  assert.equal((await S.call('/api/videos/yt-aqz-KE-bpKQ', { cookie: alice.cookie })).data.video.views, 1);
});

test('view deduper window', () => {
  const d = createViewDeduper(1000);
  assert.equal(d.shouldCount('u', 'v', 0), true); assert.equal(d.shouldCount('u', 'v', 999), false);
  assert.equal(d.shouldCount('u2', 'v', 10), true); assert.equal(d.shouldCount('u', 'v', 1000), true);
});

test('founder YouTube video is in the catalog as an official embed and listed first', async () => {
  const v = SEED_VIDEOS[0];
  assert.equal(v.embedId, '3J81gK6QBgc'); assert.equal(v.provider, 'youtube');
  assert.match(v.channel, /founder/i);
  assert.match(embedUrl(v), /^https:\/\/www\.youtube-nocookie\.com\/embed\/3J81gK6QBgc\?/);
  const first = await S.call('/api/videos?limit=1', { cookie: alice.cookie });
  assert.equal(first.data.videos[0].embedId, '3J81gK6QBgc');
});
