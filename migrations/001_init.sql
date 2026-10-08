CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  wallet_toman INTEGER NOT NULL DEFAULT 0 CHECK(wallet_toman >= 0)
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(telegram_id),
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  price_toman INTEGER NOT NULL CHECK(price_toman > 0),
  receipt_path TEXT NOT NULL,
  receipt_mime TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by INTEGER,
  panel_client_id INTEGER,
  panel_email TEXT,
  panel_inbound_id INTEGER,
  panel_sub_id TEXT,
  assigned_at TEXT,
  assigned_by INTEGER,
  delivered_at TEXT,
  delivery_error TEXT,
  notification_error TEXT,
  CHECK ((panel_client_id IS NULL AND panel_email IS NULL AND panel_inbound_id IS NULL AND panel_sub_id IS NULL)
    OR (panel_client_id IS NOT NULL AND panel_email IS NOT NULL AND panel_inbound_id IS NOT NULL AND panel_sub_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, id DESC);
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(telegram_id),
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  amount_toman INTEGER NOT NULL CHECK(amount_toman = 10000),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS match_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  panel_client_id INTEGER NOT NULL,
  panel_email TEXT NOT NULL,
  panel_inbound_id INTEGER NOT NULL,
  panel_sub_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS match_candidates_order ON match_candidates(order_id);
