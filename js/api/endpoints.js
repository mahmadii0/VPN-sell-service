// ⚠️ PROPOSED CONTRACT — needs Backend confirmation.
// Frontend builds against this shape. When the real contract arrives,
// update this file (and only this file) — callers stay untouched.

export const ENDPOINTS = Object.freeze({
  USER_ME:              { method: 'GET',  path: '/user/me' },

  WALLET_BALANCE:       { method: 'GET',  path: '/wallet/balance' },
  WALLET_TRANSACTIONS:  { method: 'GET',  path: '/wallet/transactions' },
  WALLET_CHARGE:        { method: 'POST', path: '/wallet/charge' },

  SUBSCRIPTION_CURRENT: { method: 'GET',  path: '/subscription/current' },

  ORDER_CREATE:         { method: 'POST', path: '/orders' },
  ORDER_LIST:           { method: 'GET',  path: '/orders' },
  ORDER_DETAIL:         { method: 'GET',  path: '/orders/:id' },

  PAYMENT_INITIATE:       { method: 'POST', path: '/payments/initiate' },
  PAYMENT_RECEIPT_UPLOAD: { method: 'POST', path: '/payments/receipt' },
  PAYMENT_STATUS:         { method: 'GET',  path: '/payments/:id/status' },

  NOTIFICATIONS_LIST:   { method: 'GET',  path: '/notifications' },
  NOTIFICATIONS_READ:   { method: 'POST', path: '/notifications/read' }
});

export function resolvePath(template, params = {}) {
  return template.replace(/:([a-zA-Z_]+)/g, (_, name) => {
    if (!(name in params)) {
      throw new Error(`Missing path param: ${name}`);
    }
    return encodeURIComponent(params[name]);
  });
}
