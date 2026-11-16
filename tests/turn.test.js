import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIceConfig, restCredentials } from '../turn.js';

test('issues temporary coturn REST credentials and applies relay-only mode when requested', async () => {
  const now = 1_700_000_000_000;
  const creds = restCredentials('test-secret', 'human-22', 600, now);
  assert.equal(creds.username.split(':')[0], String(Math.floor(now/1000)+600));
  const config = await buildIceConfig({ env: { TURN_SECRET:'test-secret', TURN_URLS:'turn:relay.example:3478?transport=udp,turns:relay.example:5349?transport=tcp', TURN_TTL_SECONDS:'600', TURN_FORCE_RELAY:'true' }, userId:'human-22', now });
  assert.equal(config.iceTransportPolicy,'relay');
  assert.equal(config.turn.status,'ready');
  assert.deepEqual(config.turn.transports.sort(),['tls','udp']);
  assert.ok(config.iceServers.some(s=>s.username===creds.username));
});

test('reports missing TURN honestly and keeps STUN fallback', async () => {
  const config = await buildIceConfig({ env:{}, now:1_700_000_000_000 });
  assert.equal(config.iceTransportPolicy,'all');
  assert.equal(config.turn.status,'not-configured');
  assert.equal(config.iceServers.length,1);
});
