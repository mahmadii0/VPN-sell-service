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

export function renderPaymentResult({ params } = {}) {
  const frag = useTemplate('tpl-payment-result');
  const root = frag.firstElementChild;

  const paymentId =
      params?.paymentId ?? getState().paymentResult?.paymentId;

  let disposed = false;
  let pollTimer = null;

  bindActions(root);
  showState(root, 'checking', {});

  async function pollStatus() {
    if (disposed) return;

    let finished = false;

    try {
      const path = resolvePath(
          ENDPOINTS.ORDER_DETAIL.path,
          { id: paymentId }
      );

      const res = await get(path);
      if (disposed) return;

      if (
          !res ||
          String(res.id) !== String(paymentId) ||
          !['pending', 'approved', 'rejected', 'cancelled'].includes(
              res.status
          )
      ) {
        throw new Error('Invalid order status response');
      }

      const status = res.status === 'pending'
          ? 'waiting_admin_approval'
          : res.status;

      showState(root, status, {
        ...res,
        amount: res.price_toman
      });

      finished = res.status !== 'pending';

      if (finished) {
        void refreshShop().catch((err) => {
          console.warn('[payment-result] refresh failed:', err);
        });
      }
    } catch (err) {
      if (disposed) return;

      console.warn('[payment-result] poll failed:', err);

      showState(
          root,
          err.status === 404 ? 'missing' : 'unknown',
          {}
      );

      finished = [401, 403, 404].includes(err.status);
    }

    if (!disposed && !finished) {
      pollTimer = setTimeout(pollStatus, POLL_INTERVAL);
    }
  }

  if (paymentId) {
    void pollStatus();
  } else {
    showState(root, 'unknown', {});
  }

  return {
    node: frag,
    cleanup: () => {
      disposed = true;

      if (pollTimer !== null) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    }
  };
}

function bindActions(root) {
  root.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;

    const action = trigger.getAttribute('data-action');

    if (action === 'home') reset(SCREENS.HOME);
    else if (action === 'support') navigate(SCREENS.SUPPORT);
    else if (action === 'subscription') {
      reset(SCREENS.MY_SUBSCRIPTION);
    } else if (action === 'retry') {
      back();
    }
  });
}

function showState(root, status, data) {
  const map = {
    checking: {
      variant: 'neutral',
      icon: 'clock',
      title: 'در حال بررسی سفارش',
      text: 'وضعیت ثبت رسید از سرور دریافت می‌شود.',
      primary: null
    },
    missing: {
      variant: 'error',
      icon: 'alertCircle',
      title: 'سفارش پیدا نشد',
      text:
          'این سفارش در سرور فعلی پیدا نشد. قبل از ارسال مجدد با پشتیبانی تماس بگیرید.',
      primary: {
        label: 'تماس با پشتیبانی',
        action: 'support'
      }
    },
    waiting_admin_approval: {
      variant: 'pending',
      icon: 'clock',
      title: 'در انتظار تایید',
      text:
          'رسید شما دریافت شد. پس از تایید توسط ادمین، کانفیگ شما فعال می‌شود.',
      primary: null
    },
    approved: {
      variant: 'success',
      icon: 'checkCircle',
      title: 'پرداخت تایید شد',
      text:
          'پرداخت تایید شد. پس از اختصاص سرویس توسط ادمین، لینک اشتراک در دسترس خواهد بود.',
      primary: {
        label: 'مشاهده اشتراک',
        action: 'subscription'
      }
    },
    rejected: {
      variant: 'error',
      icon: 'xCircle',
      title: 'رسید تایید نشد',
      text: data.admin_note ||
          'رسید ارسالی تایید نشد. لطفاً با پشتیبانی تماس بگیرید.',
      primary: {
        label: 'تماس با پشتیبانی',
        action: 'support'
      }
    },
    cancelled: {
      variant: 'warning',
      icon: 'alertCircle',
      title: 'پرداخت لغو شد',
      text: 'این تراکنش لغو شده است.',
      primary: {
        label: 'بازگشت به خانه',
        action: 'home'
      }
    },
    unknown: {
      variant: 'neutral',
      icon: 'alertCircle',
      title: 'وضعیت نامشخص',
      text:
          'امکان تأیید وضعیت سفارش از سرور وجود ندارد. قبل از ارسال مجدد رسید با پشتیبانی بررسی کنید.',
      primary: {
        label: 'تماس با پشتیبانی',
        action: 'support'
      }
    }
  };

  const cfg = map[status] || map.unknown;
  const card = root.querySelector('[data-slot="card"]');

  card.className = `pulse-result pulse-result--${cfg.variant}`;

  const iconSlot = card.querySelector('[data-slot="icon"]');

  if (iconSlot) {
    const svg = iconNode(cfg.icon, { size: 48 });

    if (svg) {
      svg.setAttribute('data-slot', 'icon');
      iconSlot.replaceWith(svg);
    }
  }

  card.querySelector('[data-bind="title"]').textContent = cfg.title;
  card.querySelector('[data-bind="text"]').textContent = cfg.text;

  const detailSlot = card.querySelector('[data-slot="detail"]');

  if (detailSlot) {
    detailSlot.innerHTML = '';

    if (data.id) {
      const orderRow = document.createElement('div');
      orderRow.textContent = `شماره سفارش: ${data.id}`;
      detailSlot.appendChild(orderRow);
    }

    if (data.amount != null) {
      const amountRow = document.createElement('div');
      amountRow.className = 'pulse-result__amount';
      amountRow.textContent = formatPrice(data.amount);
      detailSlot.appendChild(amountRow);
    }
  }

  const actions = root.querySelector('[data-slot="actions"]');
  actions.innerHTML = '';

  if (cfg.primary) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
        'pulse-btn pulse-btn--primary pulse-btn--lg pulse-btn--block';
    btn.textContent = cfg.primary.label;
    btn.dataset.action = cfg.primary.action;
    actions.appendChild(btn);
  }
}
