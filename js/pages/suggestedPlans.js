import { SCREENS } from '../core/constants.js';
import { getState, setState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import { getAllPlansForDuration } from '../pricing/pricing.js';
import { formatNumber } from '../utils/format.js';
import { iconNode } from '../components/icons.js';

const POPULAR_BY_DURATION = {
  1: '1M-50GB',
  2: '2M-80GB',
  3: '3M-100GB'
};

export function renderSuggestedPlans({ params } = {}) {
  const frag = useTemplate('tpl-suggested-plans');
  const root = frag.firstElementChild;

  const duration = params?.duration
    ?? getState().selectedDuration
    ?? 1;

  const plans = getAllPlansForDuration(duration);

  fillStaticIcons(root);
  bindActions(root);
  setTitle(root, duration);
  renderPlans(root, plans, duration);
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
    else if (action === 'custom') navigate(SCREENS.CUSTOM_PLAN);
    else if (action === 'continue') continueToCheckout();
  });
}

function setTitle(root, duration) {
  const title = root.querySelector('[data-bind="pageTitle"]');
  if (title) title.textContent = `پلن‌های ${formatNumber(duration)} ماهه`;
}

function renderPlans(root, plans, duration) {
  const slot = root.querySelector('[data-slot="plans"]');
  if (!slot) return;

  const frag = document.createDocumentFragment();
  const popularId = POPULAR_BY_DURATION[duration];

  for (const plan of plans) {
    const tpl = useTemplate('tpl-plan-card');
    const node = tpl.firstElementChild;

    node.dataset.planId = plan.id;

    if (plan.unlimited) {
      node.classList.add('is-unlimited');
      node.querySelector('[data-bind="volume"]').textContent = 'نامحدود';
      node.querySelector('[data-bind="meta"]').textContent =
        `${formatNumber(plan.duration)} ماهه / ترافیک نامحدود`;
    } else {
      node.querySelector('[data-bind="volume"]').textContent =
        `${formatNumber(plan.volume)} گیگابایت`;
      node.querySelector('[data-bind="meta"]').textContent =
        `${formatNumber(plan.duration)} ماهه / به ازای هر گیگابایت ${formatNumber(plan.pricePerGB)} تومان`;
    }

    node.querySelector('[data-bind="price"]').textContent =
      `${formatNumber(plan.price)} تومان`;

    if (popularId && plan.id === popularId) {
      const badge = node.querySelector('[data-bind="badge"]');
      if (badge) badge.hidden = false;
    }

    node.addEventListener('click', () => togglePlan(root, plan));
    frag.appendChild(node);
  }

  slot.appendChild(frag);
}

function togglePlan(root, plan) {
  const { selectedPlan } = getState();
  const next = selectedPlan?.id === plan.id ? null : plan;
  setState({ selectedPlan: next });
  syncSelection(root);
}

function syncSelection(root) {
  const { selectedPlan } = getState();

  root.querySelectorAll('[data-slot="plans"] [data-plan-id]').forEach((card) => {
    const active = selectedPlan?.id === card.dataset.planId;
    card.classList.toggle('is-selected', active);
  });

  const btn = root.querySelector('[data-action="continue"]');
  if (btn) btn.disabled = !selectedPlan;
}

function continueToCheckout() {
  const { selectedPlan } = getState();
  if (!selectedPlan) return;
  navigate(SCREENS.CHECKOUT, { plan: selectedPlan });
}
