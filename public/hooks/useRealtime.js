/**
 * NoChat v4 - Realtime Subscription Hook
 */

import { onSocketEvent, emitSocketEvent } from '../services/socket.js';

export function useRealtime(eventMap = {}) {
  const cleanups = [];

  for (const [event, handler] of Object.entries(eventMap)) {
    const unsub = onSocketEvent(event, handler);
    cleanups.push(unsub);
  }

  return {
    emit: emitSocketEvent,
    destroy: () => cleanups.forEach(fn => fn())
  };
}
