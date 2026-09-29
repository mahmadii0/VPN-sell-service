import { getState, setState, subscribe } from '../state/store.js';
import { backButton, hideBackButton } from '../services/telegram.js';
import { el } from '../utils/dom.js';

const registry = new Map();
let mountNode = null;
let currentCleanup = null;
let pendingParams = null;
let lastNavigationAt = 0;

const NAV_THROTTLE_MS = 180;
const EXIT_MS = 120;

export function register(id, renderFn) {
  registry.set(id, renderFn);
}

export function init(mount) {
  mountNode = mount;

  if (!window.location.hash) {
    history.replaceState(null, '', '#/home');
  }

  window.addEventListener('hashchange', handleHashChange);

  const initialId = parseHash();
  if (initialId && registry.has(initialId) && initialId !== getState().currentScreen) {
    setState({ currentScreen: initialId });
  }

  subscribe((s) => render(s.currentScreen, s.screenParams));
  syncBackButton();
}

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return raw || null;
}

function handleHashChange() {
  const id = parseHash();

  if (!id || !registry.has(id)) {
    window.location.hash = '#/home';
    return;
  }

  setState({ currentScreen: id, screenParams: pendingParams });
  pendingParams = null;
  syncBackButton();
}

export function navigate(id, params = null) {
  if (!registry.has(id)) {
    console.warn(`[router] Unknown screen: ${id}`);
    return;
  }

  const now = performance.now();
  if (now - lastNavigationAt < NAV_THROTTLE_MS) return;
  lastNavigationAt = now;

  const targetHash = `#/${id}`;

  if (window.location.hash === targetHash) {
    if (params !== null) setState({ screenParams: params });
    return;
  }

  pendingParams = params;
  window.location.hash = targetHash;
}

export function back() {
  if (window.history.length <= 1) {
    navigate('home');
    return;
  }
  lastNavigationAt = 0;
  window.history.back();
}

export function reset(id, params = null) {
  if (!registry.has(id)) return;

  const targetHash = `#/${id}`;
  const currentScreen = getState().currentScreen;

  if (window.location.hash === targetHash && currentScreen === id) {
    if (params !== null) setState({ screenParams: params });
    return;
  }

  history.replaceState(null, '', targetHash);
  setState({ currentScreen: id, screenParams: params });
  syncBackButton();
}

function syncBackButton() {
  const screen = getState().currentScreen;
  if (screen === 'home') {
    hideBackButton();
  } else {
    backButton({ onClick: () => back(), show: true });
  }
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function buildErrorNode() {
  const wrap = el('div', { class: 'pulse-page' });

  wrap.appendChild(
    el('div', { class: 'pulse-page-section' }, [
      el('div', { class: 'pulse-card' }, [
        el('div', { class: 'pulse-empty' }, [
          el('div', { class: 'pulse-empty__icon' }, [
            el('span', {
              html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
            })
          ]),
          el('div', { class: 'pulse-empty__title' }, 'خطا در بارگذاری صفحه'),
          el('div', { class: 'pulse-empty__text' }, 'مشکلی پیش آمده. لطفاً دوباره تلاش کنید.'),
          el('button', {
            type: 'button',
            class: 'pulse-btn pulse-btn--primary',
            text: 'بارگذاری مجدد',
            onClick: () => window.location.reload()
          })
        ])
      ])
    ])
  );

  return wrap;
}

async function render(screenId, params) {
  if (!mountNode) return;

  const renderFn = registry.get(screenId);
  if (!renderFn) return;

  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (e) { console.error('[router] cleanup:', e); }
    currentCleanup = null;
  }

  const oldChildren = Array.from(mountNode.children);
  if (oldChildren.length && !prefersReducedMotion()) {
    mountNode.classList.add('is-leaving');
    await new Promise((r) => setTimeout(r, EXIT_MS));
    mountNode.classList.remove('is-leaving');
  }

  mountNode.innerHTML = '';

  try {
    const result = await renderFn({ params });
    const node = result?.node ?? result;
    currentCleanup = result?.cleanup ?? null;

    if (node instanceof Node) {
      if (node.nodeType === 1) node.classList.add('is-entering');
      mountNode.appendChild(node);

      if (node.nodeType === 1 && !prefersReducedMotion()) {
        setTimeout(() => node.classList.remove('is-entering'), 400);
      } else if (node.nodeType === 1) {
        node.classList.remove('is-entering');
      }
    }
  } catch (err) {
    console.error('[router] render error:', err);
    mountNode.appendChild(buildErrorNode());
  }
}
