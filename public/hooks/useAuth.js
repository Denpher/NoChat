/**
 * NoChat v4 - Auth State Hook
 */

import { getCurrentUser, subscribeAuth, fetchMe } from '../services/auth.js';

export function useAuth(onAuthChange) {
  const unsubscribe = subscribeAuth(onAuthChange);
  const user = getCurrentUser();
  if (user) onAuthChange(user);
  else fetchMe().then(onAuthChange);

  return {
    getUser: getCurrentUser,
    unsubscribe
  };
}
