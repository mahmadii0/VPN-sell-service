import { SCREENS } from '../core/constants.js';
import { getState, setState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import {
  CUSTOM_PLAN,
  calculatePrice,
  getPricePerGB,
  getRateTier,
  buildCustomPlan
} from '../pricing/pricing.js';
import { formatNumber } from '../utils/format.js';
import { iconNode } from '../components/icons.js';

export function renderCustomPlan() {
  const frag = useTemplate('tpl-custom-plan');
  const root = frag.firstElementChild;

  fillStaticIcons(root);
  bindActions(root);
  renderRateChips(root);
  renderDurationPills(root);
  syncAll(root);

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
    else if (action === 'vol-minus') changeVolume(root, -CUSTOM_PLAN.volumeStep);
    else if (action === 'vol-plus') changeVolume(root, CUSTOM_PLAN.volumeStep);
    else if (action === 'continue') continueToCheckout();
  });
}

function renderRateChips(root) {
  const slot = root.querySelector('[data-slot="rateChips"]');
  if (!slot) return;

  const tiers = [
    { tier: 'tier-1', label: '1 ماهه',       rate: getPricePerGB(1) },
    { tier: 'tier-2', label: '2 و 3 ماهه',   rate: getPricePerGB(2) },
    { tier: 'tier-3', label: '4 تا 6 ماهه',  rate: getPricePerGB(4) }
  ];

  const frag = document.createDocumentFragment();

  for (const t of tiers) {
    const tpl = useTemplate('tpl-rate-chip');
    const node = tpl.firstElementChild;
    node.dataset.tier = t.tier;
    node.querySelector('[data-bind="label"]').textContent =
      `${t.label} — ${formatNumber(t.rate)} تومان`;
    frag.appendChild(node);
  }

  slot.appendChild(frag);
}

function renderDurationPills(root) {
  const slot = root.querySelector('[data-slot="durationPills"]');
  if (!slot) return;

  const frag = document.createDocumentFragment();

  for (let d = CUSTOM_PLAN.minDuration; d <= CUSTOM_PLAN.maxDuration; d++) {
    const tpl = useTemplate('tpl-duration-pill');
    const node = tpl.firstElementChild;
    node.dataset.duration = String(d);
    node.querySelector('[data-bind="label"]').textContent = `${formatNumber(d)} ماهه`;
    node.addEventListener('click', () => selectDuration(root, d));
    frag.appendChild(node);
  }

  slot.appendChild(frag);
}

function changeVolume(root, delta) {
  const current = getState().customVolume;
  const next = Math.max(
    CUSTOM_PLAN.minVolume,
    Math.min(CUSTOM_PLAN.maxVolume, current + delta)
  );
  if (next === current) return;
  setState({ customVolume: next });
  syncVolume(root);
  syncPrice(root);
}

function selectDuration(root, duration) {
  setState({ customDuration: duration });
  syncDuration(root);
  syncRateChips(root);
  syncPrice(root);
}

function syncAll(root) {
  syncVolume(root);
  syncDuration(root);
  syncRateChips(root);
  syncPrice(root);
}

function syncVolume(root) {
  const volume = getState().customVolume;
  const numEl = root.querySelector('[data-bind="volValueNum"]');
  if (numEl) numEl.textContent = formatNumber(volume);

  const minusBtn = root.querySelector('[data-action="vol-minus"]');
  const plusBtn = root.querySelector('[data-action="vol-plus"]');
  if (minusBtn) minusBtn.disabled = volume <= CUSTOM_PLAN.minVolume;
  if (plusBtn) plusBtn.disabled = volume >= CUSTOM_PLAN.maxVolume;
}

function syncDuration(root) {
  const duration = getState().customDuration;
  root.querySelectorAll('[data-slot="durationPills"] [data-duration]').forEach((pill) => {
    pill.classList.toggle('is-active', Number(pill.dataset.duration) === duration);
  });
}

function syncRateChips(root) {
  const duration = getState().customDuration;
  const activeTier = getRateTier(duration);
  root.querySelectorAll('[data-slot="rateChips"] [data-tier]').forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.tier === activeTier);
  });
}

function syncPrice(root) {
  const { customVolume, customDuration } = getState();
  const rate = getPricePerGB(customDuration);
  const total = calculatePrice(customVolume, customDuration);

  setText(root, 'pricePerGB', `${formatNumber(rate)} تومان`);
  setText(root, 'volumeDisplay', `${formatNumber(customVolume)} گیگابایت`);
  setText(root, 'durationDisplay', `${formatNumber(customDuration)} ماهه`);
  setText(root, 'finalPrice', `${formatNumber(total)} تومان`);
}

function setText(root, key, value) {
  const el = root.querySelector(`[data-bind="${key}"]`);
  if (el) el.textContent = value;
}

function continueToCheckout() {
  const { customVolume, customDuration } = getState();
  const plan = buildCustomPlan(customVolume, customDuration);
  if (!plan) return;
  setState({ selectedPlan: plan });
  navigate(SCREENS.CHECKOUT, { plan });
}
