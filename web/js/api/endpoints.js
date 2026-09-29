export const ENDPOINTS = Object.freeze({
  SHOP:              { method: 'GET', path: '/api/shop' },
  USER_ME:           { method: 'GET', path: '/api/me' },
  WALLET_TRANSACTIONS: { method: 'GET', path: '/api/wallet/transactions' },
  ORDER_CREATE:      { method: 'POST', path: '/api/orders' },
  ORDER_LIST:        { method: 'GET', path: '/api/orders' },
  ORDER_DETAIL:      { method: 'GET', path: '/api/orders/:id' },
  ORDER_SERVICE:     { method: 'GET', path: '/api/orders/:id/service' }
});

export function resolvePath(template, params = {}) {
  return template.replace(/:([a-zA-Z_]+)/g, (_, name) => {
    if (!(name in params)) {
      throw new Error(`Missing path param: ${name}`);
    }
    return encodeURIComponent(params[name]);
  });
}
