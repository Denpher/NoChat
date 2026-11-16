// Integration: real server, founder admin, ordinary users, restrictions, anti-spam and appeals.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const PORT = 5098, B = `http://localhost:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nochat-admin-'));
const env = { ...process.env, PORT: String(PORT), JWT_SECRET: 'admin-test-'.padEnd(64, 'x'), FOUNDER_PASSWORD: 'Founder-Pass-1', DATA_DIR: path.join(tmp, 'db'), UPLOADS_DIR: path.join(tmp, 'up'), NODE_ENV: 'development' };
let proc;
before(() => new Promise((res) => { proc = spawn(process.execPath, ['server.js'], { env, stdio: 'ignore' }); const t = setInterval(() => fetch(B + '/api/health').then(() => { clearInterval(t); res(); }).catch(() => {}), 200); }));
after(async () => { await new Promise((r) => { proc.once('exit', r); proc.kill(); }); fs.rmSync(tmp, { recursive: true, force: true }); });
const call = async (p, { cookie, method = 'GET', body } = {}) => {
  const r = await fetch(B + p, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, cookie: r.headers.get('set-cookie')?.split(';')[0], data: await r.json().catch(() => ({})) };
};
let admin, alice, bob, aliceId, bobId;
test('setup: founder signs in, two members register', async () => {
  admin = (await call('/api/auth/login', { method: 'POST', body: { identifier: 'denpher', password: 'Founder-Pass-1' } })).cookie;
  const a = await call('/api/auth/register', { method: 'POST', body: { username: 'alice', password: 'alice-pass-1', displayName: 'Alice' } });
  const b = await call('/api/auth/register', { method: 'POST', body: { username: 'bob', password: 'bob-pass-1', displayName: 'Bob' } });
  alice = a.cookie; bob = b.cookie; aliceId = a.data.user.id; bobId = b.data.user.id;
  assert.equal((await call('/api/me', { cookie: admin })).data.user.isAdmin, true);
});
test('ordinary users get 403 from every admin endpoint', async () => {
  for (const p of ['/api/admin/users', '/api/admin/logs', '/api/admin/appeals']) assert.equal((await call(p, { cookie: alice })).status, 403);
  assert.equal((await call(`/api/admin/users/${bobId}/action`, { cookie: alice, method: 'POST', body: { action: 'ban', reason: 'x x x', confirm: 'bob' } })).status, 403);
});
test('admin finds users by username and by exact user ID', async () => {
  assert.equal((await call('/api/admin/users?q=ali', { cookie: admin })).data.users[0].id, aliceId);
  assert.equal((await call(`/api/admin/users?q=${bobId}`, { cookie: admin })).data.users[0].username, 'bob');
});
test('founder account is protected and the attempt is audited', async () => {
  const r = await call('/api/admin/users/denpher-official-founder-id/action', { cookie: admin, method: 'POST', body: { action: 'ban', reason: 'test', confirm: 'denpher' } });
  assert.equal(r.status, 403);
  const logs = (await call('/api/admin/logs?kind=audit', { cookie: admin })).data.logs;
  assert.equal(logs[0].outcome, 'denied');
});
test('suspension needs confirmation, then blocks the existing session and sign-in; appeal + restore works', async () => {
  assert.equal((await call(`/api/admin/users/${bobId}/action`, { cookie: admin, method: 'POST', body: { action: 'suspend', reason: 'abuse' } })).status, 400);
  assert.equal((await call(`/api/admin/users/${bobId}/action`, { cookie: admin, method: 'POST', body: { action: 'suspend', reason: 'abuse', confirm: 'bob', durationHours: 24 } })).status, 200);
  assert.equal((await call('/api/me', { cookie: bob })).status, 401); // session revoked
  const login = await call('/api/auth/login', { method: 'POST', body: { identifier: 'bob', password: 'bob-pass-1' } });
  assert.equal(login.status, 403); assert.equal(login.data.code, 'ACCOUNT_SUSPENDED');
  assert.equal((await call('/api/users/search?q=bob', { cookie: alice })).data.users.length, 1); // suspended still listed, banned/deleted hidden
  assert.equal((await call('/api/auth/appeal', { method: 'POST', body: { identifier: 'bob', password: 'wrong', reason: 'please restore my account' } })).status, 401);
  assert.equal((await call('/api/auth/appeal', { method: 'POST', body: { identifier: 'bob', password: 'bob-pass-1', reason: 'please restore my account' } })).status, 201);
  const appeal = (await call('/api/admin/appeals', { cookie: admin })).data.appeals[0];
  assert.equal(appeal.targetType, 'account');
  assert.equal((await call(`/api/admin/appeals/${appeal.id}`, { cookie: admin, method: 'POST', body: { decision: 'accepted' } })).status, 200);
  const back = await call('/api/auth/login', { method: 'POST', body: { identifier: 'bob', password: 'bob-pass-1' } });
  assert.equal(back.status, 200);
  assert.equal((await call('/api/me', { cookie: back.cookie })).status, 200); // fresh session works right away
});
test('deleted accounts are hidden from search but kept and restorable', async () => {
  await call(`/api/admin/users/${bobId}/action`, { cookie: admin, method: 'POST', body: { action: 'delete', reason: 'requested', confirm: 'bob' } });
  assert.equal((await call('/api/users/search?q=bob', { cookie: alice })).data.users.length, 0);
  assert.equal((await call(`/api/admin/users?q=bob`, { cookie: admin })).data.users[0].status, 'deleted');
  await call(`/api/admin/users/${bobId}/action`, { cookie: admin, method: 'POST', body: { action: 'restore' } });
  assert.equal((await call('/api/users/search?q=bob', { cookie: alice })).data.users.length, 1);
});
test('verified badge shows on profile without granting admin', async () => {
  await call(`/api/admin/users/${aliceId}/action`, { cookie: admin, method: 'POST', body: { action: 'verify' } });
  const me = (await call('/api/me', { cookie: alice })).data.user;
  assert.equal(me.isVerified, true); assert.equal(me.isAdmin, false); assert.equal(me.role, 'Member');
});
test('flooding a chat is stopped by the server, logged, and appealable', async () => {
  bob = (await call('/api/auth/login', { method: 'POST', body: { identifier: 'bob', password: 'bob-pass-1' } })).cookie;
  const convo = (await call('/api/conversations', { cookie: alice, method: 'POST', body: { userId: bobId } })).data.conversation;
  const statuses = [];
  for (let i = 0; i < 12; i++) statuses.push((await call(`/api/conversations/${convo.id}/messages`, { cookie: alice, method: 'POST', body: { text: 'hello ' + i } })).status);
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(201));
  assert.equal(statuses[10], 429); assert.equal(statuses[11], 429);
  assert.equal((await call('/api/admin/logs?kind=spam', { cookie: admin })).data.logs[0].reason, 'flooding');
  assert.equal((await call('/api/appeals', { cookie: alice, method: 'POST', body: { targetType: 'spam', reason: 'I was just excited, sorry' } })).status, 201);
});
