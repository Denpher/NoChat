/**
 * NoChat v4 - Authentication Service
 * Manages user session, login, registration, and state persistence.
 */

import { api } from './api.js';
import { initSocket, disconnectSocket } from './socket.js';

let currentUser = null;
const authListeners = new Set();

export function getCurrentUser() {
  return currentUser;
}

export function subscribeAuth(listener) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

function notifyAuth() {
  authListeners.forEach(listener => listener(currentUser));
}

export async function fetchMe() {
  try {
    const data = await api.get('/api/me');
    currentUser = data.user || null;
    if (currentUser) {
      initSocket();
    }
  } catch (error) {
    currentUser = null;
  }
  notifyAuth();
  return currentUser;
}

export async function loginUser(identifier, password) {
  const data = await api.post('/api/auth/login', { identifier, password });
  currentUser = data.user;
  initSocket();
  notifyAuth();
  return data;
}

export async function registerUser({ username, email, password, displayName }) {
  const data = await api.post('/api/auth/register', { username, email, password, displayName });
  currentUser = data.user;
  initSocket();
  notifyAuth();
  return data;
}

export async function logoutUser() {
  try {
    await api.post('/api/auth/logout');
  } catch (e) {
    // ignore
  }
  currentUser = null;
  disconnectSocket();
  notifyAuth();
}
