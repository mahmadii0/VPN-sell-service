import { SCREENS } from '../core/constants.js';
import { getState } from '../state/store.js';
import { navigate, reset, back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import { formatPrice } from '../utils/format.js';
import { iconNode } from '../components/icons.js';
import { get } from '../api/client.js';
import { ENDPOINTS, resolvePath } from '../api/endpoints.js';
import { refreshShop } from '../services/shop.js';

const POLL_INTERVAL = 8000;

let pollTimer = null;
let activeRoot = null;

export function renderPaymentResult({ params } = {}) {
  const frag = useTemplate('tpl-payment-result');
  const root = frag.firstElementChild;

  activeRoot = root;

  const paymentId = params?.paymentId ?? getState().paymentResult?.paymentId;

  fillInitialIcons(root);
  bindActions(root);

  if (paymentId) {
    pollStatus(root, paymentId);
  } else {
    showState(root, 'unknown', {});
  }

  return {
    node: frag,
    cleanup: () => {
      stopPolling();
      activeRoot = null;
    }
  };
}

function fillInitialIcons(root) {
  const slot = root.querySelector('[data-icon="clock"]');
  if (slot) {
    const svg = iconNode('clock', { size: 48 });
    if (svg) slot.replaceWith(svg);
  }
}

function bindActions(root) {
  root.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.getAttribute('data-action');
    if (action === 'home') reset(SCREENS.HOME);
    else if (action === 'support') navigate(SCREENS.SUPPORT);
    else if (action === 'subscription') reset(SCREENS.MY_SUBSCRIPTION);
    else if (action === 'retry') back();
  });
}

async function pollStatus(root, paymentId) {
  stopPolling();

  const finished = await fetchStatus(root, paymentId);
  if (finished) return;

  pollTimer = setInterval(async () => {
    const done = await fetchStatus(activeRoot ?? root, paymentId);
    if (done) stopPolling();
  }, POLL_INTERVAL);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function fetchStatus(root, paymentId) {
  try {
    const path = resolvePath(ENDPOINTS.ORDER_DETAIL.path, { id: paymentId });
    const res = await get(path);
    const status = res.status === 'pending' ? 'waiting_admin_approval' : res.status;
    if (res.status !== 'pending') await refreshShop();
    const finished = ['approved', 'rejected', 'cancelled'].includes(status);
    showState(root, status, { ...res, amount: res.price_toman });
    return finished;
  } catch (err) {
    console.warn('[payment-result] poll failed:', err);
    return false;
  }
}

function showState(root, status, data) {
  const map = {
    waiting_admin_approval: {
      variant: 'pending',
      icon: 'clock',
      title: 'در انتظار تایید',
      text: 'رسید شما دریافت شد. پس از تایید توسط ادمین، کانفیگ شما فعال می‌شود.',
      primary: null
    },
    approved: {
      variant: 'success',
      icon: 'checkCircle',
      title: 'پرداخت تایید شد',
      text: 'پرداخت تایید شد. پس از اختصاص سرویس توسط ادمین، لینک اشتراک در دسترس خواهد بود.',
      primary: { label: 'مشاهده اشتراک', action: 'subscription' }
    },
    rejected: {
      variant: 'error',
      icon: 'xCircle',
      title: 'رسید تایید نشد',
      text: data.admin_note || 'رسید ارسالی تایید نشد. لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.',
      primary: { label: 'تماس با پشتیبانی', action: 'support' }
    },
    cancelled: {
      variant: 'warning',
      icon: 'alertCircle',
      title: 'پرداخت لغو شد',
      text: 'این تراکنش لغو شده است.',
      primary: { label: 'بازگشت به خانه', action: 'home' }
    },
    unknown: {
      variant: 'neutral',
      icon: 'alertCircle',
      title: 'وضعیت نامشخص',
      text: 'امکان دریافت وضعیت پرداخت وجود ندارد.',
      primary: { label: 'بازگشت به خانه', action: 'home' }
    }
  };

  const cfg = map[status] || map.unknown;

  const card = root.querySelector('[data-slot="card"]');
  card.className = `pulse-result pulse-result--${cfg.variant}`;

  const iconSlot = card.querySelector('[data-slot="icon"]');
  if (iconSlot) {
    const svg = iconNode(cfg.icon, { size: 48 });
    if (svg) iconSlot.replaceWith(svg);
  }

  card.querySelector('[data-bind="title"]').textContent = cfg.title;
  card.querySelector('[data-bind="text"]').textContent = cfg.text;

  const detailSlot = card.querySelector('[data-slot="detail"]');
  if (detailSlot) {
    detailSlot.innerHTML = '';
    if (data.amount) {
      const row = document.createElement('div');
      row.className = 'pulse-result__amount';
      row.textContent = formatPrice(data.amount);
      detailSlot.appendChild(row);
    }
  }

  const actions = root.querySelector('[data-slot="actions"]');
  actions.innerHTML = '';
  if (cfg.primary) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pulse-btn pulse-btn--primary pulse-btn--lg pulse-btn--block';
    btn.textContent = cfg.primary.label;
    btn.dataset.action = cfg.primary.action;
    actions.appendChild(btn);
  }
}
