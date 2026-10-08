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
  void loadSubscription(root);

  return frag;
}

async function loadSubscription(root) {
  const slot = root.querySelector('[data-slot="content"]');
  slot.textContent = 'در حال دریافت اشتراک…';
  try {
    await refreshShop({ sections: ['subscription'] });
    renderContent(root);
  } catch (err) {
    const message = document.createElement('p');
    message.textContent = err?.message || 'دریافت اشتراک ناموفق بود';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'pulse-btn pulse-btn--primary';
    retry.textContent = 'تلاش مجدد';
    retry.addEventListener('click', () => loadSubscription(root));
    slot.replaceChildren(message, retry);
  }
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
<<<<<<< HEAD
    else if (action === 'copy-config') await copyConfig(trigger.closest('[data-subscription-id]'));
    else if (action === 'redownload') {
      const id = trigger.closest('[data-subscription-id]')?.dataset.subscriptionId;
      trigger.disabled = true;
      try {
        await refreshShop({ sections: ['subscription'] });
        renderContent(root);
        const card = Array.from(root.querySelectorAll('[data-subscription-id]'))
          .find((node) => node.dataset.subscriptionId === id);
        card?.scrollIntoView?.({ block: 'nearest' });
        toast('اطلاعات به‌روز شد؛ برای کپی لینک، دکمهٔ کپی را بزنید', { variant: 'success' });
      } catch (err) {
        toast(err?.message || 'دریافت اشتراک ناموفق بود', { variant: 'error' });
      } finally {
        trigger.disabled = false;
      }
    }
=======
    else if (action === 'copy-config') await copyConfig(trigger);
    else if (action === 'redownload') await redownload(root, trigger);
>>>>>>> 090e4f1517e37a75a4ba5065549ea92474ea544a
  });
}

function renderContent(root) {
  const slot = root.querySelector('[data-slot="content"]');
  slot.innerHTML = '';

<<<<<<< HEAD
  const { subscriptions = [] } = getState();

  if (!subscriptions.length) {
=======
  // Render every approved order — users can own multiple subscriptions.
  const subs = (getState().orders ?? []).filter((o) => o.status === 'approved');

  if (!subs.length) {
>>>>>>> 090e4f1517e37a75a4ba5065549ea92474ea544a
    const empty = mountTemplate(slot, 'tpl-my-sub-empty');
    fillStaticIcons(empty);
    return;
  }

<<<<<<< HEAD
  for (const sub of subscriptions) {
    // The template has two top-level sections: details AND the link.
    // Keep both inside one card so each copy action uses its own link.
    const card = document.createElement('section');
    card.dataset.subscriptionId = String(sub.id);
=======
  for (const sub of subs) {
    const card = document.createElement('div');
    card.setAttribute('data-sub-id', String(sub.id));
>>>>>>> 090e4f1517e37a75a4ba5065549ea92474ea544a
    card.appendChild(useTemplate('tpl-my-sub-active'));
    fillDetails(card, sub);
    fillStaticIcons(card);
    slot.appendChild(card);
  }
}

function fillDetails(node, sub) {
  const title = node.querySelector('.pulse-home-sub__title');
  if (title) title.textContent = `${sub.packageName || 'سرویس تخصیص‌یافته'} — سفارش #${sub.id}`;
  const chip = node.querySelector('.pulse-chip');
  if (chip) chip.textContent = sub.remainingSeconds === 0 ? 'منقضی‌شده' : 'تخصیص‌یافته';
  setText(node, 'connectionType', CONNECTION_LABEL[sub.type] || '—');
  setText(node, 'duration', sub.duration ? `${formatNumber(sub.duration)} ماهه` : sub.packageName);
  setText(node, 'expiresAt', formatDate(sub.expiresAt) || '—');

  const daysLeft = Number(sub.daysLeft) || 0;
  setText(node, 'daysLeft', sub.daysLeft == null ? '—' : `${formatNumber(daysLeft)} روز`);
  setText(node, 'configLink', sub.configLink || '—');
  const linkNode = node.querySelector('[data-bind="configLink"]');
  if (linkNode) {
    linkNode.dir = 'ltr';
    linkNode.style.userSelect = 'text';
    linkNode.style.webkitUserSelect = 'text';
    linkNode.style.overflowWrap = 'anywhere';
  }

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

<<<<<<< HEAD
async function copyConfig(root) {
  const link = root?.querySelector('[data-bind="configLink"]')?.textContent?.trim();
=======
async function copyConfig(trigger) {
  const card = trigger.closest('[data-sub-id]');
  const link = card?.querySelector('[data-bind="configLink"]')?.textContent?.trim();
>>>>>>> 090e4f1517e37a75a4ba5065549ea92474ea544a
  if (!link || link === '—') {
    toast('لینک اشتراک در دسترس نیست', { variant: 'warning' });
    return;
  }
  const ok = await copyToClipboard(link);
  toast(ok ? 'لینک اشتراک کپی شد' : 'کپی نشد', { variant: ok ? 'success' : 'error' });
}

async function redownload(root, trigger) {
  const card = trigger.closest('[data-sub-id]');
  const subId = card?.getAttribute('data-sub-id');
  try {
    await refreshShop();
    renderContent(root);
    const target = subId ? root.querySelector(`[data-sub-id="${subId}"]`) : null;
    const link = target?.querySelector('[data-bind="configLink"]')?.textContent?.trim();
    if (!link || link === '—') {
      toast('لینک اشتراک در دسترس نیست', { variant: 'warning' });
      return;
    }
    const ok = await copyToClipboard(link);
    toast(ok ? 'لینک اشتراک کپی شد' : 'کپی نشد', { variant: ok ? 'success' : 'error' });
  } catch (err) {
    toast(err.message, { variant: 'error' });
  }
}

function setText(root, key, value) {
  const el = root.querySelector(`[data-bind="${key}"]`);
  if (el) el.textContent = value;
}

function hideRow(root, key) {
  const el = root.querySelector(`[data-row="${key}"]`);
  if (el) el.hidden = true;
}
