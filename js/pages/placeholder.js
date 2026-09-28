import { useTemplate } from '../core/template.js';
import { back } from '../core/router.js';
import { iconNode } from '../components/icons.js';

export function renderPlaceholder() {
  const frag = useTemplate('tpl-placeholder');
  const root = frag.firstElementChild;

  root.querySelectorAll('[data-icon]').forEach((slot) => {
    const raw = slot.getAttribute('data-icon');
    if (!raw) return;
    const name = raw === 'back' ? 'arrowRight' : raw;
    const size = slot.closest('.pulse-icon-btn') ? 20 : 30;
    const svg = iconNode(name, { size });
    if (svg) slot.replaceWith(svg);
  });

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="back"]')) back();
  });

  return frag;
}
