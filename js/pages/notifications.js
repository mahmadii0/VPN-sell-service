import { back } from '../core/router.js';
import { getState } from '../state/store.js';
import { useTemplate, mountTemplate } from '../core/template.js';
import { formatDate } from '../utils/format.js';
import { iconNode } from '../components/icons.js';

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
  renderContent(root);

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

function renderContent(root) {
  const slot = root.querySelector('[data-slot="content"]');
  slot.innerHTML = '';

  const items = getState().notifications ?? [];

  if (!items.length) {
    mountTemplate(slot, 'tpl-notifications-empty');
    fillStaticIcons(slot);
    return;
  }

  const wrapper = mountTemplate(slot, 'tpl-notifications-list');
  const listSlot = wrapper.querySelector('[data-slot="items"]');
  const frag = document.createDocumentFragment();

  for (const notif of items) {
    const tpl = useTemplate('tpl-notification-item');
    const node = tpl.firstElementChild;

    const iconSlot = node.querySelector('[data-icon]');
    if (iconSlot) {
      const svg = iconNode(TYPE_ICON[notif.type] || 'bell', { size: 20 });
      if (svg) iconSlot.replaceWith(svg);
    }

    node.querySelector('[data-bind="title"]').textContent = notif.title || '';
    node.querySelector('[data-bind="text"]').textContent = notif.text || '';
    node.querySelector('[data-bind="date"]').textContent = formatDate(notif.date) || '';

    frag.appendChild(node);
  }

  listSlot.appendChild(frag);
}
