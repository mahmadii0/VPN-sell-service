import { DURATIONS } from '../core/constants.js';

// Rate per GB by duration (months) — Section 8.1
export const PRICE_PER_GB_BY_DURATION = Object.freeze({
  1: 5000,
  2: 6000,
  3: 6000,
  4: 8000,
  5: 8000,
  6: 8000
});

// Custom plan bounds — Section 8.2
export const CUSTOM_PLAN = Object.freeze({
  minVolume: 20,
  maxVolume: 300,
  volumeStep: 5,
  defaultVolume: 20,
  minDuration: 1,
  maxDuration: 6
});

// Fixed volumes for curated plans — Section 8.3
const SUGGESTED_VOLUMES = Object.freeze({
  1: [20, 30, 50, 60, 70],
  2: [40, 60, 70, 80],
  3: [80, 100, 120, 140]
});

// Unlimited prices — only 1M and 2M. 3-6M intentionally undefined.
const UNLIMITED_PRICES = Object.freeze({
  1: 700000,
  2: 1100000
});

export function getPricePerGB(durationMonths) {
  return PRICE_PER_GB_BY_DURATION[durationMonths] ?? null;
}

export function calculatePrice(volumeGB, durationMonths) {
  const rate = PRICE_PER_GB_BY_DURATION[durationMonths];
  const volume = Number(volumeGB);
  if (!rate || !Number.isFinite(volume) || volume <= 0) return null;
  return volume * rate;
}

export function hasSuggestedPlans(durationMonths) {
  return Boolean(SUGGESTED_VOLUMES[durationMonths]);
}

export function getSuggestedPlans(durationMonths) {
  const volumes = SUGGESTED_VOLUMES[durationMonths];
  if (!volumes) return [];
  const rate = PRICE_PER_GB_BY_DURATION[durationMonths];
  return volumes.map((volume) => ({
    id: `${durationMonths}M-${volume}GB`,
    type: 'suggested',
    duration: durationMonths,
    volume,
    pricePerGB: rate,
    price: volume * rate
  }));
}

export function hasUnlimitedPlan(durationMonths) {
  return Boolean(UNLIMITED_PRICES[durationMonths]);
}

export function getUnlimitedPlan(durationMonths) {
  const price = UNLIMITED_PRICES[durationMonths];
  if (!price) return null;
  return {
    id: `${durationMonths}M-UNLIMITED`,
    type: 'unlimited',
    duration: durationMonths,
    volume: null,
    unlimited: true,
    pricePerGB: null,
    price
  };
}

// All plans for a duration: curated + unlimited (if exists).
export function getAllPlansForDuration(durationMonths) {
  const suggested = getSuggestedPlans(durationMonths);
  const unlimited = getUnlimitedPlan(durationMonths);
  return unlimited ? [...suggested, unlimited] : suggested;
}

export function buildCustomPlan(volumeGB, durationMonths) {
  const volume = Number(volumeGB);
  const price = calculatePrice(volume, durationMonths);
  if (price === null) return null;
  return {
    id: `CUSTOM-${durationMonths}-${volume}`,
    type: 'custom',
    duration: durationMonths,
    volume,
    pricePerGB: PRICE_PER_GB_BY_DURATION[durationMonths],
    price
  };
}

// Maps duration to its rate tier — used by Custom Plan UI chips.
export function getRateTier(durationMonths) {
  if (durationMonths === 1) return 'tier-1';
  if (durationMonths === 2 || durationMonths === 3) return 'tier-2';
  if (durationMonths >= 4 && durationMonths <= 6) return 'tier-3';
  return null;
}

// Options for the Duration Selection screen.
export function getDurationOptions() {
  return DURATIONS.map((duration) => ({
    duration,
    pricePerGB: PRICE_PER_GB_BY_DURATION[duration],
    hasUnlimited: hasUnlimitedPlan(duration)
  }));
}
