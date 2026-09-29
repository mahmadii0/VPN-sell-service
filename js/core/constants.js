export const SCREENS = Object.freeze({
  HOME:             'home',
  DURATION:         'duration',
  CONNECTION_TYPE:  'connection-type',
  PLANS:            'plans',
  CHECKOUT:         'checkout',
  PAYMENT_RESULT:   'payment-result',
  MY_SUBSCRIPTION:  'my-subscription',
  MY_PURCHASES:     'my-purchases',
  WALLET:           'wallet',
  ACCOUNT:          'account',
  SUPPORT:          'support',
  GUIDE:            'guide',
  NOTIFICATIONS:    'notifications'
});

export const BOTTOM_NAV_ITEMS = Object.freeze([
  Object.freeze({ id: 'home',    label: 'خانه',     icon: 'home',   screen: SCREENS.HOME }),
  Object.freeze({ id: 'buy',     label: 'خرید',     icon: 'cart',   screen: SCREENS.DURATION }),
  Object.freeze({ id: 'wallet',  label: 'کیف پول', icon: 'wallet', screen: SCREENS.WALLET }),
  Object.freeze({ id: 'account', label: 'پروفایل',  icon: 'user',   screen: SCREENS.ACCOUNT })
]);

export const PAYMENT_STATE = Object.freeze({
  IDLE:                   'IDLE',
  CHECKING_ORDER:         'CHECKING_ORDER',
  READY_FOR_PAYMENT:      'READY_FOR_PAYMENT',
  PAYMENT_PENDING:        'PAYMENT_PENDING',
  WAITING_ADMIN_APPROVAL: 'WAITING_ADMIN_APPROVAL',
  PAYMENT_SUCCESS:        'PAYMENT_SUCCESS',
  PAYMENT_FAILED:         'PAYMENT_FAILED',
  PAYMENT_CANCELLED:      'PAYMENT_CANCELLED',
  PAYMENT_TIMEOUT:        'PAYMENT_TIMEOUT',
  UNKNOWN_STATE:          'UNKNOWN_STATE'
});

export const PAYMENT_METHOD = Object.freeze({
  WALLET:       'wallet',
  CARD_TO_CARD: 'card_to_card'
});

export const ORDER_STATUS = Object.freeze({
  PENDING:   'pending',
  PAID:      'paid',
  FAILED:    'failed',
  CANCELLED: 'cancelled',
  REFUNDED:  'refunded'
});

export const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE:  'active',
  EXPIRED: 'expired',
  PENDING: 'pending'
});

export const TX_STATUS = Object.freeze({
  SUCCESS: 'success',
  PENDING: 'pending',
  FAILED:  'failed'
});

export const LOCK_KEYS = Object.freeze({
  PAYMENT:       'payment',
  ORDER_CREATE:  'order-create',
  WALLET_CHARGE: 'wallet-charge',
  RECEIPT_UPLOAD: 'receipt-upload'
});

export const TOAST_VARIANT = Object.freeze({
  SUCCESS: 'success',
  ERROR:   'error',
  WARNING: 'warning',
  INFO:    'info'
});

// Card accounts — used in the upcoming card-to-card payment commit.
export const CARD_ACCOUNTS = Object.freeze([
  Object.freeze({
    id: 1,
    holder: 'محمد احمدی',
    number: '6219-8619-4194-0297',
    numberRaw: '6219861941940297'
  }),
  Object.freeze({
    id: 2,
    holder: 'رضا کیوان‌پور',
    number: '5022-2916-2179-7818',
    numberRaw: '5022291621797818'
  })
]);
