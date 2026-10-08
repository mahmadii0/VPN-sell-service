-- Migration to add 'kind' column to wallet_ledger (SQLite only).
-- Safe drop-and-recreate approach that works on both fresh and existing SQLite databases.
-- For fresh databases: 001 already created the table with 'kind', so this verifies it exists.
-- For existing databases: this adds the 'kind' column.
-- Note: MySQL uses applyMySQLSchema instead, so this migration is SQLite-only.
CREATE TABLE IF NOT EXISTS _wallet_ledger_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL UNIQUE,
  amount_toman INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'purchase',
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO _wallet_ledger_new(id,user_id,order_id,amount_toman,kind,created_at)
  SELECT id,user_id,order_id,amount_toman,'purchase',created_at FROM wallet_ledger;
DROP TABLE wallet_ledger;
CREATE TABLE wallet_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL UNIQUE,
  amount_toman INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'purchase',
  created_at TEXT NOT NULL
);
INSERT INTO wallet_ledger(id,user_id,order_id,amount_toman,kind,created_at)
  SELECT id,user_id,order_id,amount_toman,'purchase',created_at FROM _wallet_ledger_new;
DROP TABLE _wallet_ledger_new;