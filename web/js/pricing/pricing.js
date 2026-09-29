import { getState } from '../state/store.js';

// Display metadata only. Availability and prices come from the Go shop API.
// Prices are in Toman (raw value, not thousand).

export const PLANS = Object.freeze({
  normal_1m: Object.freeze([
    Object.freeze({ id: 'N-1M-30GB',  type: 'normal', duration: 1, volume: 30,  price: 150000 }),
    Object.freeze({ id: 'N-1M-50GB',  type: 'normal', duration: 1, volume: 50,  price: 250000 }),
    Object.freeze({ id: 'N-1M-70GB',  type: 'normal', duration: 1, volume: 70,  price: 350000 })
  ]),
  tunnel_1m: Object.freeze([
    Object.freeze({ id: 'T-1M-30GB',  type: 'tunnel', duration: 1, volume: 30,  price: 240000 }),
    Object.freeze({ id: 'T-1M-50GB',  type: 'tunnel', duration: 1, volume: 50,  price: 400000 }),
    Object.freeze({ id: 'T-1M-60GB',  type: 'tunnel', duration: 1, volume: 60,  price: 480000 }),
    Object.freeze({ id: 'T-1M-70GB',  type: 'tunnel', duration: 1, volume: 70,  price: 560000 })
  ]),
  normal_2m: Object.freeze([
    Object.freeze({ id: 'N-2M-60GB',  type: 'normal', duration: 2, volume: 60,  price: 360000 }),
    Object.freeze({ id: 'N-2M-80GB',  type: 'normal', duration: 2, volume: 80,  price: 480000 }),
    Object.freeze({ id: 'N-2M-100GB', type: 'normal', duration: 2, volume: 100, price: 600000 })
  ]),
  tunnel_2m: Object.freeze([
    Object.freeze({ id: 'T-2M-50GB',  type: 'tunnel', duration: 2, volume: 50,  price: 540000 }),
    Object.freeze({ id: 'T-2M-70GB',  type: 'tunnel', duration: 2, volume: 70,  price: 630000 }),
    Object.freeze({ id: 'T-2M-80GB',  type: 'tunnel', duration: 2, volume: 80,  price: 720000 }),
    Object.freeze({ id: 'T-2M-100GB', type: 'tunnel', duration: 2, volume: 100, price: 900000 })
  ])
});

export const UNLIMITED_PLAN = Object.freeze({
  id: 'U-1M',
  type: 'unlimited',
  duration: 1,
  volume: null,
  unlimited: true,
  price: 600000
});

export const CONNECTION_TYPES = Object.freeze({
  NORMAL: 'normal',
  TUNNEL: 'tunnel'
});

export const DURATIONS = Object.freeze([1, 2]);

export function getDurationOptions() {
  return [
    { duration: 1, label: '1 ماهه' },
    { duration: 2, label: '2 ماهه' }
  ];
}

export function getConnectionOptions() {
  return [
    {
      type: CONNECTION_TYPES.NORMAL,
      label: 'عادی',
      description: 'اتصال معمولی و پایدار. مناسب استفاده روزمره.'
    },
    {
      type: CONNECTION_TYPES.TUNNEL,
      label: 'تانل',
      description: 'پرسرعت‌تر و پایدارتر از عادی. مناسب مصرف سنگین و استریم.',
      highlight: true
    }
  ];
}

export function getPlans(duration, connectionType) {
  const key = `${connectionType}_${duration}m`;
  const list = PLANS[key];
  return list ? list.map((p) => ({ ...p })) : [];
}

export function getUnlimitedPlan(duration) {
  return duration === 1 ? { ...UNLIMITED_PLAN } : null;
}

// Unlimited is only offered for the normal connection, 1-month duration.
export function getAllPlans(duration, connectionType) {
  const base = getPlans(duration, connectionType);
  const unlimited = connectionType === CONNECTION_TYPES.NORMAL
    ? getUnlimitedPlan(duration)
    : null;
  const catalog = new Map(getState().shopPackages.map((p) => [p.id, p]));
  return (unlimited ? [...base, unlimited] : base)
    .filter((plan) => catalog.has(plan.id))
    .map((plan) => ({ ...plan, price: catalog.get(plan.id).price_toman }));
}

export function getPlanById(id) {
  for (const key of Object.keys(PLANS)) {
    const found = PLANS[key].find((p) => p.id === id);
    if (found) return { ...found };
  }
  if (id === UNLIMITED_PLAN.id) return { ...UNLIMITED_PLAN };
  return null;
}
