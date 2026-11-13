// Group chats: authorization on every private operation, roles, realtime delivery, read status, history.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { server } from './helpers.js';
import { canRemove, groupRole } from '../groups.js';

const S = server(5103);
let owner, ann, ben, cat, outsider, gid;
const connect = (u) => new Promise((res, rej) => { const s = io(S.B, { extraHeaders: { cookie: u.cookie }, transports: ['websocket'] }); s.on('connect', () => res(s)); s.on('connect_error', rej); });
const once = (s, ev, pred = () => true, ms = 3000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + ev)), ms); const h = (d) => { if (pred(d)) { clearTimeout(t); s.off(ev, h); res(d); } }; s.on(ev, h); });

before(async () => {
  await S.start();
  [owner, ann, ben, cat, outsider] = await Promise.all(['owner', 'ann', 'ben', 'cat', 'outsider'].map((n) => S.register(n)));
  for (const f of [ann, ben, cat]) await S.befriend(owner, f);
});
after(async () => { await S.stop(); S.cleanup(); });

test('create requires a name and friends only', async () => {
  assert.equal((await S.call('/api/groups', { cookie: owner.cookie, method: 'POST', body: { name: '', memberIds: [ann.id] } })).status, 400);
  assert.equal((await S.call('/api/groups', { cookie: owner.cookie, method: 'POST', body: { name: 'Crew', memberIds: [outsider.id] } })).status, 403);
  const r = await S.call('/api/groups', { cookie: owner.cookie, method: 'POST', body: { name: 'Crew', memberIds: [ann.id, ben.id] } });
  assert.equal(r.status, 201); gid = r.data.group.id;
  assert.equal(r.data.group.myRole, 'owner'); assert.equal(r.data.group.memberCount, 3);
  const list = await S.call('/api/conversations', { cookie: ann.cookie });
  const g = list.data.conversations.find((c) => c.id === gid);
  assert.equal(g.type, 'group'); assert.equal(g.group.name, 'Crew');
});

test('non-members cannot see, read, post, join or manage the group', async () => {
  for (const p of [`/api/groups/${gid}`, `/api/conversations/${gid}/messages`]) assert.equal((await S.call(p, { cookie: outsider.cookie })).status, 404, p);
  assert.equal((await S.call(`/api/conversations/${gid}/messages`, { cookie: outsider.cookie, method: 'POST', body: { text: 'hi' } })).status, 404);
  assert.equal((await S.call(`/api/groups/${gid}/members`, { cookie: outsider.cookie, method: 'POST', body: { userIds: [outsider.id] } })).status, 404);
  assert.equal((await S.call(`/api/groups/${gid}/leave`, { cookie: outsider.cookie, method: 'POST' })).status, 404);
  assert.ok(!(await S.call('/api/conversations', { cookie: outsider.cookie })).data.conversations.some((c) => c.id === gid));
  const sock = await connect(outsider);
  let leaked = false; sock.on('message:new', () => { leaked = true; });
  sock.emit('conversation:join', gid);
  const ack = await new Promise((r) => sock.emit('message:send', { conversationId: gid, text: 'sneaky' }, r));
  assert.ok(ack.error);
  await S.call(`/api/conversations/${gid}/messages`, { cookie: ann.cookie, method: 'POST', body: { text: 'members only' } });
  await new Promise((r) => setTimeout(r, 300)); sock.close();
  assert.equal(leaked, false);
});

test('plain members cannot add, remove, rename or promote', async () => {
  assert.equal((await S.call(`/api/groups/${gid}/members`, { cookie: ann.cookie, method: 'POST', body: { userIds: [cat.id] } })).status, 403);
  assert.equal((await S.call(`/api/groups/${gid}/members/${ben.id}`, { cookie: ann.cookie, method: 'DELETE' })).status, 403);
  assert.equal((await S.call(`/api/groups/${gid}`, { cookie: ann.cookie, method: 'PUT', body: { name: 'Mine' } })).status, 403);
  assert.equal((await S.call(`/api/groups/${gid}/admins/${ann.id}`, { cookie: ann.cookie, method: 'POST', body: { admin: true } })).status, 403);
});

test('real-time messages reach every member over Socket.IO and persist in history', async () => {
  const [sa, sb] = await Promise.all([connect(ann), connect(ben)]);
  sa.emit('conversation:join', gid); sb.emit('conversation:join', gid);
  await new Promise((r) => setTimeout(r, 200));
  const got = once(sb, 'message:new', (m) => m.text === 'hello group');
  const notify = once(sb, 'conversation:update', (d) => d.conversationId === gid);
  const ack = await new Promise((r) => sa.emit('message:send', { conversationId: gid, text: 'hello group' }, r));
  assert.ok(ack.success, JSON.stringify(ack));
  assert.equal((await got).senderId, ann.id); await notify;
  sa.close(); sb.close();
  const hist = await S.call(`/api/conversations/${gid}/messages`, { cookie: owner.cookie });
  const m = hist.data.messages.find((x) => x.text === 'hello group');
  assert.ok(m && m.createdAt); assert.equal(m.readTotal, 2); assert.equal(m.readBy, 0);
  assert.ok(hist.data.messages.some((x) => x.system && /created the group/.test(x.text)));
});

test('read status counts members who opened the chat', async () => {
  await S.call(`/api/conversations/${gid}/read`, { cookie: owner.cookie, method: 'POST' });
  const hist = await S.call(`/api/conversations/${gid}/messages`, { cookie: ann.cookie });
  assert.equal(hist.data.messages.find((x) => x.text === 'hello group').readBy, 1);
  const list = await S.call('/api/conversations', { cookie: ben.cookie });
  assert.ok(list.data.conversations.find((c) => c.id === gid).unreadCount >= 1);
});

test('owner promotes an admin; admin adds/removes members but cannot remove the owner or other admins', async () => {
  assert.equal((await S.call(`/api/groups/${gid}/admins/${ann.id}`, { cookie: owner.cookie, method: 'POST', body: { admin: true } })).status, 200);
  await S.befriend(ann, cat);
  const added = await S.call(`/api/groups/${gid}/members`, { cookie: ann.cookie, method: 'POST', body: { userIds: [cat.id] } });
  assert.equal(added.status, 200); assert.equal(added.data.group.memberCount, 4);
  assert.equal((await S.call(`/api/groups/${gid}/members/${owner.id}`, { cookie: ann.cookie, method: 'DELETE' })).status, 403);
  assert.equal((await S.call(`/api/groups/${gid}/admins/${ben.id}`, { cookie: owner.cookie, method: 'POST', body: { admin: true } })).status, 200);
  assert.equal((await S.call(`/api/groups/${gid}/members/${ben.id}`, { cookie: ann.cookie, method: 'DELETE' })).status, 403, 'admin cannot remove admin');
  assert.equal((await S.call(`/api/groups/${gid}/admins/${ben.id}`, { cookie: owner.cookie, method: 'POST', body: { admin: false } })).status, 200);
  const sc = await connect(cat);
  const removed = once(sc, 'group:removed', (d) => d.groupId === gid);
  assert.equal((await S.call(`/api/groups/${gid}/members/${cat.id}`, { cookie: ann.cookie, method: 'DELETE' })).status, 200);
  await removed; sc.close();
  assert.equal((await S.call(`/api/conversations/${gid}/messages`, { cookie: cat.cookie })).status, 404, 'removed member loses access');
});

test('leave: owner leaving hands ownership to an admin; history survives restart', async () => {
  assert.equal((await S.call(`/api/groups/${gid}/leave`, { cookie: owner.cookie, method: 'POST' })).status, 200);
  assert.equal((await S.call(`/api/groups/${gid}`, { cookie: owner.cookie })).status, 404);
  await S.stop(); await S.start();
  const g = await S.call(`/api/groups/${gid}`, { cookie: ann.cookie });
  assert.equal(g.data.group.ownerId, ann.id); assert.equal(g.data.group.myRole, 'owner');
  const hist = await S.call(`/api/conversations/${gid}/messages`, { cookie: ben.cookie });
  assert.ok(hist.data.messages.some((m) => m.text === 'hello group'));
});

test('one-to-one chats are unchanged and groups cannot be called', async () => {
  const dm = await S.call('/api/conversations', { cookie: ann.cookie, method: 'POST', body: { userId: owner.id } });
  assert.equal(dm.status, 200); assert.notEqual(dm.data.conversation.id, gid); assert.equal(dm.data.conversation.type, undefined);
  const sa = await connect(ann);
  const ack = await new Promise((r) => sa.emit('call:invite', { conversationId: gid }, r));
  sa.close(); assert.match(ack.error, /one-to-one/);
});

test('role rules (unit)', () => {
  const g = { type: 'group', ownerId: 'o', admins: ['a'], members: ['o', 'a', 'm'] };
  assert.equal(groupRole(g, 'x'), null);
  assert.equal(canRemove(g, 'o', 'a'), true); assert.equal(canRemove(g, 'a', 'm'), true);
  assert.equal(canRemove(g, 'a', 'o'), false); assert.equal(canRemove(g, 'm', 'a'), false); assert.equal(canRemove(g, 'o', 'o'), false);
});
