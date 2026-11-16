/**
 * NoChat v4 - Double Tap Detector Hook (Heart Burst)
 */

export function attachDoubleTap(element, onDoubleTap, delayMs = 300) {
  if (!element) return () => {};

  let lastTap = 0;
  const handler = (e) => {
    const now = Date.now();
    const diff = now - lastTap;
    if (diff > 0 && diff < delayMs) {
      e.preventDefault();
      onDoubleTap(e);
      lastTap = 0;
    } else {
      lastTap = now;
    }
  };

  element.addEventListener('touchend', handler, { passive: false });
  element.addEventListener('click', handler);

  return () => {
    element.removeEventListener('touchend', handler);
    element.removeEventListener('click', handler);
  };
}
