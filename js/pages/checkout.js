import { SCREENS } from '../core/constants.js';
import { getState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import { formatNumber, formatPrice } from '../utils/format.js';
import { iconNode } from '../components/icons.js';
import { toast } from '../components/ui.js';

export function renderCheckout({ params } = {}) {
  const frag = useTemplate('tpl-checkout');
  const root = frag.firstElementChild;

  const plan = params?.plan ?? getState().selectedPlan;

  if (!plan) {
    back();
    return frag;
  }

  fillStaticIcons(root);
  bindActions(root, plan);
  fillSummary(root, plan);
  fillPriceBox(root, plan);

  return frag;
}

function fillStaticIcons(root) {
  const iconMap = {
    back: 'arrowRight',
    wallet: 'wallet',
    shield: 'shield'
  };

  root.querySelectorAll('[data-icon]').forEach((slot) => {
    const raw = slot.getAttribute('data-icon');
    if (!raw) return;
    const name = iconMap[raw] || raw;
    const size = slot.closest('.pulse-icon-btn') ? 20 : 22;
    const svg = iconNode(name, { size });
    if (svg) slot.replaceWith(svg);
  });
}

function bindActions(root, plan) {
  root.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;

    const action = trigger.getAttribute('data-action');
    if (action === 'back') back();
    else if (action === 'wallet') navigate(SCREENS.WALLET);
    else if (action === 'pay') handlePay(root, plan);
  });
}

function fillSummary(root, plan) {
  const typeLabel =
    plan.type === 'custom'    ? 'پلن سفارشی' :
    plan.type === 'unlimited' ? 'پلن نامحدود' :
                                'پلن پیشنهادی';

  setText(root, 'type', typeLabel);
  setText(root, 'duration', `${formatNumber(plan.duration)} ماهه`);

  if (plan.unlimited) {
    setText(root, 'volume', 'نامحدود');
    hideRow(root, 'rateRow');
  } else {
    setText(root, 'volume', `${formatNumber(plan.volume)} گیگابایت`);

    if (plan.type === 'custom') {
      setText(root, 'rate', `${formatNumber(plan.pricePerGB)} تومان`);
      showRow(root, 'rateRow');
    } else {
      hideRow(root, 'rateRow');
    }
  }
}

function fillPriceBox(root, plan) {
  const balance = getState().walletBalance ?? 0;
  const total = plan.price;
  const canPay = balance >= total;
  const remaining = Math.max(0, total - balance);

  setText(root, 'total', formatPrice(total));
  setText(root, 'balance', formatPrice(balance));
  setText(root, 'remaining', formatPrice(canPay ? total : remaining));

  const payBtn = root.querySelector('[data-action="pay"]');
  const warning = root.querySelector('[data-slot="warning"]');
  const remainingLabel = root.querySelector('[data-bind="remainingLabel"]');

  if (canPay) {
    payBtn.disabled = false;
    if (warning) warning.hidden = true;
    if (remainingLabel) remainingLabel.textContent = 'مبلغ قابل پرداخت از کیف پول';
  } else {
    payBtn.disabled = true;
    if (warning) warning.hidden = false;
    if (remainingLabel) remainingLabel.textContent = 'کمبود موجودی';
  }
}

function handlePay(root, plan) {
  // Payment wiring will be added after Backend contract is finalized.
  toast('اتصال به درگاه پرداخت به‌زودی فعال می‌شود', { variant: 'info' });
}

function setText(root, key, value) {
  const el = root.querySelector(`[data-bind="${key}"]`);
  if (el) el.textContent = value;
}

function showRow(root, key) {
  const el = root.querySelector(`[data-row="${key}"]`);
  if (el) el.hidden = false;
}

function hideRow(root, key) {
  const el = root.querySelector(`[data-row="${key}"]`);
  if (el) el.hidden = true;
}
