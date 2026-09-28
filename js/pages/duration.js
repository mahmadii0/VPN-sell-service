import { SCREENS } from '../core/constants.js';
import { getState, setState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import { getDurationOptions } from '../pricing/pricing.js';
import { formatNumber } from '../utils/format.js';
import { iconNode } from '../components/icons.js';

export function renderDuration() {
  const frag = useTemplate('tpl-duration');
  const root = frag.firstElementChild;

  fillStaticIcons(root);
  bindActions(root);
  renderDurationCards(root);
  syncSelection(root);

  return frag;
}

function fillStaticIcons(root) {
  const iconMap = { back: 'arrowRight' };

  root.querySelectorAll('[data-icon]').forEach((slot) => {
    const raw = slot.getAttribute('data-icon');
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
    else if (action === 'custom') navigate(SCREENS.CUSTOM_PLAN);
    else if (action === 'continue') continueToPlans();
  });
}

function renderDurationCards(root) {
  const slot = root.querySelector('[data-slot="durations"]');
  if (!slot) return;

  const options = getDurationOptions().filter((o) => o.duration <= 3);
  const frag = document.createDocumentFragment();

  for (const opt of options) {
    const tpl = useTemplate('tpl-duration-card');
    const node = tpl.firstElementChild;

    node.dataset.duration = String(opt.duration);
    node.querySelector('[data-bind="title"]').textContent = `${formatNumber(opt.duration)} ماهه`;
    node.querySelector('[data-bind="rate"]').textContent =
      `به ازای هر گیگابایت ${formatNumber(opt.pricePerGB)} تومان`;

    const chevronSlot = node.querySelector('[data-icon="chevronLeft"]');
    if (chevronSlot) {
      const chevronSvg = iconNode('chevronLeft', { size: 18 });
      if (chevronSvg) chevronSlot.replaceWith(chevronSvg);
    }

    node.addEventListener('click', () => toggleDuration(root, opt.duration));
    frag.appendChild(node);
  }

  slot.appendChild(frag);
}

function toggleDuration(root, duration) {
  const { selectedDuration } = getState();
  const next = selectedDuration === duration ? null : duration;
  setState({ selectedDuration: next });
  syncSelection(root);
}

function syncSelection(root) {
  const { selectedDuration } = getState();

  root.querySelectorAll('[data-slot="durations"] [data-duration]').forEach((card) => {
    const active = Number(card.dataset.duration) === selectedDuration;
    card.classList.toggle('is-selected', active);
  });

  const btn = root.querySelector('[data-action="continue"]');
  if (btn) btn.disabled = selectedDuration === null;
}

function continueToPlans() {
  const { selectedDuration } = getState();
  if (!selectedDuration) return;
  navigate(SCREENS.SUGGESTED_PLANS, { duration: selectedDuration });
}