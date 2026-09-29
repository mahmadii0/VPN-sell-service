import { SCREENS } from '../core/constants.js';
import { getState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate, mountTemplate } from '../core/template.js';
import { formatNumber, formatPrice, formatDate } from '../utils/format.js';
import { iconNode } from '../components/icons.js';

const CONNECTION_LABEL = Object.freeze({
  normal: 'عادی',
  tunnel: 'تانل',
  unlimited: 'نامحدود'
});

const STATUS_MAP = Object.freeze({
  paid:      { label: 'پرداخت شده', variant: 'success' },
  pending:   { label: 'در انتظار',  variant: 'pending' },
  failed:    { label: 'ناموفق',     variant: 'error' },
  cancelled: { label: 'لغو شده',    variant: 'neutral' },
  refunded:  { label: 'بازگشت وجه', variant: 'warning' }
});

export function renderMyPurchases() {
  const frag = useTemplate('tpl-my-purchases');
  const root = frag.firstElementChild;

  fillStaticIcons(root);
  bindActions(root);
  renderContent(root);

  return frag;
}

function fillStaticIcons(root) {
  const iconMap = { back: 'arrowRight' };
  root.querySelectorAll('[data-icon]').forEach((slot) => {
    const raw = slot.getAttribute('data-icon');
    if (!raw) return;
    const name = iconMap[raw] || raw;
    const size = slot.closest('.pulse-icon-btn') ? 20 : 18;
    const svg = iconNode(name, { size });
    if (svg) slot.replaceWith(svg);
  });
}

function bindActions(root) {
  root.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.getAttribute('data-action');
    if (action === 'back') back();
    else if (action === 'buy') navigate(SCREENS.DURATION);
  });
}

function renderContent(root) {
  const slot = root.querySelector('[data-slot="content"]');
  slot.innerHTML = '';

  const orders = getState().orders ?? [];

  if (!orders.length) {
    const empty = mountTemplate(slot, 'tpl-purchases-empty');
    fillStaticIcons(empty);
    bindActions(empty);
    return;
  }

  const wrapper = mountTemplate(slot, 'tpl-purchases-list');
  renderOrders(wrapper, orders);
}

function renderOrders(wrapper, orders) {
  const listSlot = wrapper.querySelector('[data-slot="orders"]');
  const frag = document.createDocumentFragment();

  for (const order of orders) {
    const tpl = useTemplate('tpl-order-card');
    const node = tpl.firstElementChild;

    node.dataset.orderId = order.id;

    setText(node, 'orderId', `#${order.id}`);
    setText(node, 'volume', order.unlimited
      ? 'نامحدود'
      : `${formatNumber(order.volume)} گیگابایت`);

    const meta = `${formatNumber(order.duration)} ماهه / ${CONNECTION_LABEL[order.type] || ''}`;
    setText(node, 'meta', meta);
    setText(node, 'date', formatDate(order.createdAt) || '—');
    setText(node, 'price', formatPrice(order.price));

    const status = STATUS_MAP[order.status] || { label: '—', variant: 'neutral' };
    const chip = node.querySelector('[data-bind="statusChip"]');
    chip.className = `pulse-chip pulse-chip--${status.variant}`;
    chip.innerHTML = `<span class="pulse-chip__dot"></span><span>${status.label}</span>`;

    node.addEventListener('click', () => openOrder(order));
    frag.appendChild(node);
  }

  listSlot.appendChild(frag);
}

function openOrder(order) {
  console.log('[order] tapped:', order.id);
}

function setText(root, key, value) {
  const el = root.querySelector(`[data-bind="${key}"]`);
  if (el) el.textContent = value;
}
