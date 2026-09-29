export function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isPositiveInteger(v) {
  return isFiniteNumber(v) && Number.isInteger(v) && v > 0;
}

export function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// Only allow safe IDs from URLs / route params (alphanumeric + dash + underscore).
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidId(value) {
  if (typeof value !== 'string') return false;
  return SAFE_ID_PATTERN.test(value.trim());
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

// ---------- Image Signature (Magic Bytes) ----------
// Verifies the file actually starts with image bytes, not just claims to be an image.
const IMAGE_SIGNATURES = [
  { name: 'jpeg', test: (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { name: 'png',  test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
  {
    name: 'webp',
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50  // WEBP
  }
];

export async function hasValidImageSignature(file) {
  try {
    const buf = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buf);
    return IMAGE_SIGNATURES.some((sig) => sig.test(bytes));
  } catch {
    return false;
  }
}
