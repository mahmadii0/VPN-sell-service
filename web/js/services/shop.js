import { get } from '../api/client.js';
import { ENDPOINTS, resolvePath } from '../api/endpoints.js';
import { getUser, getInitData } from './telegram.js';
import { getState, setState } from '../state/store.js';
import { getPlanById } from '../pricing/pricing.js';

function mapOrder(order, packages, subscriptionBase = '') {
  const plan = getPlanById(order.package_id);
  const serverPlan = packages.find((p) => p.id === order.package_id);
  const createdAt = order.created_at ? new Date(order.created_at) : null;
  const expiresAt = createdAt && plan?.duration ? new Date(createdAt.getTime() + plan.duration * 30 * 24 * 60 * 60 * 1000).toISOString() : null;
  const subId = order.panel_sub_id || null;
  const configLink = subId && subscriptionBase ? `${subscriptionBase}${encodeURIComponent(subId)}` : null;

  return {
    id: order.id,
    packageName: order.package_name,
    type: plan?.type ?? 'normal',
    duration: plan?.duration ?? 0,
    volume: plan?.volume ?? null,
    unlimited: Boolean(plan?.unlimited),
    price: order.price_toman,
    status: order.status,
    createdAt: order.created_at,
    paymentMethod: 'card_to_card',
    configLink,
    expiresAt,
    remainingSeconds: expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)) : null,
    panelSubId: subId,
    name: serverPlan?.name ?? order.package_name
  };
}

export async function refreshShop() {
  if (!getInitData()) throw new Error('فروشگاه را از طریق ربات تلگرام باز کنید');

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
  return getState();
}
