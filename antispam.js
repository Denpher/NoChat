// Backend anti-spam. Pure logic (no I/O) so it can be unit-tested.
// Recent message history lives in memory; strikes and cooldowns are saved on the user record.
export const SPAM_RULES = Object.freeze({
  floodWindowMs: 10_000,     // more than floodMax messages in 10 s is flooding
  floodMax: 10,
  repeatWindowMs: 60_000,    // the same text more than repeatMax times in 60 s is repetition
  repeatMax: 4,
  strikeMemoryMs: 24 * 60 * 60 * 1000,
  // Progressive cooldowns by strike number (1st, 2nd, ...). Capped; never a permanent ban.
  cooldownsMs: [15_000, 60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000]
});

const normalize = (text) => String(text || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

export function cooldownFor(strike) {
  const list = SPAM_RULES.cooldownsMs;
  return list[Math.min(Math.max(strike, 1), list.length) - 1];
}

/**
 * history: { events: [{at, text}] } kept in memory per user.
 * spam: persisted { strikes: [iso], mutedUntil: iso|null }.
 * Returns { allowed, spam, reason?, cooldownMs?, strike?, retryAfterMs? }.
 */
export function checkSpam(history, spam = {}, text = '', now = Date.now()) {
  const next = { strikes: (spam.strikes || []).filter(t => now - Date.parse(t) < SPAM_RULES.strikeMemoryMs), mutedUntil: spam.mutedUntil || null };
  const mutedUntil = next.mutedUntil ? Date.parse(next.mutedUntil) : 0;
  if (mutedUntil > now) return { allowed: false, spam: next, reason: 'cooldown', retryAfterMs: mutedUntil - now };
  history.events = (history.events || []).filter(e => now - e.at < SPAM_RULES.repeatWindowMs);
  const value = normalize(text);
  const inFlood = history.events.filter(e => now - e.at < SPAM_RULES.floodWindowMs).length + 1;
  const repeats = value ? history.events.filter(e => e.text === value).length + 1 : 0;
  let reason = null;
  if (inFlood > SPAM_RULES.floodMax) reason = 'flooding';
  else if (repeats > SPAM_RULES.repeatMax) reason = 'repeated';
  if (!reason) { history.events.push({ at: now, text: value }); return { allowed: true, spam: next }; }
  const strike = next.strikes.length + 1;
  const cooldownMs = cooldownFor(strike);
  next.strikes.push(new Date(now).toISOString());
  next.mutedUntil = new Date(now + cooldownMs).toISOString();
  history.events = []; // fresh start after the cooldown, so one burst cannot escalate instantly
  return { allowed: false, spam: next, reason, strike, cooldownMs, retryAfterMs: cooldownMs };
}

export function spamMessage(result) {
  const secs = Math.ceil((result.retryAfterMs || 0) / 1000);
  const wait = secs >= 120 ? `${Math.ceil(secs / 60)} minutes` : `${secs} seconds`;
  if (result.reason === 'cooldown') return `You're sending messages too quickly. Please wait ${wait}.`;
  const what = result.reason === 'repeated' ? 'the same message repeatedly' : 'too many messages at once';
  return result.strike === 1
    ? `Warning: you sent ${what}. Please wait ${wait} before sending again.`
    : `You sent ${what} again. Messaging is paused for ${wait}. You can appeal this in Settings.`;
}
