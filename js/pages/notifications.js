import { SCREENS } from '../core/constants.js';
import { getState, setState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate, mountTemplate } from '../core/template.js';
import { formatDate } from '../utils/format.js';
import { iconNode } from '../components/icons.js';
import { renderWithSkeleton } from '../utils/async.js';
import { listSkeleton } from '../components/skeletons.js';
import * as haptic from '../utils/haptic.js';

const TYPE_ICON = {
  payment: 'creditCard',
  subscription: 'shield',
  info: 'info',
  warning: 'alertCircle'
};

export function renderNotifications() {
  const frag = useTemplate('tpl-notifications');
  const root = frag.firstElementChild;

  fillStaticIcons(root);
  bindActions(root);
  mountNotifications(root);

  return frag;
}

function fillStaticIcons(root) {
  const iconMap = { back: 'arrowRight' };
  root.querySelectorAll('[data-icon]').forEach((slot) => {
    const raw = slot.getAttribute('data-icon');
    if (!raw) return;
    const name = iconMap[raw] || raw;
    const svg = iconNode(name, { size: 20 });
    if (svg) slot.replaceWith(svg);
  });
}

function bindActions(root) {
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="back"]')) back();
  });
}

function mountNotifications(root) {
  const slot = root.querySelector('[data-slot="content"]');

  renderWithSkeleton({
    screenId: 'notifications',
    container: slot,
    skeleton: listSkeleton(3),
    load: async () => {
      const list = getState().notifications ?? [];
      // Mark all as read on open
      if (list.some((n) => !n.read)) {
        const updated = list.map((n) => ({ ...n, read: true }));
        setState({ notifications: updated });
      }
      return list;
    },
    render: (items) => buildNotificationsView(items)
  });
}

function buildNotificationsView(items) {
  if (!items || !items.length) {
    const wrap = document.createElement('div');
    const empty = mountTemplate(wrap, 'tpl-notifications-empty');
    fillStaticIcons(empty);
    return empty.parentElement || empty;
  }

  const wrap = document.createElement('div');
  const list = mountTemplate(wrap, 'tpl-notifications-list');
  const listSlot = list.querySelector('[data-slot="items"]');
  const frag = document.createDocumentFragment();

  for (const notif of items) {
    const tpl = useTemplate('tpl-notification-item');
    const node = tpl.firstElementChild;

    const iconSlot = node.querySelector('[data-icon]');
    if (iconSlot) {
      const svg = iconNode(TYPE_ICON[notif.type] || 'bell', { size: 20 });
      if (svg) iconSlot.replaceWith(svg);
    }

    setText(node, 'title', notif.title || '');
    setText(node, 'text', notif.text || '');
    setText(node, 'date', formatDate(notif.date) || '');

    const target = resolveTarget(notif);
    if (target) {
      node.classList.add('is-clickable');
      node.setAttribute('role', 'button');
      node.tabIndex = 0;
      node.addEventListener('click', () => {
        haptic.tap();
        navigate(target.screen, target.params);
      });
    }

    frag.appendChild(node);
  }

  listSlot.appendChild(frag);
  return list;
}

function resolveTarget(notif) {
  if (notif.orderId) {
    return { screen: SCREENS.ORDER_DETAIL, params: { orderId: notif.orderId } };
  }
  if (notif.screen) {
    return { screen: notif.screen, params: notif.params ?? null };
  }
  return null;
}

function setText(root, key, value) {
  const el = root.querySelector(`[data-bind="${key}"]`);
  if (el) el.textContent = value;
}
