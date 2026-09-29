import { SCREENS } from '../core/constants.js';
import { getState, setState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import { getConnectionOptions } from '../pricing/pricing.js';
import { iconNode } from '../components/icons.js';

export function renderConnectionType({ params } = {}) {
  const frag = useTemplate('tpl-connection-type');
  const root = frag.firstElementChild;

  const duration = params?.duration ?? getState().selectedDuration;
  if (!duration) { back(); return frag; }

  fillStaticIcons(root);
  bindActions(root);
  renderOptions(root);
  syncSelection(root);

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
    else if (action === 'continue') continueToPlans();
  });
}

function renderOptions(root) {
  const slot = root.querySelector('[data-slot="options"]');
  if (!slot) return;

  const frag = document.createDocumentFragment();

  for (const opt of getConnectionOptions()) {
    const tpl = useTemplate('tpl-connection-card');
    const node = tpl.firstElementChild;

    node.dataset.connection = opt.type;
    if (opt.type === 'tunnel') node.classList.add('pulse-connection-card--tunnel');

    node.querySelector('[data-bind="title"]').textContent = opt.label;
    node.querySelector('[data-bind="description"]').textContent = opt.description;

    const badge = node.querySelector('[data-bind="badge"]');
    if (badge) badge.hidden = !opt.highlight;

    node.addEventListener('click', () => toggleConnection(root, opt.type));
    frag.appendChild(node);
  }

  slot.appendChild(frag);
}

function toggleConnection(root, type) {
  const { selectedConnectionType } = getState();
  const next = selectedConnectionType === type ? null : type;
  setState({
    selectedConnectionType: next,
    selectedPlan: null
  });
  syncSelection(root);
}

function syncSelection(root) {
  const { selectedConnectionType } = getState();

  root.querySelectorAll('[data-slot="options"] [data-connection]').forEach((card) => {
    const active = card.dataset.connection === selectedConnectionType;
    card.classList.toggle('is-selected', active);
  });

  const btn = root.querySelector('[data-action="continue"]');
  if (btn) btn.disabled = !selectedConnectionType;
}

function continueToPlans() {
  const { selectedDuration, selectedConnectionType } = getState();
  if (!selectedDuration || !selectedConnectionType) return;
  navigate(SCREENS.PLANS, {
    duration: selectedDuration,
    connectionType: selectedConnectionType
  });
}
