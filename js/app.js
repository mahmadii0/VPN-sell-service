import { APP, TELEGRAM, isDev } from './core/config.js';

function getTelegram() {
  return window.Telegram?.WebApp ?? null;
}

function bootstrapTelegram() {
  const tg = getTelegram();
  if (!tg) {
    if (isDev()) console.info('[Telegram] SDK not detected — browser mode.');
    return null;
  }

  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.(TELEGRAM.themeColors.header);
    tg.setBackgroundColor?.(TELEGRAM.themeColors.background);
  } catch (err) {
    console.warn('[Telegram] Bootstrap warning:', err);
  }

  return tg;
}

function logBootSignature() {
  console.log(
    `%c${APP.nameEn} v${APP.version} — Phase ${APP.phase}`,
    'color:#22D3EE;font-weight:600;'
  );
}

function installErrorBoundary() {
  window.addEventListener('error', (e) => {
    console.error('[PULSE] Uncaught:', e.error ?? e.message);
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('[PULSE] Unhandled rejection:', e.reason);
  });
}

function main() {
  installErrorBoundary();
  bootstrapTelegram();
  logBootSignature();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}