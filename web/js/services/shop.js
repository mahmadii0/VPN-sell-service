import { get } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import { getUser, getInitData } from './telegram.js';
import { getState, setState } from '../state/store.js';
import { getPlanById } from '../pricing/pricing.js';

const pending = new Map();

function mapOrder(order) {
  const plan = getPlanById(order.package_id);
  return {
    id: order.id,
    packageName: order.package_name,
    name: order.package_name,
    type: plan?.type ?? 'normal',
    duration: plan?.duration ?? 0,
    volume: plan?.volume ?? null,
    unlimited: Boolean(plan?.unlimited),
    price: order.price_toman,
    status: order.status,
    createdAt: order.created_at,
    paymentMethod: 'card_to_card',
    panelSubId: order.panel_sub_id || null,
    configLink: null,
    expiresAt: null,
    remainingSeconds: null
  };
}

async function loadSection(section) {
  switch (section) {
    case 'shop': {
      const data = await get(ENDPOINTS.SHOP.path);
      setState({ shopPackages: data.packages ?? [], cardNumber: shop.card_number ?? '', cardNumber2: shop.card_number_2 ?? '',});
      break;
    }
    case 'me': {
      const data = await get(ENDPOINTS.USER_ME.path);
      setState({ currentUser: getUser(), walletBalance: data.wallet_toman ?? 0 });
      break;
    }
    case 'orders': {
      const data = await get(ENDPOINTS.ORDER_LIST.path);
      const orders = (data.orders ?? []).map(mapOrder);
      setState({ orders });
      return orders;
    }
    case 'transactions': {
      const data = await get(ENDPOINTS.WALLET_TRANSACTIONS.path);
      setState({
        walletTransactions: (data.transactions ?? []).map((entry) => ({
          type: Number(entry.amount_toman) < 0 ? 'purchase' : 'charge',
          title: `تراکنش سفارش #${entry.order_id}`,
          date: entry.created_at,
          amount: entry.amount_toman
        }))
      });
      break;
    }
    case 'subscription': {
      const orders = await fetchSection('orders');
      const approved = orders.filter((order) => order.status === 'approved')
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const subscriptions = [];
      for (const order of approved) {
        let service;
        try {
          service = await get(`/api/orders/${encodeURIComponent(order.id)}/service`);
        } catch (err) {
          if (err.status === 409) continue;
          throw err;
        }
        const remaining = service.remaining_seconds ?? null;
        subscriptions.push({
          ...order,
          configLink: service.subscription_url || null,
          expiresAt: service.expiry_utc ?? null,
          remainingSeconds: remaining,
          daysLeft: remaining == null ? null : Math.ceil(remaining / 86400),
          totalGB: null,
          usedGB: null
        });
      }
      setState({ subscriptions, currentSubscription: subscriptions[0] ?? null });
      break;
    }
    default:
      throw new Error(`Unknown section: ${section}`);
  }
}

function fetchSection(section) {
  if (!pending.has(section)) {
    const promise = loadSection(section).finally(() => pending.delete(section));
    pending.set(section, promise);
  }
  return pending.get(section);
}

export async function refreshShop({
  sections = ['shop', 'me', 'orders', 'transactions', 'subscription']
} = {}) {
  if (!getInitData()) throw new Error('فروشگاه را از طریق ربات تلگرام باز کنید');
<<<<<<< HEAD
  const results = await Promise.allSettled([...new Set(sections)].map(fetchSection));
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
=======

  // Fetch all sections in parallel but tolerate individual endpoint failures:
  // one broken endpoint must not blank every page (wallet, purchases, subscription).
  const requests = [
    ['shop', ENDPOINTS.SHOP.path],
    ['me', ENDPOINTS.USER_ME.path],
    ['orders', ENDPOINTS.ORDER_LIST.path],
    ['ledger', ENDPOINTS.WALLET_TRANSACTIONS.path]
  ];
  const settled = await Promise.all(requests.map(async ([name, path]) => {
    try {
      return { name, data: await get(path), error: null };
    } catch (err) {
      console.error(`[shop] refresh: ${path} failed:`, err);
      return { name, data: null, error: err };
    }
  }));
  const byName = Object.fromEntries(settled.map((r) => [r.name, r]));

  // Only surface a hard failure when every endpoint failed (backend unreachable).
  if (settled.every((r) => r.data === null)) {
    throw settled[0].error ?? new Error('خطا در دریافت اطلاعات فروشگاه');
  }

  // Fall back to the previous state for any endpoint that failed.
  const prev = getState();
  const shop = byName.shop.data ?? { packages: prev.shopPackages ?? [], card_number: prev.cardNumber ?? '', subscription_base: '' };
  const me = byName.me.data ?? { wallet_toman: prev.walletBalance ?? 0 };

  const subscriptionBase = shop.subscription_base ?? '';
  const packages = shop.packages ?? [];
  const orders = byName.orders.data
    ? (byName.orders.data.orders ?? []).map((order) => mapOrder(order, packages, subscriptionBase))
    : (prev.orders ?? []);

  const current = orders.filter((o) => o.status === 'approved').sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] ?? null;

  const walletTransactions = byName.ledger.data
    ? (byName.ledger.data.transactions ?? []).map((entry) => ({
        type: entry.kind === 'charge' ? 'charge' : 'purchase',
        title: entry.kind === 'charge' ? `شارژ کیف پول #${entry.order_id}` : `خرید اشتراک #${entry.order_id}`,
        date: entry.created_at,
        amount: entry.amount_toman
      }))
    : (prev.walletTransactions ?? []);

  setState({
    currentUser: getUser(),
    shopPackages: packages,
    cardNumber: shop.card_number ?? '',
    walletBalance: me.wallet_toman ?? 0,
    walletTransactions,
    orders,
    currentSubscription: current ? {
      ...current,
      configLink: current.configLink,
      expiresAt: current.expiresAt,
      daysLeft: current.remainingSeconds == null ? null : Math.ceil(current.remainingSeconds / 86400),
      totalGB: null,
      usedGB: null
    } : null
  });
>>>>>>> 090e4f1517e37a75a4ba5065549ea92474ea544a
  return getState();
}
