import { APP } from '../core/config.js';
import { back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import { iconNode } from '../components/icons.js';
import { showAlert } from '../services/telegram.js';
import { get, set } from '../services/storage.js';

const STORAGE_KEY = 'settings';

export function renderSettings() {
  const frag = useTemplate('tpl-settings');
  const root = frag.firstElementChild;

  fillStaticIcons(root);
  bindActions(root);
  hydrate(root);

  return frag;
}

function fillStaticIcons(root) {
  const iconMap = { back: 'arrowRight' };
  root.querySelectorAll('[data-icon]').forEach((slot) => {
    const raw = slot.getAttribute('data-icon');
    if (!raw) return;
    const name = iconMap[raw] || raw;
    const isMenu = slot.classList.contains('pulse-menu-item__icon');
    const size = slot.closest('.pulse-icon-btn') || isMenu ? 20 : 18;
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
    else if (action === 'language') showAlert('در حال حاضر فقط زبان فارسی پشتیبانی می‌شود.');
    else if (action === 'about') showAbout();
  });

  const toggle = root.querySelector('[data-bind="notifToggle"]');
  if (toggle) {
    toggle.addEventListener('change', () => {
      const current = get(STORAGE_KEY, {});
      set(STORAGE_KEY, { ...current, notifications: toggle.checked });
    });
  }
}

function hydrate(root) {
  const versionEl = root.querySelector('[data-bind="version"]');
  if (versionEl) versionEl.textContent = APP.version;

  const settings = get(STORAGE_KEY, { notifications: true });
  const toggle = root.querySelector('[data-bind="notifToggle"]');
  if (toggle) toggle.checked = settings.notifications !== false;
}

function showAbout() {
  showAlert(
    `${APP.nameEn}\n${APP.tagline}\n\nنسخه: ${APP.version}\n\nبرای دریافت پشتیبانی به بخش «پشتیبانی» مراجعه کنید.`
  );
}
