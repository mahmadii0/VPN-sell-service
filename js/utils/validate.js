import { CUSTOM_PLAN } from '../pricing/pricing.js';

export function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isPositiveInteger(v) {
  return isFiniteNumber(v) && Number.isInteger(v) && v > 0;
}

export function validateVolume(volume) {
  const v = Number(volume);
  if (!Number.isFinite(v)) return { valid: false, reason: 'not-a-number' };
  if (v < CUSTOM_PLAN.minVolume) return { valid: false, reason: 'too-small' };
  if (v > CUSTOM_PLAN.maxVolume) return { valid: false, reason: 'too-large' };
  if (v % CUSTOM_PLAN.volumeStep !== 0) return { valid: false, reason: 'not-multiple' };
  return { valid: true };
}

export function validateDuration(duration) {
  const d = Number(duration);
  if (!Number.isInteger(d) || d <= 0) return { valid: false, reason: 'not-a-number' };
  if (d < CUSTOM_PLAN.minDuration) return { valid: false, reason: 'too-small' };
  if (d > CUSTOM_PLAN.maxDuration) return { valid: false, reason: 'too-large' };
  return { valid: true };
}

// Clamps to [min, max] and snaps to the nearest valid step.
export function clampVolume(volume) {
  const n = Number(volume);
  if (!Number.isFinite(n)) return CUSTOM_PLAN.defaultVolume;
  const clamped = Math.min(Math.max(n, CUSTOM_PLAN.minVolume), CUSTOM_PLAN.maxVolume);
  const stepped = Math.round(clamped / CUSTOM_PLAN.volumeStep) * CUSTOM_PLAN.volumeStep;
  return Math.min(Math.max(stepped, CUSTOM_PLAN.minVolume), CUSTOM_PLAN.maxVolume);
}

// Action lock — Section 10.3
const activeLocks = new Set();

export function acquireLock(key) {
  if (activeLocks.has(key)) return false;
  activeLocks.add(key);
  return true;
}

export function releaseLock(key) {
  activeLocks.delete(key);
}

export function isLocked(key) {
  return activeLocks.has(key);
}
