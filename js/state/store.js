import { SCREENS } from '../core/constants.js';

const initialState = {
  // Navigation
  currentScreen: SCREENS.HOME,
  screenParams: null,

  // User data
  currentUser: null,
  walletBalance: 0,
  walletTransactions: [],
  notifications: [],
  currentSubscription: null,
  orders: [],

  // Purchase flow
  selectedDuration: null,
  selectedConnectionType: null,
  selectedPlan: null,

  // Payment
  paymentMethod: null,
  paymentState: 'IDLE',
  paymentResult: null,

  // UI feedback
  loading: {},
  errors: {}
};

let state = { ...initialState };
const subscribers = new Set();

function notify() {
  for (const fn of subscribers) {
    try {
      fn(state);
    } catch (err) {
      console.error('[store] Subscriber error:', err);
    }
  }
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  subscribers.add(fn);
  fn(state);
  return () => subscribers.delete(fn);
}

export function setState(patch) {
  if (typeof patch !== 'object' || patch === null) return;
  state = { ...state, ...patch };
  notify();
}

export function patch(section, values) {
  if (typeof values !== 'object' || values === null) return;
  state = { ...state, [section]: { ...state[section], ...values } };
  notify();
}

export function resetPurchaseFlow() {
  setState({
    selectedDuration: null,
    selectedConnectionType: null,
    selectedPlan: null,
    paymentResult: null
  });
}

export function reset() {
  state = { ...initialState };
  notify();
}
