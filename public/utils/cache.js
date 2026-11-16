/**
 * NoChat v4 - LRU Message Cache
 * Keeps up to 50 recent messages per conversation in memory for 60fps fast switching.
 */

const messageCache = new Map();
const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES_PER_CONVO = 50;

export function getCachedMessages(conversationId) {
  return messageCache.get(conversationId) || null;
}

export function setCachedMessages(conversationId, messages) {
  if (messageCache.size >= MAX_CONVERSATIONS) {
    const firstKey = messageCache.keys().next().value;
    messageCache.delete(firstKey);
  }
  const slice = (messages || []).slice(-MAX_MESSAGES_PER_CONVO);
  messageCache.set(conversationId, slice);
}

export function appendCachedMessage(conversationId, message) {
  const existing = messageCache.get(conversationId) || [];
  if (!existing.some(m => m.id === message.id)) {
    existing.push(message);
    setCachedMessages(conversationId, existing);
  }
}

export function clearMessageCache() {
  messageCache.clear();
}
