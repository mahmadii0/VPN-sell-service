import { getState, setState, subscribe } from '../state/store.js';
import { backButton, hideBackButton } from '../services/telegram.js';

const registry = new Map();
let mountNode = null;
let currentCleanup = null;
let pendingParams = null;

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

  subscribe((state) => render(state.currentScreen, state.screenParams));
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

  setState({
    currentScreen: id,
    screenParams: pendingParams
  });
  pendingParams = null;
  syncBackButton();
}

export function navigate(id, params = null) {
  if (!registry.has(id)) {
    console.warn(`[router] Unknown screen: ${id}`);
    return;
  }

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
  }
}
