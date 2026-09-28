import { getState, setState, subscribe } from '../state/store.js';
import { backButton, hideBackButton } from '../services/telegram.js';

const registry = new Map();
const history = [];

let mountNode = null;
let currentCleanup = null;

export function register(id, renderFn) {
  registry.set(id, renderFn);
}

export function init(mount) {
  mountNode = mount;
  subscribe((state) => render(state.currentScreen, state.screenParams));
}

export function navigate(id, params = null) {
  if (!registry.has(id)) {
    console.warn(`[router] Unknown screen: ${id}`);
    return;
  }
  const current = getState();
  if (current.currentScreen !== id) {
    history.push({ screenId: current.currentScreen, params: current.screenParams });
  }
  setState({ currentScreen: id, screenParams: params });
  syncBackButton();
}

export function back() {
  const prev = history.pop();
  if (!prev) return;
  setState({ currentScreen: prev.screenId, screenParams: prev.params });
  syncBackButton();
}

export function reset(id, params = null) {
  history.length = 0;
  setState({ currentScreen: id, screenParams: params });
  syncBackButton();
}

function syncBackButton() {
  if (history.length === 0) hideBackButton();
  else backButton({ onClick: back, show: true });
}

async function render(screenId, params) {
  if (!mountNode) return;

  const renderFn = registry.get(screenId);
  if (!renderFn) return;

  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (e) { console.error('[router] cleanup:', e); }
    currentCleanup = null;
  }

  mountNode.innerHTML = '';

  try {
    const result = await renderFn({ params });
    const node = result?.node ?? result;
    currentCleanup = result?.cleanup ?? null;
    if (node instanceof Node) mountNode.appendChild(node);
  } catch (err) {
    console.error('[router] render error:', err);
    mountNode.innerHTML = '<div class="pulse-page-section" style="padding-top:40px;text-align:center;color:#94A3B8">خطا در بارگذاری صفحه</div>';
  }
}
