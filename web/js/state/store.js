import { SCREENS } from '../core/constants.js';

const initialState = {
  currentScreen: SCREENS.HOME,
  screenParams: null,

  currentUser: null,
  shopPackages: [],
  cardNumber: '',
  walletBalance: 0,
  walletTransactions: [],
  notifications: [],
  currentSubscription: null,
  orders: [],

  selectedDuration: null,
  selectedConnectionType: null,
  selectedPlan: null,

  paymentMethod: null,
  paymentState: 'IDLE',
  paymentResult: null,

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
