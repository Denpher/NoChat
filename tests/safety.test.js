// Unit tests for the v3.1 rules: anti-spam, account restrictions, admin protection, moderation policy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSpam, cooldownFor, SPAM_RULES } from '../antispam.js';
import { accountRestriction, sessionRevoked, checkAdminAction, applyAdminAction, cleanText } from '../accounts.js';
import { decideVerdict, AUTO_REMOVE_CONFIDENCE } from '../moderation.js';

test('normal fast conversation (10 different messages in 10 s) is never blocked', () => {
  const h = {}; let spam = {}; const t0 = Date.parse('2026-11-12T10:00:00Z');
  for (let i = 0; i < 10; i++) { const r = checkSpam(h, spam, 'msg ' + i, t0 + i * 900); assert.equal(r.allowed, true); spam = r.spam; }
});
test('the 11th message within 10 s is flooding and gets a 15 s first-strike cooldown', () => {
  const h = {}; let spam = {}; const t0 = Date.now();
  for (let i = 0; i < 10; i++) spam = checkSpam(h, spam, 'm' + i, t0 + i * 100).spam;
  const r = checkSpam(h, spam, 'again', t0 + 1100);
  assert.equal(r.allowed, false); assert.equal(r.reason, 'flooding'); assert.equal(r.strike, 1); assert.equal(r.cooldownMs, 15_000);
  const during = checkSpam(h, r.spam, 'hi', t0 + 5000);
  assert.equal(during.allowed, false); assert.equal(during.reason, 'cooldown');
  assert.equal(checkSpam(h, r.spam, 'hi', t0 + 1100 + 15_001).allowed, true);
});
test('the same text a 5th time within 60 s is repetition', () => {
  const h = {}; let spam = {}; const t0 = Date.now();
  for (let i = 0; i < 4; i++) { const r = checkSpam(h, spam, 'Buy now!!', t0 + i * 5000); assert.equal(r.allowed, true); spam = r.spam; }
  const r = checkSpam(h, spam, '  buy   NOW!! ', t0 + 21000);
  assert.equal(r.reason, 'repeated');
});
test('cooldowns escalate 15s, 1m, 5m, 30m and cap at 2h — never permanent', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(cooldownFor), [15_000, 60_000, 300_000, 1_800_000, 7_200_000, 7_200_000]);
  assert.equal(SPAM_RULES.strikeMemoryMs, 24 * 3600_000);
});

test('suspended, banned and deleted accounts are restricted; expired suspension is not', () => {
  const now = Date.parse('2026-11-12T10:00:00Z');
  assert.equal(accountRestriction({ status: 'active' }, now), null);
  assert.equal(accountRestriction({}, now), null);
  assert.equal(accountRestriction({ status: 'banned' }, now).code, 'ACCOUNT_BANNED');
  assert.equal(accountRestriction({ status: 'deleted' }, now).code, 'ACCOUNT_DELETED');
  assert.equal(accountRestriction({ status: 'suspended', statusUntil: '2026-11-13T10:00:00Z' }, now).code, 'ACCOUNT_SUSPENDED');
  assert.equal(accountRestriction({ status: 'suspended', statusUntil: '2026-11-12T09:00:00Z' }, now), null);
});
test('revoking sessions invalidates older tokens; tokens issued afterwards and legacy tokens work', () => {
  const user = { id: 'u', username: 'u' };
  assert.equal(sessionRevoked(user, { sub: 'u' }), false); // existing pre-upgrade cookies stay valid
  applyAdminAction(user, 'revoke-sessions');
  assert.equal(sessionRevoked(user, { sub: 'u' }), true);
  assert.equal(sessionRevoked(user, { sub: 'u', sv: 1 }), false);
});
test('founder account cannot be modified by any admin action', () => {
  const founder = { id: 'denpher-official-founder-id', username: 'denpher' };
  for (const action of ['suspend', 'ban', 'delete', 'revoke-sessions', 'unverify', 'restore'])
    assert.equal(checkAdminAction({ actor: { id: 'x' }, target: founder, action, body: { reason: 'test', confirm: 'denpher' }, founderId: founder.id }).status, 403);
});
test('destructive actions need the typed username and a reason', () => {
  const target = { id: 'u1', username: 'alex' }; const base = { actor: { id: 'admin' }, target, founderId: 'f' };
  assert.equal(checkAdminAction({ ...base, action: 'ban', body: { reason: 'spam bot' } }).status, 400);
  assert.equal(checkAdminAction({ ...base, action: 'ban', body: { confirm: 'alex' } }).status, 400);
  assert.equal(checkAdminAction({ ...base, action: 'ban', body: { reason: 'spam bot', confirm: 'alex' } }), null);
  assert.equal(checkAdminAction({ ...base, action: 'verify', body: {} }), null);
  assert.equal(checkAdminAction({ ...base, action: 'nuke', body: {} }).status, 400);
});
test('delete is a soft delete that keeps the record and can be restored', () => {
  const u = { id: 'u1', username: 'alex', passwordHash: 'h', email: 'a@b.c' };
  applyAdminAction(u, 'delete', { reason: 'request' });
  assert.equal(u.status, 'deleted'); assert.equal(u.passwordHash, 'h'); assert.equal(u.email, 'a@b.c');
  applyAdminAction(u, 'restore');
  assert.equal(u.status, 'active'); assert.equal(accountRestriction(u), null);
});
test('verified badge is display-only and separate from admin permissions', () => {
  const u = { id: 'p', username: 'parth' }; applyAdminAction(u, 'verify');
  assert.deepEqual(Object.keys(u).sort(), ['id', 'username', 'verifiedBadge']); // no role/admin fields touched
});
test('control characters are stripped from user text', () => { assert.equal(cleanText(' hi\u0000\u0007 there\n ', 50), 'hi there'); });

test('moderation auto-removes only high-confidence violations; uncertain content is quarantined', () => {
  assert.equal(AUTO_REMOVE_CONFIDENCE, 0.9);
  assert.equal(decideVerdict({ status: 'blocked', confidence: 0.95 }).status, 'blocked');
  assert.equal(decideVerdict({ status: 'blocked', confidence: 0.6 }).status, 'pending');
  assert.equal(decideVerdict({ status: 'blocked' }).status, 'pending');
  assert.equal(decideVerdict({ status: 'weird' }).status, 'pending');
  assert.equal(decideVerdict({ status: 'approved' }).status, 'approved');
});

test('founder email is never written in plain text in shipped code', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const crypto = await import('node:crypto');
 const { fileURLToPath } = await import('node:url');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const fp = src.match(/FOUNDER_EMAIL_SHA256 = "([a-f0-9]{64})"/)[1];
  const files = ['server.js','admin.js','accounts.js','features.js','antispam.js','policies.js','moderation.js','cloud.js','public/app.js','public/index.html','public/calls.js','videos.js','videos-catalog.js','groups.js','turn.js','public/videos.js','public/groups.js']
    .map(f => path.join(root, f)).filter(f => fs.existsSync(f));
  for (const f of files) {
    for (const m of fs.readFileSync(f, 'utf8').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []) {
      const h = crypto.createHash('sha256').update(m.toLowerCase()).digest('hex');
      assert.notEqual(h, fp, `founder email found in ${path.relative(root, f)}`);
    }
  }
});
