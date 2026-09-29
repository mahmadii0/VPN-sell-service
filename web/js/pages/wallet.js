import { SCREENS } from '../core/constants.js';
import { getState } from '../state/store.js';
import { back } from '../core/router.js';
import { useTemplate, mountTemplate } from '../core/template.js';
import { formatPrice, formatDate } from '../utils/format.js';
import { iconNode } from '../components/icons.js';
import { toast } from '../components/ui.js';
import { renderWithSkeleton } from '../utils/async.js';
import { listSkeleton } from '../components/skeletons.js';
import * as haptic from '../utils/haptic.js';
import { refreshShop } from '../services/shop.js';

const TX_ICON = {
  charge: 'plus',
  purchase: 'cart',
  refund: 'refresh'
};

export function renderWallet() {
  const frag = useTemplate('tpl-wallet');
  const root = frag.firstElementChild;

  fillStaticIcons(root);
  bindActions(root);
  fillBalance(root);
  mountTransactions(root);

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
    else if (action === 'charge') {
      haptic.tap();
      toast('شارژ کیف پول به‌زودی فعال می‌شود', { variant: 'info' });
    }
  });
}

function fillBalance(root) {
  const el = root.querySelector('[data-bind="balance"]');
  if (el) el.textContent = formatPrice(getState().walletBalance ?? 0);
}

function mountTransactions(root) {
  const slot = root.querySelector('[data-slot="content"]');

  renderWithSkeleton({
    screenId: 'wallet-transactions',
    container: slot,
    skeleton: listSkeleton(3),
    load: async () => (await refreshShop()).walletTransactions ?? [],
    render: (txs) => buildTransactionsView(txs)
  });
}

function buildTransactionsView(txs) {
  if (!txs || !txs.length) {
    const wrap = document.createElement('div');
    const empty = mountTemplate(wrap, 'tpl-wallet-empty');
    fillStaticIcons(empty);
    return empty.parentElement || empty;
  }

  const wrap = document.createElement('div');
  const list = mountTemplate(wrap, 'tpl-wallet-tx-list');
  const listSlot = list.querySelector('[data-slot="transactions"]');
  const frag = document.createDocumentFragment();

  for (const tx of txs) {
    const tpl = useTemplate('tpl-wallet-tx-item');
    const node = tpl.firstElementChild;

    const iconSlot = node.querySelector('[data-icon]');
    if (iconSlot) {
      const svg = iconNode(TX_ICON[tx.type] || 'wallet', { size: 20 });
      if (svg) iconSlot.replaceWith(svg);
    }

    setText(node, 'title', tx.title || '—');
    setText(node, 'date', formatDate(tx.date) || '—');

    const amountEl = node.querySelector('[data-bind="amount"]');
    const positive = tx.type === 'charge' || tx.type === 'refund';
    amountEl.textContent = `${positive ? '+' : '−'} ${formatPrice(Math.abs(tx.amount || 0))}`;
    amountEl.classList.toggle('is-positive', positive);
    amountEl.classList.toggle('is-negative', !positive);

    frag.appendChild(node);
  }

  listSlot.appendChild(frag);
  return list;
}

function setText(root, key, value) {
  const el = root.querySelector(`[data-bind="${key}"]`);
  if (el) el.textContent = value;
}
