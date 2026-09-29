import { TELEGRAM } from '../core/config.js';

function tg() {
  return window.Telegram?.WebApp ?? null;
}

export function isAvailable() {
  return Boolean(tg());
}

export function ready() {
  const app = tg();
  if (!app) return;
  try {
    app.ready();
    app.expand();
    app.setHeaderColor?.(TELEGRAM.themeColors.header);
    app.setBackgroundColor?.(TELEGRAM.themeColors.background);
  } catch (err) {
    console.warn('[telegram] init warning:', err);
  }
}

// Safe access — never trusted for security, only for display.
export function getUser() {
  const app = tg();
  const u = app?.initDataUnsafe?.user;
  if (!u) return null;
  return {
    id: u.id ?? null,
    firstName: u.first_name ?? '',
    lastName: u.last_name ?? '',
    username: u.username ?? '',
    languageCode: u.language_code ?? 'fa',
    isPremium: Boolean(u.is_premium),
    photoUrl: u.photo_url ?? null
  };
}

export function getInitData() {
  return tg()?.initData ?? '';
}

export function getTheme() {
  const app = tg();
  if (!app) return 'dark';
  return app.colorScheme === 'light' ? 'light' : 'dark';
}

// Main button — the primary CTA at the bottom of Telegram.
export function mainButton({ text, onClick, show = true, enabled = true, loading = false } = {}) {
  const app = tg();
  if (!app?.MainButton) return;

  const btn = app.MainButton;
  if (text) btn.setText(text);
  btn[enabled ? 'enable' : 'disable']?.();
  btn[loading ? 'showProgress' : 'hideProgress']?.();

  if (typeof onClick === 'function') {
    btn.offClick?.(btn.__pulseHandler);
    btn.__pulseHandler = onClick;
    btn.onClick(onClick);
  }

  if (show) btn.show();
  else btn.hide();
}

export function hideMainButton() {
  tg()?.MainButton?.hide?.();
}

// Back button — native Telegram back navigation.
export function backButton({ onClick, show = true } = {}) {
  const app = tg();
  if (!app?.BackButton) return;

  const btn = app.BackButton;
  if (typeof onClick === 'function') {
    btn.offClick?.(btn.__pulseHandler);
    btn.__pulseHandler = onClick;
    btn.onClick(onClick);
  }

  if (show) btn.show();
  else btn.hide();
}

export function hideBackButton() {
  tg()?.BackButton?.hide?.();
}

// Native popup — replaces window.alert/confirm.
export function showAlert(message, callback = null) {
  const app = tg();
  if (app?.showAlert) {
    app.showAlert(message, callback ?? undefined);
    return;
  }
  window.alert(message);
  callback?.();
}

export function showConfirm(message, callback) {
  const app = tg();
  if (app?.showConfirm) {
    app.showConfirm(message, callback);
    return;
  }
  const ok = window.confirm(message);
  callback?.(ok);
}

// Haptic feedback — graceful when unavailable.
export function haptic(style = 'light') {
  const h = tg()?.HapticFeedback;
  if (!h) return;
  if (style === 'light' || style === 'medium' || style === 'heavy' || style === 'rigid' || style === 'soft') {
    h.impactOccurred(style);
  } else if (style === 'success' || style === 'warning' || style === 'error') {
    h.notificationOccurred(style);
  }
}
