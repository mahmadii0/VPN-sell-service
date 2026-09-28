//  PULSE VPN — Application Configuration

//  @type {Readonly<object>} 

export const APP = Object.freeze({
  nameEn: 'PULSE VPN',
  nameFa: 'وی‌پی‌ان پالس',
  tagline: 'اتصال امن، آزادی بیشتر',
  version: '0.1.0',
  phase: 1,
  locale: 'fa-IR',
  currency: 'تومان',
  currencyShort: 'ت',
  direction: 'rtl'
});

/** Telegram SDK endpoints and helpers. */
export const TELEGRAM = Object.freeze({
  sdkUrl: 'https://telegram.org/js/telegram-web-app.js',
  themeColors: Object.freeze({
    header: '#081220',
    background: '#081220'
  })
});


export function isTelegramEnvironment() {
  return Boolean(
    typeof window !== 'undefined' &&
    window.Telegram?.WebApp?.initData !== undefined
  );
}


export function isDev() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '';
}
