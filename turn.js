// STUN + TURN configuration for WebRTC calls.
// Permanent TURN secrets stay on the server; browsers only ever receive short-lived credentials
// (or, in the legacy "static" mode, the credential you chose to configure, clearly reported as static).
import crypto from 'node:crypto';

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
const DEFAULT_STUN = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];

export function transportsOf(urls) {
  const out = new Set();
  for (const u of urls) {
    if (!/^turns?:/i.test(u)) continue;
    if (/^turns:/i.test(u)) out.add('tls');
    else if (/transport=tcp/i.test(u)) out.add('tcp');
    else out.add('udp');
  }
  return [...out];
}

/** coturn "use-auth-secret" / TURN REST API credentials (draft-uberti-behave-turn-rest). */
export function restCredentials(secret, userId, ttlSeconds, now = Date.now()) {
  const expires = Math.floor(now / 1000) + ttlSeconds;
  const tag = crypto.createHash('sha256').update(String(userId)).digest('hex').slice(0, 16);
  const username = `${expires}:${tag}`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential, expiresAt: new Date(expires * 1000).toISOString() };
}

export function turnMode(env = process.env) {
  if (env.TURN_SECRET && env.TURN_URLS) return 'rest';
  if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN) return 'cloudflare';
  if (env.METERED_TURN_DOMAIN && env.METERED_TURN_API_KEY) return 'metered';
  if (env.TURN_URL && env.TURN_USERNAME && env.TURN_PASSWORD) return 'static';
  return 'none';
}

export async function buildIceConfig({ env = process.env, userId = 'anonymous', now = Date.now(), fetchImpl = fetch } = {}) {
  const stun = list(env.STUN_URL);
  const iceServers = [{ urls: stun.length ? stun : DEFAULT_STUN }];
  const ttl = Math.min(86400, Math.max(300, Number(env.TURN_TTL_SECONDS) || 3600));
  const mode = turnMode(env);
  const turn = { configured: mode !== 'none', mode, status: 'not-configured', transports: [], expiresAt: null, credentialType: null, message: 'No TURN relay is configured. Calls use STUN only and may fail on strict mobile or corporate networks.' };
  try {
    let servers = [];
    if (mode === 'rest') {
      const c = restCredentials(env.TURN_SECRET, userId, ttl, now);
      servers = [{ urls: list(env.TURN_URLS), username: c.username, credential: c.credential }];
      Object.assign(turn, { expiresAt: c.expiresAt, credentialType: 'temporary' });
    } else if (mode === 'cloudflare') {
      const r = await fetchImpl(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.CLOUDFLARE_TURN_KEY_ID)}/credentials/generate-ice-servers`, {
        method: 'POST', headers: { Authorization: `Bearer ${env.CLOUDFLARE_TURN_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ttl }), signal: AbortSignal.timeout(6000)
      });
      if (!r.ok) throw new Error(`Cloudflare TURN returned ${r.status}`);
      const data = await r.json();
      const raw = Array.isArray(data.iceServers) ? data.iceServers : data.iceServers ? [data.iceServers] : [];
      servers = raw.map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => /^turns?:/i.test(u)) })).filter((s) => s.urls.length && s.username && s.credential);
      Object.assign(turn, { expiresAt: new Date(now + ttl * 1000).toISOString(), credentialType: 'temporary' });
    } else if (mode === 'metered') {
      const r = await fetchImpl(`https://${env.METERED_TURN_DOMAIN.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}/api/v1/turn/credentials?apiKey=${encodeURIComponent(env.METERED_TURN_API_KEY)}`, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error(`Metered TURN returned ${r.status}`);
      const data = await r.json();
      servers = (Array.isArray(data) ? data : []).map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => /^turns?:/i.test(u)) })).filter((s) => s.urls.length && s.username && s.credential);
      Object.assign(turn, { credentialType: 'provider-managed' });
    } else if (mode === 'static') {
      servers = [{ urls: list(env.TURN_URL), username: env.TURN_USERNAME, credential: env.TURN_PASSWORD }];
      Object.assign(turn, { credentialType: 'static' });
    }
    if (mode !== 'none') {
      if (!servers.length) throw new Error('TURN provider returned no relay servers');
      iceServers.push(...servers);
      turn.transports = transportsOf(servers.flatMap((s) => s.urls));
      turn.status = 'ready';
      turn.message = mode === 'static'
        ? 'TURN relay configured with a long-lived static credential. Prefer TURN_SECRET or a provider API for temporary credentials.'
        : 'TURN relay configured with temporary credentials.';
    }
  } catch (e) {
    turn.status = 'unavailable';
    turn.message = 'TURN relay is configured but credentials could not be issued right now. Calls fall back to STUN only.';
    turn.error = String(e.message || e).replace(/apiKey=[^&\s]+/g, 'apiKey=***').slice(0, 160);
    turn.transports = []; turn.expiresAt = null;
  }
  const forceRelay = env.TURN_FORCE_RELAY === 'true' && turn.status === 'ready';
  return { iceServers, iceTransportPolicy: forceRelay ? 'relay' : 'all', turn };
}
