// Production-like check: a Cloud bridge whose save function does NOT accept a "videos" collection
// (the live NoChat database before database/migrations/2026-11-13-v3.3-videos.sql). Founder uploads must still work and persist.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { server } from './helpers.js';

const ALLOWED = ['users','subscriptions','friends','friendRequests','reels','reelLikes','reelComments','conversations','messages','reports','reelUploads'];
const bridge = { state: { reelUploads: [{ id: 'old-upload-row', userId: 'u1', day: '2026-11-01', createdAt: '2026-11-01T00:00:00Z' }] }, revision: 0, files: new Map() };
const BRIDGE_PORT = 5190;
const fake = http.createServer((req, res) => {
  const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.method === 'PUT' && req.url.startsWith('/put/')) { bridge.files.set(req.url.slice(5), Buffer.concat(chunks)); return send(200, {}); }
    if (req.headers.authorization !== 'Bearer bridge-secret') return send(401, { error: 'unauthorized' });
    const b = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    switch (b.operation) {
      case 'load': return send(200, { state: structuredClone(bridge.state), revision: bridge.revision });
      case 'save':
        if (Object.keys(b.state).some((k) => !ALLOWED.includes(k))) return send(500, { error: 'Invalid collection' });
        if (b.revision !== bridge.revision) return send(409, { error: 'Revision conflict: reload required' });
        bridge.state = b.state; bridge.revision++; return send(200, { revision: bridge.revision });
      case 'role': return send(200, { admin: b.userId === 'denpher-official-founder-id' });
      case 'upload-url': return send(200, { url: `http://localhost:${BRIDGE_PORT}/put/${b.key}` });
      case 'download-url': return send(200, { url: `http://localhost:${BRIDGE_PORT}/put/${b.key}` });
      default: return send(200, {});
    }
  });
});
const env = { FOUNDER_PASSWORD: 'Founder-Pass-1', FOUNDER_EMAIL: 'denpherai@gmail.com', NOCHAT_CLOUD_URL: `http://localhost:${BRIDGE_PORT}`, NOCHAT_BRIDGE_SECRET: 'bridge-secret' };
let S = server(5177, env);
const clip = path.join(os.tmpdir(), 'nochat-cloud-clip.mp4');
const login = async () => (await S.call('/api/auth/login', { method: 'POST', body: { identifier: 'denpher', password: 'Founder-Pass-1' } })).cookie;
before(async () => {
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=3:size=160x120:rate=10', '-c:v', 'mpeg4', '-pix_fmt', 'yuv420p', clip]);
  await new Promise((r) => fake.listen(BRIDGE_PORT, r));
  await S.start();
});
after(async () => { await S.stop(); S.cleanup(); fake.close(); fs.rmSync(clip, { force: true }); });

test('founder can upload a video when Cloud has no videos collection, and it survives a restart', async () => {
  assert.equal((await S.call('/api/health')).data.videoStorage, true);
  let founder = await login();
  assert.equal((await S.call('/api/videos?limit=1', { cookie: founder })).data.canManage, true);
  const form = new FormData();
  form.append('title', 'My founder upload'); form.append('category', 'Entertainment');
  form.append('video', new Blob([fs.readFileSync(clip)], { type: 'video/mp4' }), 'clip.mp4');
  const up = await S.call('/api/videos/upload', { cookie: founder, method: 'POST', form });
  assert.equal(up.status, 201, JSON.stringify(up.data));
  const id = up.data.video.id;
  assert.equal(up.data.video.durationSec, 3);
  assert.match(up.data.video.fileUrl, /^\/api\/media\/reels\//);
  assert.equal(bridge.files.size >= 1, true, 'file bytes went to cloud storage');
  // Stored inside the existing reelUploads collection; old rows untouched; no new collection sent.
  assert.equal(bridge.state.videos, undefined);
  assert.ok(bridge.state.reelUploads.some((r) => r.id === id && r.kind === 'nochat-video'));
  assert.ok(bridge.state.reelUploads.some((r) => r.id === 'old-upload-row'));
  const alice = await S.register('alice');
  assert.equal((await S.call(`/api/videos/${id}/view`, { cookie: alice.cookie, method: 'POST' })).data.views, 1);
  const yt = await S.call('/api/videos', { cookie: founder, method: 'POST', body: { url: 'https://youtu.be/YE7VzlLtp-4', title: 'Linked video', category: 'Movies' } });
  assert.equal(yt.status, 201);
  // Ordinary users still cannot upload.
  assert.equal((await S.call('/api/videos/upload', { cookie: alice.cookie, method: 'POST', form: new FormData() })).status, 403);

  await S.stop(); S = server(5177, env); await S.start();
  founder = await login();
  const again = await S.call(`/api/videos/${id}`, { cookie: founder });
  assert.equal(again.status, 200); assert.equal(again.data.video.title, 'My founder upload'); assert.equal(again.data.video.views, 1);
  assert.equal((await S.call(`/api/videos/${yt.data.video.id}`, { cookie: founder })).status, 200);
  assert.equal(bridge.state.reelUploads.filter((r) => r.id === id).length, 1, 'no duplicate rows after restart');
  assert.equal((await S.call(`/api/videos/${id}`, { cookie: founder, method: 'DELETE' })).status, 200);
});
