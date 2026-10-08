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
  const results = await Promise.allSettled([...new Set(sections)].map(fetchSection));
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
  return getState();
}
