// ⚠️ PROPOSED CONTRACT — needs Backend confirmation.
// Frontend builds against this shape. When the real contract arrives,
// update this file (and only this file) — callers stay untouched.

export const ENDPOINTS = Object.freeze({
  // ----- User -----
  USER_ME:              { method: 'GET',  path: '/user/me' },

  // ----- Wallet -----
  WALLET_BALANCE:       { method: 'GET',  path: '/wallet/balance' },
  WALLET_TRANSACTIONS:  { method: 'GET',  path: '/wallet/transactions' },
  WALLET_CHARGE:        { method: 'POST', path: '/wallet/charge' },

  // ----- Subscription -----
  SUBSCRIPTION_CURRENT: { method: 'GET',  path: '/subscription/current' },

  // ----- Orders -----
  ORDER_CREATE:         { method: 'POST', path: '/orders' },
  ORDER_LIST:           { method: 'GET',  path: '/orders' },
  ORDER_DETAIL:         { method: 'GET',  path: '/orders/:id' },

  // ----- Payment -----
  PAYMENT_INITIATE:     { method: 'POST', path: '/payments/initiate' },
  PAYMENT_VERIFY:       { method: 'POST', path: '/payments/verify' },

  // ----- Notifications -----
  NOTIFICATIONS_LIST:   { method: 'GET',  path: '/notifications' },
  NOTIFICATIONS_READ:   { method: 'POST', path: '/notifications/read' }
});

// Replace :param placeholders with actual values.
export function resolvePath(template, params = {}) {
  return template.replace(/:([a-zA-Z_]+)/g, (_, name) => {
    if (!(name in params)) {
      throw new Error(`Missing path param: ${name}`);
    }
    return encodeURIComponent(params[name]);
  });
}
