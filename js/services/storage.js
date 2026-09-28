const NAMESPACE = 'pulse';

function key(k) {
  return `${NAMESPACE}:${k}`;
}

export function set(k, value) {
  try {
    const json = JSON.stringify(value);
    localStorage.setItem(key(k), json);
    return true;
  } catch (err) {
    console.warn('[storage] set failed:', err);
    return false;
  }
}

export function get(k, fallback = null) {
  try {
    const raw = localStorage.getItem(key(k));
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[storage] get failed:', err);
    return fallback;
  }
}

export function remove(k) {
  try {
    localStorage.removeItem(key(k));
    return true;
  } catch {
    return false;
  }
}

export function clear() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${NAMESPACE}:`))
      .forEach((k) => localStorage.removeItem(k));
    return true;
  } catch {
    return false;
  }
}
