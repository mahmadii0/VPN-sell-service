import { BOTTOM_NAV_ITEMS } from '../core/constants.js';
import { subscribe } from '../state/store.js';
import { iconNode } from './icons.js';
import { el } from '../utils/dom.js';
import * as router from '../core/router.js';

export function renderBottomNav(mount) {
  const nav = el('nav', { class: 'pulse-bottom-nav', role: 'navigation', 'aria-label': 'ناوبری اصلی' });
  mount.appendChild(nav);

  return subscribe((state) => {
    nav.innerHTML = '';

    for (const item of BOTTOM_NAV_ITEMS) {
      const isActive = state.currentScreen === item.screen;

      nav.appendChild(
        el('button', {
          type: 'button',
          class: `pulse-bottom-nav__item${isActive ? ' is-active' : ''}`,
          'aria-label': item.label,
          'aria-current': isActive ? 'page' : null,
          onClick: () => router.navigate(item.screen)
        }, [
          iconNode(item.icon, { size: 22 }),
          el('span', {}, item.label)
        ])
      );
    }
  });
}
