// Group chats. Groups are conversations with type "group", so they reuse the existing persistent
// messages collection, Socket.IO rooms, attachments, typing, read markers and anti-spam.
// Every private group operation checks membership and role on the server.
import crypto from 'node:crypto';

export const MAX_GROUP_MEMBERS = 256;
export const isGroup = (c) => c?.type === 'group';
export function groupRole(group, userId) {
  if (!isGroup(group) || !group.members.includes(userId)) return null;
  if (group.ownerId === userId) return 'owner';
  if ((group.admins || []).includes(userId)) return 'admin';
  return 'member';
}
/** Owner manages everyone; admins manage plain members only. */
export function canRemove(group, actorId, targetId) {
  const a = groupRole(group, actorId), t = groupRole(group, targetId);
  if (!a || !t || actorId === targetId) return false;
  if (a === 'owner') return true;
  return a === 'admin' && t === 'member';
}
export function readCount(message, group) {
  return group.members.filter((id) => id !== message.senderId && (group.lastRead?.[id] || '') >= message.createdAt).length;
}

export function mountGroups({ app, io, db, authenticate, saveDB, persistFile, uploadImage, removeStoredFile, safeUser, areFriends, isListed, onlineUsers }) {
  const route = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
  const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const find = (id) => db.conversations.find((c) => c.id === id && isGroup(c) && !c.archivedAt);
  const userById = (id) => db.users.find((u) => u.id === id);
  const view = (g, me) => ({
    id: g.id, type: 'group', name: g.name, avatar: g.avatar || null, ownerId: g.ownerId, createdAt: g.createdAt,
    myRole: groupRole(g, me), memberCount: g.members.length,
    members: g.members.map((id) => { const u = userById(id); return u ? { ...safeUser(u, me), groupRole: groupRole(g, id), isOnline: onlineUsers.has(id) } : null; }).filter(Boolean)
  });
  const system = async (g, text) => {
    const m = { id: crypto.randomUUID(), conversationId: g.id, senderId: 'system', system: true, text, createdAt: new Date().toISOString() };
    db.messages.push(m); return m;
  };
  const broadcast = (g, message, extraMembers = []) => {
    if (message) io.to(`conversation:${g.id}`).emit('message:new', message);
    for (const id of new Set([...g.members, ...extraMembers])) io.to(`user:${id}`).emit('group:update', { groupId: g.id });
  };
  // Every private group route: 404 unless the caller is a current member (no existence leak).
  const load = (req, res, roles) => {
    const g = find(req.params.id);
    const role = groupRole(g, req.user.id);
    if (!g || !role) { res.status(404).json({ error: 'Group not found.' }); return null; }
    if (roles && !roles.includes(role)) { res.status(403).json({ error: 'Only group admins can do that.' }); return null; }
    return g;
  };
  const validNewMembers = (actor, ids, g) => {
    const out = [];
    for (const raw of Array.isArray(ids) ? ids : []) {
      const id = String(raw); if (id === actor.id || out.includes(id) || g?.members.includes(id)) continue;
      const u = userById(id);
      if (!u || !isListed(u)) throw Object.assign(new Error('One of those people is unavailable.'), { status: 404 });
      if (!areFriends(actor.id, id)) throw Object.assign(new Error('You can only add friends to a group.'), { status: 403 });
      out.push(id);
    }
    return out;
  };
  const name = (u) => u?.displayName || u?.username || 'Someone';

  app.post('/api/groups', authenticate, route(async (req, res) => {
    const title = clean(req.body.name, 60);
    if (title.length < 1) return res.status(400).json({ error: 'Give the group a name.' });
    let members;
    try { members = validNewMembers(req.user, req.body.memberIds); } catch (e) { return res.status(e.status).json({ error: e.message }); }
    if (!members.length) return res.status(400).json({ error: 'Add at least one friend.' });
    if (members.length + 1 > MAX_GROUP_MEMBERS) return res.status(400).json({ error: `Groups can have up to ${MAX_GROUP_MEMBERS} members.` });
    const g = { id: crypto.randomUUID(), type: 'group', name: title, avatar: null, ownerId: req.user.id, admins: [], members: [req.user.id, ...members], createdBy: req.user.id, createdAt: new Date().toISOString(), lastRead: {} };
    db.conversations.push(g);
    const m = await system(g, `${name(req.user)} created the group “${title}”`);
    await saveDB();
    broadcast(g, m);
    for (const id of members) io.to(`user:${id}`).emit('conversation:update', { conversationId: g.id, message: { ...m, senderDisplayName: g.name } });
    res.status(201).json({ group: view(g, req.user.id) });
  }));

  app.get('/api/groups/:id', authenticate, route(async (req, res) => {
    const g = load(req, res); if (!g) return;
    res.json({ group: view(g, req.user.id) });
  }));

  app.put('/api/groups/:id', authenticate, route(async (req, res) => {
    const g = load(req, res, ['owner', 'admin']); if (!g) return;
    const title = clean(req.body.name, 60); if (!title) return res.status(400).json({ error: 'Give the group a name.' });
    if (title !== g.name) { g.name = title; const m = await system(g, `${name(req.user)} renamed the group to “${title}”`); await saveDB(); broadcast(g, m); }
    res.json({ group: view(g, req.user.id) });
  }));

  app.post('/api/groups/:id/avatar', authenticate, uploadImage.single('avatar'), route(async (req, res) => {
    const g = load(req, res, ['owner', 'admin']); if (!g) return;
    if (!req.file) return res.status(400).json({ error: 'Choose an image.' });
    const old = g.avatar; g.avatar = await persistFile(req.file, 'profile', g.id);
    const m = await system(g, `${name(req.user)} changed the group photo`); await saveDB(); broadcast(g, m);
    if (old) await removeStoredFile(old).catch(() => {});
    res.json({ group: view(g, req.user.id) });
  }));

  app.post('/api/groups/:id/members', authenticate, route(async (req, res) => {
    const g = load(req, res, ['owner', 'admin']); if (!g) return;
    let ids; try { ids = validNewMembers(req.user, req.body.userIds, g); } catch (e) { return res.status(e.status).json({ error: e.message }); }
    if (!ids.length) return res.status(400).json({ error: 'Choose friends to add.' });
    if (g.members.length + ids.length > MAX_GROUP_MEMBERS) return res.status(400).json({ error: `Groups can have up to ${MAX_GROUP_MEMBERS} members.` });
    g.members.push(...ids);
    // New members do not get old unread badges for history they were not part of.
    g.lastRead ??= {}; const nowIso = new Date().toISOString(); for (const id of ids) g.lastRead[id] = nowIso;
    const m = await system(g, `${name(req.user)} added ${ids.map((id) => name(userById(id))).join(', ')}`);
    await saveDB(); broadcast(g, m);
    res.json({ group: view(g, req.user.id) });
  }));

  app.delete('/api/groups/:id/members/:userId', authenticate, route(async (req, res) => {
    const g = load(req, res); if (!g) return;
    const target = req.params.userId;
    if (!g.members.includes(target)) return res.status(404).json({ error: 'That person is not in this group.' });
    if (!canRemove(g, req.user.id, target)) return res.status(403).json({ error: 'You cannot remove this member.' });
    g.members = g.members.filter((id) => id !== target); g.admins = (g.admins || []).filter((id) => id !== target);
    const m = await system(g, `${name(req.user)} removed ${name(userById(target))}`);
    await saveDB();
    io.in(`user:${target}`).socketsLeave(`conversation:${g.id}`);
    io.to(`user:${target}`).emit('group:removed', { groupId: g.id, name: g.name });
    broadcast(g, m);
    res.json({ group: view(g, req.user.id) });
  }));

  app.post('/api/groups/:id/admins/:userId', authenticate, route(async (req, res) => {
    const g = load(req, res, ['owner']); if (!g) return;
    const target = req.params.userId;
    if (!g.members.includes(target) || target === g.ownerId) return res.status(400).json({ error: 'Choose a group member.' });
    const make = req.body.admin !== false;
    g.admins = (g.admins || []).filter((id) => id !== target); if (make) g.admins.push(target);
    const m = await system(g, make ? `${name(userById(target))} is now a group admin` : `${name(userById(target))} is no longer a group admin`);
    await saveDB(); broadcast(g, m);
    res.json({ group: view(g, req.user.id) });
  }));

  app.post('/api/groups/:id/leave', authenticate, route(async (req, res) => {
    const g = load(req, res); if (!g) return;
    const me = req.user.id;
    g.members = g.members.filter((id) => id !== me); g.admins = (g.admins || []).filter((id) => id !== me);
    let text = `${name(req.user)} left the group`;
    if (g.ownerId === me) {
      const next = g.admins[0] || g.members[0];
      if (next) { g.ownerId = next; g.admins = g.admins.filter((id) => id !== next); text += ` · ${name(userById(next))} is now the owner`; }
      else { g.archivedAt = new Date().toISOString(); g.ownerId = null; } // history kept, never deleted
    }
    const m = await system(g, text);
    await saveDB();
    io.in(`user:${me}`).socketsLeave(`conversation:${g.id}`);
    broadcast(g, m, [me]);
    res.json({ success: true });
  }));

  return { isGroup, view, readCount };
}
