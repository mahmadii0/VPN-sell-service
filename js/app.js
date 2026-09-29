import { APP, isDev } from './core/config.js';
import { SCREENS } from './core/constants.js';
import * as router from './core/router.js';
import { renderBottomNav } from './components/bottomNav.js';
import { renderHome } from './pages/home.js';
import { renderDuration } from './pages/duration.js';
import { renderConnectionType } from './pages/connectionType.js';
import { renderPlans } from './pages/plans.js';
import { renderCheckout } from './pages/checkout.js';
import { renderReceiptUpload } from './pages/receiptUpload.js';
import { renderPaymentResult } from './pages/paymentResult.js';
import { renderMySubscription } from './pages/mySubscription.js';
import { renderMyPurchases } from './pages/myPurchases.js';
import { renderOrderDetail } from './pages/orderDetail.js';
import { renderWallet } from './pages/wallet.js';
import { renderAccount } from './pages/account.js';
import { renderSettings } from './pages/settings.js';
import { renderSupport } from './pages/support.js';
import { renderGuide } from './pages/guide.js';
import { renderNotifications } from './pages/notifications.js';
import { ready as telegramReady, isAvailable as telegramAvailable } from './services/telegram.js';

const SPLASH_MIN_MS = 600;
const SPLASH_FADE_MS = 320;

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

function registerScreens() {
  router.register(SCREENS.HOME, renderHome);
  router.register(SCREENS.DURATION, renderDuration);
  router.register(SCREENS.CONNECTION_TYPE, renderConnectionType);
  router.register(SCREENS.PLANS, renderPlans);
  router.register(SCREENS.CHECKOUT, renderCheckout);
  router.register(SCREENS.RECEIPT_UPLOAD, renderReceiptUpload);
  router.register(SCREENS.PAYMENT_RESULT, renderPaymentResult);
  router.register(SCREENS.MY_SUBSCRIPTION, renderMySubscription);
  router.register(SCREENS.MY_PURCHASES, renderMyPurchases);
  router.register(SCREENS.ORDER_DETAIL, renderOrderDetail);
  router.register(SCREENS.WALLET, renderWallet);
  router.register(SCREENS.ACCOUNT, renderAccount);
  router.register(SCREENS.SETTINGS, renderSettings);
  router.register(SCREENS.SUPPORT, renderSupport);
  router.register(SCREENS.GUIDE, renderGuide);
  router.register(SCREENS.NOTIFICATIONS, renderNotifications);
}

function hideSplash(startedAt) {
  const splash = document.getElementById('splash');
  if (!splash) return;

  const elapsed = performance.now() - startedAt;
  const wait = Math.max(0, SPLASH_MIN_MS - elapsed);

  setTimeout(() => {
    splash.classList.add('is-hidden');
    setTimeout(() => splash.remove(), SPLASH_FADE_MS);
  }, wait);
}

function main() {
  const startedAt = performance.now();

  installErrorBoundary();

  if (telegramAvailable()) telegramReady();
  else if (isDev()) console.info('[Telegram] SDK not detected — browser mode.');

  const screenRoot = document.getElementById('screen-root');
  const navRoot = document.getElementById('bottom-nav');

  if (!screenRoot || !navRoot) {
    console.error('[app] Shell not found');
    return;
  }

  registerScreens();
  renderBottomNav(navRoot);
  router.init(screenRoot);

  logBootSignature();
  hideSplash(startedAt);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}