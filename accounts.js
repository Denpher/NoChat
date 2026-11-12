// Account status, session revocation and admin-action rules. Pure functions, unit-tested.
export const ACCOUNT_STATUSES = ['active', 'suspended', 'banned', 'deleted'];
export const ADMIN_ACTIONS = Object.freeze({
  suspend: { destructive: true, needsReason: true },
  ban: { destructive: true, needsReason: true },
  delete: { destructive: true, needsReason: true },
  'revoke-sessions': { destructive: true, needsReason: false },
  restore: { destructive: false, needsReason: false },
  verify: { destructive: false, needsReason: false },
  unverify: { destructive: false, needsReason: false },
  'clear-spam': { destructive: false, needsReason: false }
});

export function cleanText(value, max) {
  // Strip control characters (keep newlines/tabs), trim, cap length.
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function accountRestriction(user, now = Date.now()) {
  const status = user?.status || 'active';
  if (status === 'deleted') return { code: 'ACCOUNT_DELETED', error: 'This account has been deleted. You can submit an appeal.' };
  if (status === 'banned') return { code: 'ACCOUNT_BANNED', error: 'This account has been banned. You can submit an appeal.' };
  if (status === 'suspended') {
    if (user.statusUntil && Date.parse(user.statusUntil) <= now) return null; // suspension expired
    const until = user.statusUntil ? ` until ${new Date(user.statusUntil).toUTCString()}` : '';
    return { code: 'ACCOUNT_SUSPENDED', error: `This account is suspended${until}. You can submit an appeal.` };
  }
  return null;
}

// Each token carries the user's session version (`sv`). Revoking bumps the version, so every older
// token fails immediately while new sign-ins work. Existing tokens without `sv` count as version 0.
export function sessionRevoked(user, payload = {}) {
  return (Number(payload.sv) || 0) !== (Number(user?.sessionVersion) || 0);
}
function revoke(target, iso) { target.sessionVersion = (Number(target.sessionVersion) || 0) + 1; target.sessionsRevokedAt = iso; }

export function isListed(user) { return Boolean(user) && !['deleted', 'banned'].includes(user.status || 'active'); }

/** Validates an admin action. Returns { status, error } on refusal or null when allowed. */
export function checkAdminAction({ actor, target, action, body = {}, founderId }) {
  const rule = ADMIN_ACTIONS[action];
  if (!rule) return { status: 400, error: 'Unknown action.' };
  if (!target) return { status: 404, error: 'User not found.' };
  if (target.id === founderId) return { status: 403, error: 'The founder account is protected and cannot be modified.' };
  if (actor?.id === target.id) return { status: 403, error: 'You cannot perform admin actions on your own account.' };
  if (rule.needsReason && cleanText(body.reason, 500).length < 3) return { status: 400, error: 'Please give a reason (at least 3 characters).' };
  if (rule.destructive && String(body.confirm || '') !== target.username) return { status: 400, error: `Type the username "${target.username}" to confirm.` };
  if (action === 'suspend') {
    const h = Number(body.durationHours ?? 24);
    if (!Number.isFinite(h) || h < 1 || h > 8760) return { status: 400, error: 'Suspension must be between 1 hour and 365 days.' };
  }
  return null;
}

/** Applies an already-validated action to the target user record. */
export function applyAdminAction(target, action, body = {}, now = Date.now()) {
  const reason = cleanText(body.reason, 500) || null;
  const iso = new Date(now).toISOString();
  switch (action) {
    case 'suspend':
      Object.assign(target, { status: 'suspended', statusReason: reason, statusUntil: new Date(now + Number(body.durationHours ?? 24) * 3600_000).toISOString(), statusChangedAt: iso }); revoke(target, iso); break;
    case 'ban':
      Object.assign(target, { status: 'banned', statusReason: reason, statusUntil: null, statusChangedAt: iso }); revoke(target, iso); break;
    case 'delete': // soft delete: all records are kept and the account can be restored
      Object.assign(target, { status: 'deleted', statusReason: reason, statusUntil: null, deletedAt: iso, statusChangedAt: iso }); revoke(target, iso); break;
    case 'restore':
      Object.assign(target, { status: 'active', statusReason: null, statusUntil: null, deletedAt: null, statusChangedAt: iso }); break;
    case 'revoke-sessions': revoke(target, iso); break;
    case 'verify': target.verifiedBadge = true; break;
    case 'unverify': target.verifiedBadge = false; break;
    case 'clear-spam': target.spam = { strikes: [], mutedUntil: null }; break;
  }
  return { action, reason };
}
