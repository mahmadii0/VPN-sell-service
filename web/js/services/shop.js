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
  const [shop, me, listing, ledger] = await Promise.all([
    get(ENDPOINTS.SHOP.path),
    get(ENDPOINTS.USER_ME.path),
    get(ENDPOINTS.ORDER_LIST.path),
    get(ENDPOINTS.WALLET_TRANSACTIONS.path)
  ]);
  const subscriptionBase = shop.subscription_base ?? '';
  const packages = shop.packages ?? [];
  const orders = (listing.orders ?? []).map((order) => mapOrder(order, packages, subscriptionBase));
  const current = orders.filter((o) => o.status === 'approved').sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] ?? null;
  setState({
    currentUser: getUser(),
    shopPackages: packages,
    cardNumber: shop.card_number ?? '',
    walletBalance: me.wallet_toman ?? 0,
    walletTransactions: (ledger.transactions ?? []).map((entry) => ({
      type: 'charge', title: `اعتبار سفارش #${entry.order_id}`,
      date: entry.created_at, amount: entry.amount_toman
    })),
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
