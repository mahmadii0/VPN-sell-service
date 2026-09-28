import { APP } from '../core/config.js';
import { SCREENS } from '../core/constants.js';
import { getState } from '../state/store.js';
import { formatPrice, formatNumber, usagePercent } from '../utils/format.js';
import { iconNode } from '../components/icons.js';
import { Button, Card, Chip, EmptyState, Progress } from '../components/ui.js';
import { el } from '../utils/dom.js';
import { navigate } from '../core/router.js';

export function renderHome() {
  const { currentUser, walletBalance, currentSubscription } = getState();

  return el('div', { class: 'pulse-page' }, [
    HomeHeader(currentUser),
    WalletCard(walletBalance),
    SubscriptionSection(currentSubscription),
    PrimaryCTA(),
    QuickActions()
  ]);
}

function HomeHeader(user) {
  const initial = (user?.firstName?.[0] || 'پ').toUpperCase();

  return el('header', { class: 'pulse-home-header' }, [
    el('img', {
      src: 'assets/images/pulse-logo.jpg',
      alt: 'PULSE VPN',
      class: 'pulse-home-header__logo',
      width: 40,
      height: 40,
      decoding: 'async'
    }),
    el('div', { class: 'pulse-home-header__info' }, [
      el('div', { class: 'pulse-home-header__name' }, APP.nameEn),
      el('div', { class: 'pulse-home-header__tagline' }, APP.tagline)
    ]),
    el('button', {
      type: 'button',
      class: 'pulse-icon-btn',
      'aria-label': 'اعلان‌ها',
      onClick: () => navigate(SCREENS.NOTIFICATIONS)
    }, [iconNode('bell', { size: 20 })]),
    el('button', {
      type: 'button',
      class: 'pulse-home-header__avatar',
      'aria-label': 'پروفایل',
      onClick: () => navigate(SCREENS.ACCOUNT)
    }, [
      el('div', { class: 'pulse-avatar pulse-avatar--md' }, initial)
    ])
  ]);
}

function WalletCard(balance) {
  return el('div', { class: 'pulse-card pulse-wallet-card' }, [
    el('div', { class: 'pulse-wallet-card__icon' }, [iconNode('wallet', { size: 22 })]),
    el('div', { class: 'pulse-wallet-card__body' }, [
      el('div', { class: 'pulse-wallet-card__label' }, 'موجودی کیف پول'),
      el('div', { class: 'pulse-wallet-card__balance pulse-num' }, formatPrice(balance))
    ]),
    Button({
      label: 'شارژ',
      variant: 'accent',
      size: 'sm',
      onClick: () => navigate(SCREENS.WALLET)
    })
  ]);
}

function SubscriptionSection(sub) {
  const section = el('section', { class: 'pulse-page-section' });

  if (!sub) {
    section.appendChild(
      Card({
        children: [
          EmptyState({
            iconName: 'package',
            title: 'هنوز اشتراکی نداری',
            text: 'با خرید اولین اشتراک، اتصال امن و پرسرعت را تجربه کن.',
            actionLabel: 'خرید اولین اشتراک',
            onAction: () => navigate(SCREENS.DURATION)
          })
        ]
      })
    );
    return section;
  }

  const used = Number(sub.usedGB) || 0;
  const total = Number(sub.totalGB) || 0;
  const daysLeft = Number(sub.daysLeft) || 0;
  const pct = usagePercent(used, total);

  section.appendChild(
    Card({
      children: [
        el('div', { class: 'pulse-sub-card__header' }, [
          el('div', { class: 'pulse-sub-card__title' }, 'اشتراک فعال'),
          Chip({ label: 'فعال', variant: 'active', dot: true })
        ]),
        el('div', { class: 'pulse-sub-card__row' }, [
          el('span', { class: 'pulse-sub-card__muted' }, 'مصرف'),
          el('span', { class: 'pulse-sub-card__value pulse-num' },
            `${formatNumber(used)} از ${formatNumber(total)} گیگابایت`)
        ]),
        Progress({ value: pct }),
        el('div', { class: 'pulse-sub-card__row pulse-sub-card__row--spaced' }, [
          el('span', { class: 'pulse-sub-card__muted' }, 'زمان باقی‌مانده'),
          el('span', { class: 'pulse-sub-card__value pulse-num' },
            `${formatNumber(daysLeft)} روز`)
        ])
      ]
    })
  );

  return section;
}

function PrimaryCTA() {
  return el('div', { class: 'pulse-page-section' }, [
    Button({
      label: 'خرید اشتراک',
      variant: 'primary',
      size: 'lg',
      block: true,
      iconName: 'sparkles',
      onClick: () => navigate(SCREENS.DURATION)
    })
  ]);
}

function QuickActions() {
  const items = [
    { icon: 'shield',   label: 'اشتراک من',  screen: SCREENS.MY_SUBSCRIPTION },
    { icon: 'package',  label: 'خریدهای من', screen: SCREENS.MY_PURCHASES },
    { icon: 'wallet',   label: 'کیف پول',    screen: SCREENS.WALLET },
    { icon: 'lifeBuoy', label: 'پشتیبانی',   screen: SCREENS.SUPPORT }
  ];

  return el('div', { class: 'pulse-quick-actions' },
    items.map((item) =>
      el('button', {
        type: 'button',
        class: 'pulse-quick-action',
        'aria-label': item.label,
        onClick: () => navigate(item.screen)
      }, [
        el('div', { class: 'pulse-quick-action__icon' }, [iconNode(item.icon, { size: 18 })]),
        el('span', {}, item.label)
      ])
    )
  );
}
