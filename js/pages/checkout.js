import { SCREENS, CARD_ACCOUNTS, PAYMENT_METHOD } from '../core/constants.js';
import { getState, setState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import { formatNumber, formatPrice } from '../utils/format.js';
import { iconNode } from '../components/icons.js';
import { toast } from '../components/ui.js';
import { copyToClipboard } from '../utils/dom.js';

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
  fillSummary(root, plan);
  fillPriceBox(root, plan);
  renderCards(root);
  syncMethodUI(root, getState().paymentMethod ?? PAYMENT_METHOD.CARD_TO_CARD);
  bindActions(root, plan);

  return frag;
}

function fillStaticIcons(root) {
  const iconMap = { back: 'arrowRight' };
  root.querySelectorAll('[data-icon]').forEach((slot) => {
    const raw = slot.getAttribute('data-icon');
    if (!raw) return;
    const name = iconMap[raw] || raw;
    const size = slot.closest('.pulse-icon-btn') ? 20 : 20;
    const svg = iconNode(name, { size });
    if (svg) slot.replaceWith(svg);
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
  const canPayWithWallet = balance >= total;

  setText(root, 'total', formatPrice(total));
  setText(root, 'balance', formatPrice(balance));

  const remaining = canPayWithWallet ? total : Math.max(0, total - balance);
  setText(root, 'remaining', formatPrice(remaining));

  const remainingLabel = root.querySelector('[data-bind="remainingLabel"]');
  if (remainingLabel) {
    remainingLabel.textContent = canPayWithWallet ? 'مبلغ قابل پرداخت' : 'کمبود موجودی';
  }

  const walletOption = root.querySelector('[data-method="wallet"]');
  if (walletOption && !canPayWithWallet) {
    walletOption.classList.add('is-disabled');
    walletOption.setAttribute('aria-disabled', 'true');
  }

  root.dataset.walletAvailable = canPayWithWallet ? '1' : '0';
}

function renderCards(root) {
  const slot = root.querySelector('[data-slot="cards"]');
  if (!slot) return;

  const frag = document.createDocumentFragment();

  for (const card of CARD_ACCOUNTS) {
    const tpl = useTemplate('tpl-card-account');
    const node = tpl.firstElementChild;

    node.dataset.cardId = String(card.id);
    node.querySelector('[data-bind="holder"]').textContent = card.holder;
    const numberEl = node.querySelector('[data-bind="number"]');
    numberEl.textContent = card.number;
    numberEl.dataset.raw = card.numberRaw;

    const iconSlot = node.querySelector('[data-icon]');
    if (iconSlot) {
      const svg = iconNode('copy', { size: 18 });
      if (svg) iconSlot.replaceWith(svg);
    }

    frag.appendChild(node);
  }

  slot.appendChild(frag);
}

function bindActions(root, plan) {
  root.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('[data-action="copy-card"]');
    if (copyBtn) {
      const cardEl = copyBtn.closest('[data-card-id]');
      const raw = cardEl?.querySelector('[data-bind="number"]')?.dataset.raw;
      if (!raw) return;
      const ok = await copyToClipboard(raw);
      toast(ok ? 'شماره کارت کپی شد' : 'کپی نشد — دستی یادداشت کنید', {
        variant: ok ? 'success' : 'error'
      });
      return;
    }

    const methodBtn = e.target.closest('[data-method]');
    if (methodBtn) {
      const method = methodBtn.dataset.method;
      const walletAvailable = root.dataset.walletAvailable === '1';
      if (method === PAYMENT_METHOD.WALLET && !walletAvailable) {
        toast('موجودی کیف پول کافی نیست', { variant: 'warning' });
        return;
      }
      setState({ paymentMethod: method });
      syncMethodUI(root, method);
      syncCardsVisibility(root, method);
      return;
    }

    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.getAttribute('data-action');
    if (action === 'back') back();
    else if (action === 'wallet') navigate(SCREENS.WALLET);
    else if (action === 'pay') handlePay(root, plan);
  });
}

function syncMethodUI(root, method) {
  root.querySelectorAll('[data-method]').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.method === method);
  });
  syncCardsVisibility(root, method);
}

function syncCardsVisibility(root, method) {
  const section = root.querySelector('[data-slot="cards-section"]');
  if (section) section.hidden = method !== PAYMENT_METHOD.CARD_TO_CARD;

  const payLabel = root.querySelector('[data-bind="payLabel"]');
  if (payLabel) {
    payLabel.textContent = method === PAYMENT_METHOD.WALLET
      ? 'پرداخت از کیف پول'
      : 'ادامه و ارسال رسید';
  }
}

function handlePay(root, plan) {
  const method = getState().paymentMethod ?? PAYMENT_METHOD.CARD_TO_CARD;

  if (method === PAYMENT_METHOD.WALLET) {
    toast('اتصال به درگاه کیف پول به‌زودی فعال می‌شود', { variant: 'info' });
    return;
  }

  setState({ selectedPlan: plan, paymentMethod: PAYMENT_METHOD.CARD_TO_CARD });
  navigate(SCREENS.RECEIPT_UPLOAD, { plan });
}

function setText(root, key, value) {
  const el = root.querySelector(`[data-bind="${key}"]`);
  if (el) el.textContent = value;
}
