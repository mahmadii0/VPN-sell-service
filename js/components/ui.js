import { icon, iconNode } from './icons.js';
import { el } from '../utils/dom.js';

// ---------- Button ----------
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  iconName = null,
  onClick = null,
  type = 'button'
} = {}) {
  const classes = ['pulse-btn', `pulse-btn--${variant}`];
  if (size === 'sm') classes.push('pulse-btn--sm');
  if (size === 'lg') classes.push('pulse-btn--lg');
  if (block) classes.push('pulse-btn--block');
  if (loading) classes.push('is-loading');

  const btn = el('button', {
    type,
    class: classes.join(' '),
    disabled: disabled || loading
  });

  if (iconName) btn.appendChild(iconNode(iconName, { size: 18 }));
  if (label) {
    const span = el('span', {}, label);
    btn.appendChild(span);
  }

  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

// ---------- Card ----------
export function Card({
  variant = 'default',
  interactive = false,
  onClick = null,
  children = []
} = {}) {
  const classes = ['pulse-card'];
  if (variant === 'selected') classes.push('pulse-card--selected');
  if (variant === 'gradient') classes.push('pulse-card--gradient');
  if (variant === 'elevated') classes.push('pulse-card--elevated');
  if (interactive) classes.push('pulse-card--interactive');

  const card = el('div', { class: classes.join(' ') }, children);
  if (onClick && interactive) {
    card.addEventListener('click', onClick);
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
  }
  return card;
}

// ---------- Chip ----------
export function Chip({ label, variant = 'neutral', dot = false } = {}) {
  const chip = el('span', { class: `pulse-chip pulse-chip--${variant}` });
  if (dot) chip.appendChild(el('span', { class: 'pulse-chip__dot' }));
  chip.appendChild(el('span', {}, label));
  return chip;
}

// ---------- Toast ----------
let toastHost = null;

function ensureToastHost() {
  if (toastHost && toastHost.isConnected) return toastHost;
  toastHost = el('div', { class: 'pulse-toast-host', role: 'status', 'aria-live': 'polite' });
  (document.body || document.documentElement).appendChild(toastHost);
  return toastHost;
}

export function toast(message, { variant = 'info', duration = 3500 } = {}) {
  const host = ensureToastHost();
  const iconMap = {
    success: 'checkCircle',
    error: 'xCircle',
    warning: 'alertCircle',
    info: 'info'
  };

  const node = el('div', { class: `pulse-toast pulse-toast--${variant}` }, [
    el('div', { class: 'pulse-toast__icon' }, [iconNode(iconMap[variant] || 'info', { size: 18 })]),
    el('div', { class: 'pulse-toast__text' }, message)
  ]);

  host.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-open'));

  const remove = () => {
    node.classList.remove('is-open');
    setTimeout(() => node.remove(), 250);
  };

  const timer = setTimeout(remove, duration);
  node.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });

  return remove;
}

// ---------- Modal ----------
export function Modal({
  title,
  body,
  confirmLabel = 'تایید',
  cancelLabel = 'انصراف',
  onConfirm = null,
  onCancel = null
} = {}) {
  const backdrop = el('div', { class: 'pulse-modal-backdrop', role: 'dialog', 'aria-modal': 'true' });

  const close = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => backdrop.remove(), 250);
    document.body.classList.remove('no-scroll');
  };

  const confirmBtn = Button({
    label: confirmLabel,
    variant: 'primary',
    onClick: () => {
      if (onConfirm) onConfirm();
      close();
    }
  });

  const cancelBtn = Button({
    label: cancelLabel,
    variant: 'secondary',
    onClick: () => {
      if (onCancel) onCancel();
      close();
    }
  });

  const modal = el('div', { class: 'pulse-modal' }, [
    el('div', { class: 'pulse-modal__title' }, title),
    el('div', { class: 'pulse-modal__body' }, body),
    el('div', { class: 'pulse-modal__actions' }, [cancelBtn, confirmBtn])
  ]);

  backdrop.appendChild(modal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  document.body.appendChild(backdrop);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  return { close };
}

// ---------- Bottom Sheet ----------
export function BottomSheet({ title, content } = {}) {
  const backdrop = el('div', { class: 'pulse-sheet-backdrop' });

  const close = () => {
    sheet.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 320);
    document.body.classList.remove('no-scroll');
  };

  const sheet = el('div', { class: 'pulse-sheet', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'pulse-sheet__handle' }),
    el('div', { class: 'pulse-sheet__header' }, [
      el('div', { class: 'pulse-sheet__title' }, title),
      el('button', { class: 'pulse-icon-btn', 'aria-label': 'بستن', html: icon('x', { size: 20 }), onClick: close })
    ]),
    el('div', { class: 'pulse-sheet__body' }, content)
  ]);

  backdrop.addEventListener('click', close);

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  return { close };
}

// ---------- Skeleton ----------
export function Skeleton({ variant = 'text', width = null, height = null } = {}) {
  const style = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;
  const node = el('div', { class: `pulse-skeleton pulse-skeleton--${variant}` });
  Object.assign(node.style, style);
  return node;
}

// ---------- Empty State ----------
export function EmptyState({
  iconName = 'package',
  title,
  text,
  actionLabel = null,
  onAction = null
} = {}) {
  const children = [
    el('div', { class: 'pulse-empty__icon' }, [iconNode(iconName, { size: 30 })]),
    el('div', { class: 'pulse-empty__title' }, title),
    el('div', { class: 'pulse-empty__text' }, text)
  ];

  if (actionLabel && onAction) {
    children.push(Button({ label: actionLabel, variant: 'primary', onClick: onAction }));
  }

  return el('div', { class: 'pulse-empty' }, children);
}

// ---------- Progress Bar ----------
export function Progress({ value = 0, variant = 'default' } = {}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const cls = ['pulse-progress__fill'];
  if (variant === 'warning') cls.push('pulse-progress__fill--warning');
  if (variant === 'danger') cls.push('pulse-progress__fill--danger');
  const fill = el('div', { class: cls.join(' ') });
  fill.style.width = `${pct}%`;
  return el('div', { class: 'pulse-progress' }, [fill]);
}