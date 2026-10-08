import { SCREENS } from '../core/constants.js';
import { getState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import { formatPrice, formatNumber } from '../utils/format.js';
import { iconNode } from '../components/icons.js';

const CONNECTION_LABEL = { normal: 'عادی', tunnel: 'تانل', unlimited: 'نامحدود' };

export function renderAccount() {
  const frag = useTemplate('tpl-account');
  const root = frag.firstElementChild;

  fillStaticIcons(root);
  bindActions(root);
  fillProfile(root);

  return frag;
}

function fillStaticIcons(root) {
  const iconMap = { back: 'arrowRight' };
  root.querySelectorAll('[data-icon]').forEach((slot) => {
    const raw = slot.getAttribute('data-icon');
    if (!raw) return;
    const name = iconMap[raw] || raw;
    const size = slot.closest('.pulse-icon-btn') || slot.classList.contains('pulse-menu-item__icon') ? 20 : 18;
    const svg = iconNode(name, { size });
    if (svg) slot.replaceWith(svg);
  });
}

function bindActions(root) {
  root.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.getAttribute('data-action');
    const map = {
      back: () => back(),
      subscription: () => navigate(SCREENS.MY_SUBSCRIPTION),
      purchases: () => navigate(SCREENS.MY_PURCHASES),
      wallet: () => navigate(SCREENS.WALLET),
      guide: () => navigate(SCREENS.GUIDE),
      support: () => navigate(SCREENS.SUPPORT)
    };
    map[action]?.();
  });
}

function fillProfile(root) {
  const { currentUser, walletBalance, currentSubscription, orders } = getState();

  const initial = (currentUser?.firstName?.[0] || 'پ').toUpperCase();
  setText(root, 'avatarInitial', initial);
  setText(root, 'displayName', buildName(currentUser) || 'کاربر PULSE');
  setText(root, 'username', currentUser?.username ? `@${currentUser.username}` : '');

  setText(root, 'balance', formatPrice(walletBalance ?? 0));
  setText(root, 'subscriptionLabel', currentSubscription
      ? `${CONNECTION_LABEL[currentSubscription.type] || ''} — ${formatNumber(currentSubscription.duration)} ماهه`
      : 'ندارد');
  setText(root, 'ordersCount', formatNumber((orders ?? []).length));
}

function buildName(user) {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

function setText(root, key, value) {
  const el = root.querySelector(`[data-bind="${key}"]`);
  if (el) el.textContent = value;
}
