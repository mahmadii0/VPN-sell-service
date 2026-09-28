// PULSE VPN — Application Constants

export const SCREENS = Object.freeze({
  HOME:             'home',
  DURATION:         'duration',
  SUGGESTED_PLANS:  'suggested-plans',
  CUSTOM_PLAN:      'custom-plan',
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
  Object.freeze({ id: 'home',   label: 'خانه',     icon: 'home',   screen: SCREENS.HOME }),
  Object.freeze({ id: 'buy',    label: 'خرید',     icon: 'cart',   screen: SCREENS.DURATION }),
  Object.freeze({ id: 'wallet', label: 'کیف پول', icon: 'wallet', screen: SCREENS.WALLET }),
  Object.freeze({ id: 'account',label: 'پروفایل',  icon: 'user',   screen: SCREENS.ACCOUNT })
]);


export const PAYMENT_STATE = Object.freeze({
  IDLE:              'IDLE',
  CHECKING_ORDER:    'CHECKING_ORDER',
  READY_FOR_PAYMENT: 'READY_FOR_PAYMENT',
  PAYMENT_PENDING:   'PAYMENT_PENDING',
  PAYMENT_SUCCESS:   'PAYMENT_SUCCESS',
  PAYMENT_FAILED:    'PAYMENT_FAILED',
  PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
  PAYMENT_TIMEOUT:   'PAYMENT_TIMEOUT',
  UNKNOWN_STATE:     'UNKNOWN_STATE'
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


export const PLAN_TYPE = Object.freeze({
  SUGGESTED: 'suggested',
  CUSTOM:    'custom',
  UNLIMITED: 'unlimited'
});


export const DURATIONS = Object.freeze([1, 2, 3, 4, 5, 6]);


export const LOCK_KEYS = Object.freeze({
  PAYMENT:       'payment',
  ORDER_CREATE:  'order-create',
  WALLET_CHARGE: 'wallet-charge'
});


export const TOAST_VARIANT = Object.freeze({
  SUCCESS: 'success',
  ERROR:   'error',
  WARNING: 'warning',
  INFO:    'info'
});
