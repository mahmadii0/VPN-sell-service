import { toast } from '../components/ui.js';

const state = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  initialised: false
};

function handleOnline() {
  if (state.online) return;
  state.online = true;
  toast('اتصال اینترنت بازگشت', { variant: 'success', duration: 2500 });
}

function handleOffline() {
  if (!state.online) return;
  state.online = false;
  toast('اتصال اینترنت قطع شد — برخی بخش‌ها در دسترس نیستند', {
    variant: 'warning',
    duration: 6000
  });
}

export function isOnline() {
  return state.online;
}

export function init() {
  if (state.initialised) return;
  state.initialised = true;

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}
