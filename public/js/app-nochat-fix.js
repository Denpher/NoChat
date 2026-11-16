const ROUTE_ACTIONS = Object.freeze({ home: 'home', search: 'discover', discover: 'discover', reels: 'reels', chat: 'chat', profile: 'profile', create: 'reels' });

let routeObserver;

export function routeHashFor({ href = '', dataRoute = '', action = '' } = {}) {
  const route = dataRoute || ROUTE_ACTIONS[action];
  if (route) return `#/${String(route).replace(/^#\/?/, '')}`;
  return href.startsWith('#/') ? href : '';
}

export function ensureNoChatFixStyles() {
  if (!document.querySelector('.shell') || document.querySelector('[data-nochat-fix-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/app-nochat-fix.css?v=1';
  link.dataset.nochatFixStyles = 'true';
  document.head.append(link);
}

export function installNoChatInteractionLayer(dispatch) {
  if (window.__nochat_action_router) return;
  window.__nochat_action_router = true;

  const ensureStyles = () => ensureNoChatFixStyles();
  ensureStyles();
  if (!routeObserver && document.body) {
    routeObserver = new MutationObserver(ensureStyles);
    routeObserver.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('click', event => {
    const element = event.target instanceof Element ? event.target : event.target?.parentElement;
    const control = element?.closest('[data-action], [data-route], [data-player-load], a[href^="#/"]');
    if (!control) return;

    const action = control.dataset.action || (control.hasAttribute('data-player-load') ? 'player-load' : '');
    if (action) {
      const owner = control.closest('[data-post-id], [data-reel-id]');
      const id = control.dataset.id || control.dataset.userId || control.dataset.messageId || owner?.dataset.postId || owner?.dataset.reelId || '';
      console.debug(`[NoChat] action=${action} id=${id}`);
      control.classList.add('nochat-action-pressed');
      setTimeout(() => control.classList.remove('nochat-action-pressed'), 160);
      dispatch(event, control, action);
    }

    const href = control.getAttribute('href') || '';
    const routeHash = routeHashFor({ href, dataRoute: control.dataset.route, action });
    if (routeHash) {
      event.preventDefault();
      window.location.hash = routeHash;
    }
  });
}
