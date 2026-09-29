function getHaptic() {
  return window.Telegram?.WebApp?.HapticFeedback ?? null;
}

export function impact(style = 'light') {
  const h = getHaptic();
  if (!h) return;
  try { h.impactOccurred(style); } catch { /* noop */ }
}

export function notification(type = 'success') {
  const h = getHaptic();
  if (!h) return;
  try { h.notificationOccurred(type); } catch { /* noop */ }
}

export function selectionChanged() {
  const h = getHaptic();
  if (!h) return;
  try { h.selectionChanged(); } catch { /* noop */ }
}

export const tap = () => impact('light');
export const select = () => impact('medium');
export const confirm = () => notification('success');
export const warn = () => notification('warning');
export const fail = () => notification('error');
