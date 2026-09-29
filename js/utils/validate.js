export function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isPositiveInteger(v) {
  return isFiniteNumber(v) && Number.isInteger(v) && v > 0;
}

export function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// Action lock — prevents double submit on sensitive operations.
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
