import { APP, isDev } from './core/config.js';
import { SCREENS } from './core/constants.js';
import * as router from './core/router.js';
import { renderBottomNav } from './components/bottomNav.js';
import { renderHome } from './pages/home.js';
import { renderDuration } from './pages/duration.js';
import { renderSuggestedPlans } from './pages/suggestedPlans.js';
import { renderCustomPlan } from './pages/customPlan.js';
import { renderCheckout } from './pages/checkout.js';
import { renderPlaceholder } from './pages/placeholder.js';
import { ready as telegramReady, isAvailable as telegramAvailable } from './services/telegram.js';

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
  router.register(SCREENS.SUGGESTED_PLANS, renderSuggestedPlans);
  router.register(SCREENS.CUSTOM_PLAN, renderCustomPlan);
  router.register(SCREENS.CHECKOUT, renderCheckout);

  // Placeholders until built
  router.register(SCREENS.PAYMENT_RESULT, renderPlaceholder);
  router.register(SCREENS.MY_SUBSCRIPTION, renderPlaceholder);
  router.register(SCREENS.MY_PURCHASES, renderPlaceholder);
  router.register(SCREENS.WALLET, renderPlaceholder);
  router.register(SCREENS.ACCOUNT, renderPlaceholder);
  router.register(SCREENS.SUPPORT, renderPlaceholder);
  router.register(SCREENS.GUIDE, renderPlaceholder);
  router.register(SCREENS.NOTIFICATIONS, renderPlaceholder);
}

function main() {
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
