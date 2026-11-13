// STUN/TURN configuration and WebRTC signaling over Socket.IO.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { io } from 'socket.io-client';
import { buildIceConfig, restCredentials, transportsOf, turnMode } from '../turn.js';
import { server } from './helpers.js';

test('no TURN configured: STUN only, reported honestly as not configured', async () => {
  const c = await buildIceConfig({ env: {} });
  assert.equal(c.turn.configured, false); assert.equal(c.turn.status, 'not-configured');
  assert.equal(c.iceServers.length, 1); assert.ok(c.iceServers[0].urls.every((u) => u.startsWith('stun:')));
  assert.ok(!JSON.stringify(c).includes('turn:'), 'no hidden public relay');
});

test('TURN_SECRET mode issues temporary HMAC credentials and never exposes the secret', async () => {
  const env = { TURN_SECRET: 'super-secret-value', TURN_URLS: 'turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp,turns:turn.example.com:5349?transport=tcp', TURN_TTL_SECONDS: '600' };
  const now = Date.UTC(2026, 10, 13);
  const c = await buildIceConfig({ env, userId: 'user-1', now });
  assert.equal(c.turn.status, 'ready'); assert.equal(c.turn.credentialType, 'temporary');
  assert.deepEqual(c.turn.transports.sort(), ['tcp', 'tls', 'udp']);
  const relay = c.iceServers[1];
  const [exp] = relay.username.split(':');
  assert.equal(Number(exp), now / 1000 + 600);
  assert.equal(relay.credential, crypto.createHmac('sha1', 'super-secret-value').update(relay.username).digest('base64'));
  assert.ok(!JSON.stringify(c).includes('super-secret-value'));
  assert.ok(!relay.username.includes('user-1'), 'internal user id not leaked to TURN logs');
});

test('TTL is clamped and REST credentials expire', () => {
  const c = restCredentials('s', 'u', 300, 0);
  assert.equal(c.expiresAt, new Date(300000).toISOString());
});

test('provider failure falls back to STUN and says so (no fake TURN)', async () => {
  const c = await buildIceConfig({ env: { CLOUDFLARE_TURN_KEY_ID: 'k', CLOUDFLARE_TURN_API_TOKEN: 't' }, fetchImpl: async () => ({ ok: false, status: 401 }) });
  assert.equal(c.turn.status, 'unavailable'); assert.equal(c.iceServers.length, 1); assert.equal(c.iceTransportPolicy, 'all');
  assert.ok(!JSON.stringify(c).includes('"t"'));
});

test('Cloudflare provider credentials are passed through, TURN urls only', async () => {
  const fetchImpl = async (url, opts) => { assert.match(url, /rtc\.live\.cloudflare\.com\/v1\/turn\/keys\/k\//); assert.equal(opts.headers.Authorization, 'Bearer t'); return { ok: true, json: async () => ({ iceServers: [{ urls: ['stun:stun.cloudflare.com:3478', 'turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' }] }) }; };
  const c = await buildIceConfig({ env: { CLOUDFLARE_TURN_KEY_ID: 'k', CLOUDFLARE_TURN_API_TOKEN: 't', TURN_FORCE_RELAY: 'true' }, fetchImpl });
  assert.equal(c.turn.status, 'ready'); assert.equal(c.iceTransportPolicy, 'relay');
  assert.deepEqual(c.iceServers[1].urls, ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp']);
});

test('static legacy credentials are labelled static', async () => {
  assert.equal(turnMode({ TURN_URL: 'turn:x:3478', TURN_USERNAME: 'a', TURN_PASSWORD: 'b' }), 'static');
  assert.equal((await buildIceConfig({ env: { TURN_URL: 'turn:x:3478', TURN_USERNAME: 'a', TURN_PASSWORD: 'b' } })).turn.credentialType, 'static');
  assert.deepEqual(transportsOf(['stun:x', 'turn:x:80']), ['udp']);
});

const S = server(5104, { TURN_SECRET: 'srv-secret', TURN_URLS: 'turn:relay.example.com:3478,turns:relay.example.com:5349?transport=tcp' });
let a, b, convo;
const connect = (u) => new Promise((res, rej) => { const s = io(S.B, { extraHeaders: { cookie: u.cookie }, transports: ['websocket'] }); s.on('connect', () => res(s)); s.on('connect_error', rej); });
const once = (s, ev, ms = 3000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + ev)), ms); s.once(ev, (d) => { clearTimeout(t); res(d); }); });
before(async () => {
  await S.start(); a = await S.register('caller'); b = await S.register('callee');
  convo = (await S.call('/api/conversations', { cookie: a.cookie, method: 'POST', body: { userId: b.id } })).data.conversation.id;
});
after(async () => { await S.stop(); S.cleanup(); });

test('/api/calls/config needs sign-in and returns temporary TURN credentials only', async () => {
  assert.equal((await S.call('/api/calls/config')).status, 401);
  const r = await S.call('/api/calls/config', { cookie: a.cookie });
  assert.equal(r.status, 200); assert.equal(r.data.turn.status, 'ready'); assert.equal(r.data.turn.mode, 'rest');
  assert.ok(!JSON.stringify(r.data).includes('srv-secret'));
  assert.equal((await S.call('/api/health')).data.turnMode, 'rest');
});

test('offer/answer/ICE candidates are relayed only between the two call members', async () => {
  const [sa, sb] = await Promise.all([connect(a), connect(b)]);
  const incoming = once(sb, 'call:incoming');
  const inv = await new Promise((r) => sa.emit('call:invite', { conversationId: convo, video: true }, r));
  assert.ok(inv.callId, JSON.stringify(inv));
  assert.equal((await incoming).callId, inv.callId);
  const accepted = once(sa, 'call:accepted'); sb.emit('call:accept', { callId: inv.callId }); await accepted;
  const offer = once(sb, 'call:signal'); sa.emit('call:signal', { callId: inv.callId, signal: { type: 'offer', sdp: 'v=0 offer' } });
  assert.equal((await offer).signal.sdp, 'v=0 offer');
  const cand = { candidate: 'candidate:1 1 udp 2122260223 203.0.113.5 3478 typ relay raddr 0.0.0.0 rport 0', sdpMid: '0', sdpMLineIndex: 0 };
  const gotCand = once(sa, 'call:signal'); sb.emit('call:signal', { callId: inv.callId, signal: { type: 'candidate', candidate: cand } });
  assert.deepEqual((await gotCand).signal.candidate, cand);
  let bogus = false; sb.on('call:signal', (d) => { if (d.signal.type === 'evil') bogus = true; });
  sa.emit('call:signal', { callId: inv.callId, signal: { type: 'evil', sdp: 'x' } });
  const ended = once(sb, 'call:end'); sa.emit('call:end', { callId: inv.callId }); await ended;
  await new Promise((r) => setTimeout(r, 100)); assert.equal(bogus, false);
  sa.close(); sb.close();
});
