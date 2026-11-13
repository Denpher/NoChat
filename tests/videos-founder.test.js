// The founder account only manages videos when its email is exactly denpherai@gmail.com.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from './helpers.js';
const S = server(5102, { FOUNDER_PASSWORD: 'Founder-Pass-1', FOUNDER_EMAIL: 'someone-else@example.com' });
before(() => S.start()); after(async () => { await S.stop(); S.cleanup(); });
test('FOUNDER_EMAIL override cannot grant video management', async () => {
  const founder = (await S.call('/api/auth/login', { method: 'POST', body: { identifier: 'denpher', password: 'Founder-Pass-1' } })).cookie;
  assert.equal((await S.call('/api/me', { cookie: founder })).data.user.isAdmin, true, 'still an admin');
  const r = await S.call('/api/videos', { cookie: founder, method: 'POST', body: { url: 'https://youtu.be/YE7VzlLtp-4', title: 'X video', category: 'Movies' } });
  assert.equal(r.status, 403);
  assert.equal((await S.call('/api/videos?limit=1', { cookie: founder })).data.canManage, false);
});
test('nobody can register with the founder email', async () => {
  const r = await S.call('/api/auth/register', { method: 'POST', body: { username: 'fake', email: 'denpherai@gmail.com', password: 'fake-pass-1' } });
  assert.ok(r.status >= 400);
});
