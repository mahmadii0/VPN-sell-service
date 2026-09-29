import { SCREENS } from '../core/constants.js';
import { getState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import { formatNumber, formatPrice } from '../utils/format.js';
import { iconNode } from '../components/icons.js';
import { toast } from '../components/ui.js';

const TYPE_LABEL = Object.freeze({
  normal: 'عادی',
  tunnel: 'تانل',
  unlimited: 'نامحدود'
});

export function renderCheckout({ params } = {}) {
  const frag = useTemplate('tpl-checkout');
  const root = frag.firstElementChild;

  const plan = params?.plan ?? getState().selectedPlan;
  if (!plan) { back(); return frag; }

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
    else if (action === 'pay') handlePay(plan);
  });
}

function fillSummary(root, plan) {
  setText(root, 'type', TYPE_LABEL[plan.type] || '—');
  setText(root, 'duration', `${formatNumber(plan.duration)} ماهه`);
  setText(root, 'volume', plan.unlimited ? 'نامحدود' : `${formatNumber(plan.volume)} گیگابایت`);
}

function fillPriceBox(root, plan) {
  const balance = getState().walletBalance ?? 0;
  const total = plan.price;
  const canPay = balance >= total;
  const remaining = canPay ? total : Math.max(0, total - balance);

  setText(root, 'total', formatPrice(total));
  setText(root, 'balance', formatPrice(balance));
  setText(root, 'remaining', formatPrice(remaining));

  const payBtn = root.querySelector('[data-action="pay"]');
  const warning = root.querySelector('[data-slot="warning"]');
  const remainingLabel = root.querySelector('[data-bind="remainingLabel"]');

  if (canPay) {
    if (payBtn) payBtn.disabled = false;
    if (warning) warning.hidden = true;
    if (remainingLabel) remainingLabel.textContent = 'مبلغ قابل پرداخت';
  } else {
    if (payBtn) payBtn.disabled = true;
    if (warning) warning.hidden = false;
    if (remainingLabel) remainingLabel.textContent = 'کمبود موجودی';
  }
}

function handlePay(plan) {
  // Real payment wiring arrives in the next commit (card-to-card + receipt).
  toast('اتصال به درگاه پرداخت به‌زودی فعال می‌شود', { variant: 'info' });
}

function setText(root, key, value) {
  const el = root.querySelector(`[data-bind="${key}"]`);
  if (el) el.textContent = value;
}
