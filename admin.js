import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ADMIN_ACTIONS, checkAdminAction, applyAdminAction, accountRestriction, cleanText } from './accounts.js';
// Logs and appeals live in the existing `reports` collection with a `kind` field, so the
// Cloud storage bridge needs no schema change. Reel reports (no kind) keep working unchanged.
export function addLog(db, entry) {
  const row = { id: crypto.randomUUID(), status: 'logged', createdAt: new Date().toISOString(), ...entry };
  db.reports.push(row); return row;
}
const maskEmail = (e) => { if (!e) return null; const [n, d] = String(e).split('@'); return `${n.slice(0, 2)}***@${d || ''}`; };

export function mountAdmin({ app, io, db, authenticate, saveDB, isAdmin, safeUser, founderId, findUserByIdentifier, onlineUsers }) {
  const route = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
  // Every admin route is verified here on the server; hidden buttons are not security.
  const requireAdmin = async (req, res, next) => {
    try { if (!await isAdmin(req.user)) return res.status(403).json({ error: 'Not authorized.' }); next(); }
    catch (e) { next(e); }
  };
  const adminView = (u) => ({
    id: u.id, username: u.username, displayName: u.displayName || u.username, email: maskEmail(u.email),
    profilePicture: u.profilePicture || null, createdAt: u.createdAt,
    status: u.status || 'active', statusReason: u.statusReason || null, statusUntil: u.statusUntil || null,
    restricted: Boolean(accountRestriction(u)), verifiedBadge: u.verifiedBadge === true || u.id === founderId,
    isFounder: u.id === founderId, protected: u.id === founderId, hasPassword: Boolean(u.passwordHash),
    sessionsRevokedAt: u.sessionsRevokedAt || null, isOnline: onlineUsers.has(u.id),
    spamStrikes: (u.spam?.strikes || []).length, mutedUntil: u.spam?.mutedUntil || null,
    reelsCount: db.reels.filter(r => r.userId === u.id).length,
    messagesCount: db.messages.filter(m => m.senderId === u.id).length,
    openAppeals: db.reports.filter(r => r.kind === 'appeal' && r.status === 'open' && r.userId === u.id).length
  });
  const audit = (req, action, target, outcome, details = {}) => addLog(db, {
    kind: 'audit', actorId: req.user.id, actorUsername: req.user.username, action,
    targetId: target?.id || null, targetUsername: target?.username || null, outcome, ...details
  });

  app.get('/api/admin/users', authenticate, requireAdmin, (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase().replace(/^@/, '').slice(0, 80);
    const status = String(req.query.status || '');
    let users = db.users;
    if (q) users = users.filter(u => u.id.toLowerCase() === q || u.id.toLowerCase().startsWith(q) || (u.username || '').includes(q) || (u.displayName || '').toLowerCase().includes(q));
    if (status) users = users.filter(u => (u.status || 'active') === status);
    res.set('Cache-Control', 'no-store').json({ users: users.slice(0, 50).map(adminView), total: users.length });
  });
  app.get('/api/admin/users/:id', authenticate, requireAdmin, (req, res) => {
    const u = db.users.find(x => x.id === req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found.' });
    res.set('Cache-Control', 'no-store').json({ user: adminView(u), history: db.reports.filter(r => r.kind && (r.targetId === u.id || r.userId === u.id)).slice(-50).reverse() });
  });
  app.post('/api/admin/users/:id/action', authenticate, requireAdmin, route(async (req, res) => {
    const target = db.users.find(x => x.id === req.params.id);
    const action = String(req.body?.action || '');
    const refusal = checkAdminAction({ actor: req.user, target, action, body: req.body || {}, founderId });
    if (refusal) {
      if (target && refusal.status === 403) { audit(req, action, target, 'denied', { reason: refusal.error }); await saveDB(); }
      return res.status(refusal.status).json({ error: refusal.error });
    }
    const { reason } = applyAdminAction(target, action, req.body || {});
    audit(req, action, target, 'success', { reason, durationHours: action === 'suspend' ? Number(req.body.durationHours ?? 24) : undefined });
    await saveDB();
    if (ADMIN_ACTIONS[action].destructive) {
      io.in(`user:${target.id}`).disconnectSockets(true);
      io.emit('presence:update', { userId: target.id, isOnline: false });
    }
    res.json({ success: true, user: adminView(target) });
  }));
  app.get('/api/admin/logs', authenticate, requireAdmin, (req, res) => {
    const kind = ['audit', 'spam', 'moderation', 'appeal'].includes(req.query.kind) ? req.query.kind : 'audit';
    res.set('Cache-Control', 'no-store').json({ logs: db.reports.filter(r => r.kind === kind).slice(-200).reverse() });
  });
  app.get('/api/admin/appeals', authenticate, requireAdmin, (req, res) => {
    const status = ['open', 'accepted', 'rejected'].includes(req.query.status) ? req.query.status : 'open';
    const appeals = db.reports.filter(r => r.kind === 'appeal' && r.status === status).slice(-200).reverse()
      .map(a => { const u = db.users.find(x => x.id === a.userId); return { ...a, user: u ? adminView(u) : null }; });
    res.set('Cache-Control', 'no-store').json({ appeals });
  });
  app.post('/api/admin/appeals/:id', authenticate, requireAdmin, route(async (req, res) => {
    const appeal = db.reports.find(r => r.kind === 'appeal' && r.id === req.params.id);
    if (!appeal) return res.status(404).json({ error: 'Appeal not found.' });
    if (appeal.status !== 'open') return res.status(409).json({ error: 'This appeal was already decided.' });
    const decision = req.body?.decision;
    if (!['accepted', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Invalid decision.' });
    const user = db.users.find(x => x.id === appeal.userId);
    if (user?.id === founderId) return res.status(403).json({ error: 'The founder account is protected.' });
    if (decision === 'accepted') {
      if (appeal.targetType === 'account' && user) applyAdminAction(user, 'restore');
      if (appeal.targetType === 'spam' && user) applyAdminAction(user, 'clear-spam');
      if (appeal.targetType === 'reel') {
        const reel = db.reels.find(r => r.id === appeal.targetId && r.userId === appeal.userId);
        if (reel) { reel.moderationStatus = 'approved'; reel.moderationReason = 'Appeal accepted';
          addLog(db, { kind: 'moderation', reelRef: reel.id, userId: reel.userId, decision: 'approved', source: 'administrator', reason: 'Appeal accepted', actorId: req.user.id }); }
      }
    }
    Object.assign(appeal, { status: decision, decidedAt: new Date().toISOString(), decidedBy: req.user.id, note: cleanText(req.body.note, 500) || null });
    audit(req, `appeal-${decision}`, user, 'success', { appealId: appeal.id, targetType: appeal.targetType });
    await saveDB();
    res.json({ success: true });
  }));

  // ---- user appeals ----
  const openAppeal = (userId, targetType, targetId) => db.reports.find(r => r.kind === 'appeal' && r.status === 'open' && r.userId === userId && r.targetType === targetType && (r.targetId || null) === (targetId || null));
  app.post('/api/appeals', authenticate, route(async (req, res) => {
    const targetType = req.body?.targetType;
    const reason = cleanText(req.body?.reason, 1000);
    if (!['spam', 'reel'].includes(targetType)) return res.status(400).json({ error: 'Invalid appeal type.' });
    if (reason.length < 10) return res.status(400).json({ error: 'Please explain your appeal in at least 10 characters.' });
    let targetId = null;
    if (targetType === 'reel') {
      const reel = db.reels.find(r => r.id === req.body.targetId && r.userId === req.user.id);
      if (!reel || !['pending', 'blocked'].includes(reel.moderationStatus)) return res.status(400).json({ error: 'This reel has no moderation decision to appeal.' });
      targetId = reel.id;
    } else if (!(req.user.spam?.strikes || []).length && !req.user.spam?.mutedUntil) return res.status(400).json({ error: 'There is no messaging restriction to appeal.' });
    if (openAppeal(req.user.id, targetType, targetId)) return res.status(409).json({ error: 'You already have an open appeal for this.' });
    addLog(db, { kind: 'appeal', status: 'open', userId: req.user.id, targetType, targetId, reason });
    await saveDB();
    res.status(201).json({ success: true, message: 'Appeal submitted. An administrator will review it.' });
  }));
  app.get('/api/appeals/mine', authenticate, (req, res) => {
    res.set('Cache-Control', 'no-store').json({ appeals: db.reports.filter(r => r.kind === 'appeal' && r.userId === req.user.id).slice(-20).reverse() });
  });
  // Restricted accounts cannot sign in, so they appeal with their credentials (rate-limited under /api/auth).
  app.post('/api/auth/appeal', route(async (req, res) => {
    const user = findUserByIdentifier(req.body?.identifier);
    const reason = cleanText(req.body?.reason, 1000);
    const ok = user?.passwordHash && await bcrypt.compare(String(req.body?.password || ''), user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Username or password is incorrect.' });
    if (!accountRestriction(user)) return res.status(400).json({ error: 'This account is not restricted. Sign in normally.' });
    if (reason.length < 10) return res.status(400).json({ error: 'Please explain your appeal in at least 10 characters.' });
    if (openAppeal(user.id, 'account', null)) return res.status(409).json({ error: 'You already have an open appeal.' });
    addLog(db, { kind: 'appeal', status: 'open', userId: user.id, targetType: 'account', targetId: null, reason, accountStatus: user.status });
    await saveDB();
    res.status(201).json({ success: true, message: 'Appeal submitted. An administrator will review it.' });
  }));
}
