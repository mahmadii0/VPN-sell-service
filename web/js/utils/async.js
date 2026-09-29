import { toast } from '../components/ui.js';

const loadedScreens = new Set();

export function markScreenLoaded(id) {
  loadedScreens.add(id);
}

export function isScreenLoaded(id) {
  return loadedScreens.has(id);
}

export async function renderWithSkeleton({
  screenId,
  container,
  skeleton,
  load,
  render,
  minDelay = 320
}) {
  if (!container) return;

  const skipSkeleton = isScreenLoaded(screenId);

  if (skipSkeleton) {
    container.innerHTML = '';
    try {
      const data = await load();
      container.appendChild(render(data));
    } catch (err) {
      console.error('[async] load error:', err);
      container.appendChild(render(null));
    }
    return;
  }

  container.innerHTML = '';
  container.appendChild(skeleton);

  try {
    const [data] = await Promise.all([load(), new Promise((r) => setTimeout(r, minDelay))]);
    markScreenLoaded(screenId);
    container.innerHTML = '';
    container.appendChild(render(data));
  } catch (err) {
    console.error('[async] load error:', err);
    toast('خطا در بارگذاری داده‌ها', { variant: 'error' });
    container.innerHTML = '';
    container.appendChild(render(null));
  }
}
