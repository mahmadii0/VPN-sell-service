import { SCREENS } from '../core/constants.js';
import { getState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate, mountTemplate } from '../core/template.js';
import { formatNumber, formatPrice, formatDate } from '../utils/format.js';
import { iconNode } from '../components/icons.js';
import { toast } from '../components/ui.js';
import { copyToClipboard } from '../utils/dom.js';

const CONNECTION_LABEL = Object.freeze({
  normal: 'عادی',
  tunnel: 'تانل',
  unlimited: 'نامحدود'
});

const PAYMENT_METHOD_LABEL = Object.freeze({
  wallet: 'کیف پول',
  card_to_card: 'کارت به کارت'
});

const STATUS_MAP = Object.freeze({
  paid:      { label: 'پرداخت شده', variant: 'success' },
  pending:   { label: 'در انتظار',  variant: 'pending' },
  failed:    { label: 'ناموفق',     variant: 'error' },
  cancelled: { label: 'لغو شده',    variant: 'neutral' },
  refunded:  { label: 'بازگشت وجه', variant: 'warning' }
});

export function renderOrderDetail({ params } = {}) {
  const frag = useTemplate('tpl-order-detail');
  const root = frag.firstElementChild;

  fillStaticIcons(root);
  bindActions(root);

  const orderId = params?.orderId;
  const order = findOrder(orderId);

  const slot = root.querySelector('[data-slot="content"]');
  slot.innerHTML = '';

  if (!order) {
    const nf = mountTemplate(slot, 'tpl-order-detail-notfound');
    fillStaticIcons(nf);
    bindActions(nf);
    return frag;
  }

  const body = mountTemplate(slot, 'tpl-order-detail-body');
  fillOrder(body, order);
  fillStaticIcons(body);
  bindActions(body, order);

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

function bindActions(root, order) {
  root.addEventListener('click', async (e) => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.getAttribute('data-action');

    if (action === 'back') back();
    else if (action === 'copy-config' && order) await copyConfig(root, order);
  });
}

function findOrder(orderId) {
  const id = String(orderId ?? '');
  const orders = getState().orders ?? [];
  return orders.find((o) => String(o.id) === id) ?? null;
}

function fillOrder(root, order) {
  setText(root, 'orderId', `#${order.id}`);
  setText(root, 'date', formatDate(order.createdAt) || '—');
  setText(root, 'connectionType', CONNECTION_LABEL[order.type] || '—');
  setText(root, 'duration', `${formatNumber(order.duration)} ماهه`);
  setText(root, 'volume', order.unlimited ? 'نامحدود' : `${formatNumber(order.volume)} گیگابایت`);
  setText(root, 'price', formatPrice(order.price));

  // Status chip
  const status = STATUS_MAP[order.status] || { label: '—', variant: 'neutral' };
  const chip = root.querySelector('[data-bind="statusChip"]');
  if (chip) {
    chip.className = `pulse-chip pulse-chip--${status.variant}`;
    chip.innerHTML = `<span class="pulse-chip__dot"></span><span>${status.label}</span>`;
  }

  // Payment method
  if (order.paymentMethod) {
    setText(root, 'paymentMethod', PAYMENT_METHOD_LABEL[order.paymentMethod] || '—');
  } else {
    hideRow(root, 'methodRow');
  }

  // Config link (only for paid orders with a config)
  const hasConfig = order.status === 'paid' && order.configLink;
  if (hasConfig) {
    setText(root, 'configLink', order.configLink);
  } else {
    hideRow(root, 'configSection');
  }

  // Admin note (only for rejected / failed)
  if (order.adminNote && (order.status === 'failed' || order.status === 'cancelled')) {
    setText(root, 'adminNote', order.adminNote);
    showRow(root, 'adminNoteSection');
  }
}

async function copyConfig(root, order) {
  const link = root.querySelector('[data-bind="configLink"]')?.textContent?.trim();
  if (!link) {
    toast('لینک اشتراک در دسترس نیست', { variant: 'warning' });
    return;
  }
  const ok = await copyToClipboard(link);
  toast(ok ? 'لینک اشتراک کپی شد' : 'کپی نشد', { variant: ok ? 'success' : 'error' });
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
