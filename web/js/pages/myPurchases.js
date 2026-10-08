import { SCREENS } from '../core/constants.js';
import { getState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate, mountTemplate } from '../core/template.js';
import { formatNumber, formatPrice, formatDate } from '../utils/format.js';
import { iconNode } from '../components/icons.js';
import { renderWithSkeleton } from '../utils/async.js';
import { listSkeleton } from '../components/skeletons.js';
import * as haptic from '../utils/haptic.js';
import { refreshShop } from '../services/shop.js';

const CONNECTION_LABEL = Object.freeze({
  normal: 'عادی',
  tunnel: 'تانل',
  unlimited: 'نامحدود'
});

const STATUS_MAP = Object.freeze({
  paid:      { label: 'پرداخت شده', variant: 'success' },
  approved:  { label: 'تایید شده', variant: 'success' },
  rejected:  { label: 'رد شده', variant: 'error' },
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
  mountOrders(root);

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

function mountOrders(root) {
  const slot = root.querySelector('[data-slot="content"]');

  renderWithSkeleton({
    screenId: 'my-purchases',
    container: slot,
    skeleton: listSkeleton(3),
    load: async () => (
        await refreshShop({ sections: ['orders'] })
    ).orders ?? [],
    render: (orders) => buildOrdersView(orders)
  });
}

function buildOrdersView(orders) {
  if (!orders || !orders.length) {
    const wrap = document.createElement('div');
    const empty = mountTemplate(wrap, 'tpl-purchases-empty');
    fillStaticIcons(empty);
    bindActions(empty);
    return empty.parentElement || empty;
  }

  const wrap = document.createElement('div');
  const list = mountTemplate(wrap, 'tpl-purchases-list');
  const listSlot = list.querySelector('[data-slot="orders"]');
  const frag = document.createDocumentFragment();

  for (const order of orders) {
    const tpl = useTemplate('tpl-order-card');
    const node = tpl.firstElementChild;

    node.dataset.orderId = order.id;

    setText(node, 'orderId', `#${order.id}`);
    setText(node, 'volume', order.unlimited
        ? 'نامحدود'
        : order.volume == null ? order.packageName : `${formatNumber(order.volume)} گیگابایت`);

    const meta = order.duration
        ? `${formatNumber(order.duration)} ماهه / ${CONNECTION_LABEL[order.type] || ''}`
        : order.packageName;
    setText(node, 'meta', meta);
    setText(node, 'date', formatDate(order.createdAt) || '—');
    setText(node, 'price', formatPrice(order.price));

    const status = STATUS_MAP[order.status] || { label: '—', variant: 'neutral' };
    const chip = node.querySelector('[data-bind="statusChip"]');
    chip.className = `pulse-chip pulse-chip--${status.variant}`;
    chip.innerHTML = `<span class="pulse-chip__dot"></span><span>${status.label}</span>`;

    node.addEventListener('click', () => {
      haptic.tap();
      navigate(SCREENS.ORDER_DETAIL, { orderId: order.id });
    });

    frag.appendChild(node);
  }

  listSlot.appendChild(frag);
  return list;
}

function setText(root, key, value) {
  const el = root.querySelector(`[data-bind="${key}"]`);
  if (el) el.textContent = value;
}
