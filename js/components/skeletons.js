import { el } from '../utils/dom.js';

const sk = (variant, extra = {}) => el('div', {
  class: `pulse-skeleton pulse-skeleton--${variant}`,
  ...extra
});

const planRow = () =>
  el('div', { class: 'pulse-skeleton-plan' }, [
    el('div', { class: 'pulse-skeleton pulse-skeleton--circle pulse-skeleton-plan__radio' }),
    el('div', { class: 'pulse-skeleton-plan__body' }, [
      sk('text', { style: 'width: 45%' }),
      sk('text', { style: 'width: 65%; height: 11px' })
    ]),
    el('div', { class: 'pulse-skeleton pulse-skeleton--text pulse-skeleton-plan__price' })
  ]);

const listRow = () =>
  el('div', { class: 'pulse-skeleton-row' }, [
    el('div', { class: 'pulse-skeleton pulse-skeleton--circle pulse-skeleton-row__icon' }),
    el('div', { class: 'pulse-skeleton-row__body' }, [
      sk('text', { style: 'width: 50%' }),
      sk('text', { style: 'width: 30%; height: 11px' })
    ]),
    el('div', { class: 'pulse-skeleton pulse-skeleton--text pulse-skeleton-row__end' })
  ]);

const cardBlock = () =>
  el('div', { class: 'pulse-skeleton-card' }, [
    el('div', { class: 'pulse-skeleton pulse-skeleton-card__title' }),
    sk('text'),
    sk('text', { class: 'pulse-skeleton-card__line pulse-skeleton-card__line--mid' }),
    sk('text', { class: 'pulse-skeleton-card__line pulse-skeleton-card__line--short' })
  ]);

const walletHero = () =>
  el('div', { class: 'pulse-skeleton-card' }, [
    sk('text', { style: 'width: 35%; height: 12px' }),
    sk('title', { style: 'width: 55%; height: 26px' }),
    el('div', { class: 'pulse-skeleton pulse-skeleton--text', style: 'height: 48px; border-radius: 14px' })
  ]);

export function plansSkeleton(count = 4) {
  const wrap = el('div', { class: 'pulse-page-row' });
  for (let i = 0; i < count; i++) wrap.appendChild(planRow());
  return wrap;
}

export function listSkeleton(count = 3) {
  const wrap = el('div', { class: 'pulse-page-row' });
  for (let i = 0; i < count; i++) wrap.appendChild(listRow());
  return wrap;
}

export function cardSkeleton() {
  const wrap = el('div', { class: 'pulse-page-section' });
  wrap.appendChild(cardBlock());
  return wrap;
}

export function walletHeroSkeleton() {
  const wrap = el('div', { class: 'pulse-page-section' });
  wrap.appendChild(walletHero());
  return wrap;
}
