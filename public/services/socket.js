/**
 * NoChat v4 - Realtime Socket Service
 * Manages WebSocket connection, presence, and chat events.
 */

let socketInstance = null;
const listeners = new Map();

export function initSocket() {
  if (socketInstance || typeof window.io === 'undefined') return socketInstance;

  socketInstance = window.io({
    withCredentials: true,
    transports: ['websocket', 'polling']
  });

  socketInstance.on('connect', () => {
    console.log('[NoChat Realtime] Connected:', socketInstance.id);
  });

  socketInstance.on('disconnect', (reason) => {
    console.log('[NoChat Realtime] Disconnected:', reason);
  });

  return socketInstance;
}

export function getSocket() {
  return socketInstance || initSocket();
}

export function onSocketEvent(event, callback) {
  const socket = getSocket();
  if (!socket) return () => {};

  socket.on(event, callback);
  return () => socket.off(event, callback);
}

export function emitSocketEvent(event, data, callback) {
  const socket = getSocket();
  if (socket) {
    socket.emit(event, data, callback);
  }
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
