import { APP } from '../core/config.js';

const numberFormatter = new Intl.NumberFormat('en-US');

export function formatNumber(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return '';
  return numberFormatter.format(value);
}

export function formatPrice(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  return `${formatNumber(value)} ${APP.currency}`;
}

export function formatVolume(gb) {
  const value = Number(gb);
  if (!Number.isFinite(value)) return '';
  return `${formatNumber(value)} گیگابایت`;
}

export function formatDuration(months) {
  const value = Number(months);
  if (!Number.isFinite(value)) return '';
  return `${formatNumber(value)} ماهه`;
}

const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function formatDate(input) {
  if (!input) return '';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return dateFormatter.format(date);
}

export function usagePercent(used, total) {
  const u = Number(used);
  const t = Number(total);
  if (!Number.isFinite(u) || !Number.isFinite(t) || t <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((u / t) * 100)));
}
