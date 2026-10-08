import { SCREENS } from '../core/constants.js';
import { getState, subscribe } from '../state/store.js';
import { navigate } from '../core/router.js';
import { useTemplate, mountTemplate } from '../core/template.js';
import { formatPrice, formatNumber, usagePercent } from '../utils/format.js';
import { iconNode } from '../components/icons.js';

const QUICK_ACTIONS = [
  { icon: 'shield',   label: 'اشتراک من',  screen: SCREENS.MY_SUBSCRIPTION },
  { icon: 'package',  label: 'خریدهای من', screen: SCREENS.MY_PURCHASES },
  { icon: 'wallet',   label: 'کیف پول',    screen: SCREENS.WALLET },
  { icon: 'lifeBuoy', label: 'پشتیبانی',   screen: SCREENS.SUPPORT }
];

export function renderHome() {
  const frag = useTemplate('tpl-home');
  const root = frag.firstElementChild;

  fillIcons(root);
  bindActions(root);
  renderDynamic(root);
  syncNotificationBadge(root);

  const unsubscribe = subscribe(() => {
    renderDynamic(root);
    syncNotificationBadge(root);
  });

  return {
    node: frag,
    cleanup: unsubscribe
  };
}

function fillIcons(root) {
  root.querySelectorAll('[data-icon]').forEach((node) => {
    const name = node.getAttribute('data-icon');
    if (!name) return;
    const size = node.classList.contains('pulse-wallet-card__icon') ? 22 : 18;
    const svg = iconNode(name, { size });
    if (svg) node.replaceWith(svg);
  });
}

function bindActions(root) {
  root.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;

    const action = trigger.getAttribute('data-action');
    const map = {
      notifications: () => navigate(SCREENS.NOTIFICATIONS),
      account:       () => navigate(SCREENS.ACCOUNT),
      wallet:        () => navigate(SCREENS.WALLET),
      buy:           () => navigate(SCREENS.DURATION)
    };

    map[action]?.();
  });
}

function renderDynamic(root) {
  const { currentUser, walletBalance, currentSubscription } = getState();

  setAvatarInitial(root, currentUser);
  setWalletBalance(root, walletBalance);
  renderSubscription(root, currentSubscription);
  renderQuickActions(root);
}

function syncNotificationBadge(root) {
  const { notifications = [] } = getState();
  const hasUnread = notifications.some((n) => !n.read);
  const btn = root.querySelector('[data-action="notifications"]');
  if (!btn) return;

  const existing = btn.querySelector('.pulse-icon-btn__badge');
  if (hasUnread && !existing) {
    const badge = document.createElement('span');
    badge.className = 'pulse-icon-btn__badge';
    btn.appendChild(badge);
  } else if (!hasUnread && existing) {
    existing.remove();
  }
}

function setAvatarInitial(root, user) {
  const target = root.querySelector('[data-bind="avatarInitial"]');
  if (target) target.textContent = (user?.firstName?.[0] || 'پ').toUpperCase();
}

function setWalletBalance(root, balance) {
  const target = root.querySelector('[data-bind="walletBalance"]');
  if (target) target.textContent = formatPrice(balance || 0);
}

function renderSubscription(root, sub) {
  const slot = root.querySelector('[data-slot="subscription"]');
  if (!slot) return;

  if (!sub) {
    const empty = mountTemplate(slot, 'tpl-home-sub-empty');
    fillIcons(empty);
    bindActions(empty);
    return;
  }

  const node = mountTemplate(slot, 'tpl-home-sub-active');
  const used = Number(sub.usedGB) || 0;
  const total = Number(sub.totalGB) || 0;
  const daysLeft = Number(sub.daysLeft) || 0;
  const pct = usagePercent(used, total);

  node.querySelector('[data-bind="usage"]').textContent =
      sub.totalGB == null ? 'میزان مصرف در دسترس نیست' : `${formatNumber(used)} از ${formatNumber(total)} گیگابایت`;
  node.querySelector('[data-bind="usageBar"]').style.width = `${sub.totalGB == null ? 0 : pct}%`;
  node.querySelector('[data-bind="daysLeft"]').textContent = sub.daysLeft == null ? '—' : `${formatNumber(daysLeft)} روز`;
}

function renderQuickActions(root) {
  const slot = root.querySelector('[data-slot="quickActions"]');
  if (!slot) return;
  slot.innerHTML = '';

  const frag = document.createDocumentFragment();

  for (const item of QUICK_ACTIONS) {
    const tpl = useTemplate('tpl-quick-action');
    const node = tpl.firstElementChild;

    const iconSlot = node.querySelector('[data-icon]');
    const iconSvg = iconNode(item.icon, { size: 18 });
    if (iconSvg) iconSlot.replaceWith(iconSvg);

    node.querySelector('[data-label]').textContent = item.label;
    node.setAttribute('aria-label', item.label);
    node.addEventListener('click', () => navigate(item.screen));

    frag.appendChild(node);
  }

  slot.appendChild(frag);
}
