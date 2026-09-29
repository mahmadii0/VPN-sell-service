import { SCREENS } from '../core/constants.js';
import { getState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate, mountTemplate } from '../core/template.js';
import { formatNumber, formatPrice, formatDate, usagePercent } from '../utils/format.js';
import { iconNode } from '../components/icons.js';
import { toast } from '../components/ui.js';
import { copyToClipboard } from '../utils/dom.js';
import { refreshShop } from '../services/shop.js';

const CONNECTION_LABEL = Object.freeze({
  normal: 'عادی',
  tunnel: 'تانل',
  unlimited: 'نامحدود'
});

export function renderMySubscription() {
  const frag = useTemplate('tpl-my-subscription');
  const root = frag.firstElementChild;

  fillStaticIcons(root);
  bindActions(root);
  renderContent(root);
  refreshShop().then(() => renderContent(root)).catch((err) => toast(err.message, { variant: 'error' }));

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
  root.addEventListener('click', async (e) => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.getAttribute('data-action');

    if (action === 'back') back();
    else if (action === 'buy') navigate(SCREENS.DURATION);
    else if (action === 'copy-config') await copyConfig(root);
    else if (action === 'redownload') await refreshShop().then(() => { renderContent(root); return copyConfig(root); }).catch((err) => toast(err.message, { variant: 'error' }));
  });
}

function renderContent(root) {
  const slot = root.querySelector('[data-slot="content"]');
  slot.innerHTML = '';

  const sub = getState().currentSubscription;

  if (!sub) {
    const empty = mountTemplate(slot, 'tpl-my-sub-empty');
    fillStaticIcons(empty);
    bindActions(empty);
    return;
  }

  const node = mountTemplate(slot, 'tpl-my-sub-active');
  fillDetails(node, sub);
  fillStaticIcons(node);
  bindActions(node);
}

function fillDetails(node, sub) {
  setText(node, 'connectionType', CONNECTION_LABEL[sub.type] || '—');
  setText(node, 'duration', sub.duration ? `${formatNumber(sub.duration)} ماهه` : sub.packageName);
  setText(node, 'expiresAt', formatDate(sub.expiresAt) || '—');

  const daysLeft = Number(sub.daysLeft) || 0;
  setText(node, 'daysLeft', sub.daysLeft == null ? '—' : `${formatNumber(daysLeft)} روز`);
  setText(node, 'configLink', sub.configLink || '—');

  if (sub.unlimited || sub.totalGB == null) {
    hideRow(node, 'volumeRow');
    hideRow(node, 'usageRow');
    hideRow(node, 'progressRow');
  } else {
    const used = Number(sub.usedGB) || 0;
    const total = Number(sub.totalGB) || 0;
    const pct = usagePercent(used, total);

    setText(node, 'volume', `${formatNumber(total)} گیگابایت`);
    setText(node, 'usage', `${formatNumber(used)} گیگابایت`);

    const bar = node.querySelector('[data-bind="usageBar"]');
    if (bar) bar.style.width = `${pct}%`;
  }
}

async function copyConfig(root) {
  const link = root.querySelector('[data-bind="configLink"]')?.textContent?.trim();
  if (!link || link === '—') {
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

function hideRow(root, key) {
  const el = root.querySelector(`[data-row="${key}"]`);
  if (el) el.hidden = true;
}
