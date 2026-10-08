package main

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

var ErrConflict = errors.New("order is in an incompatible state")

type Store struct {
	DB     *sql.DB
	Driver string
}
type Order struct {
	ID                int64          `json:"id"`
	UserID            int64          `json:"-"`
	PackageID         string         `json:"package_id"`
	PackageName       string         `json:"package_name"`
	PriceToman        int64          `json:"price_toman"`
	ReceiptPath       string         `json:"-"`
	ReceiptMIME       string         `json:"-"`
	Status            string         `json:"status"`
	CreatedAt         string         `json:"created_at"`
	PanelClientID     sql.NullInt64  `json:"-"`
	PanelEmail        sql.NullString `json:"-"`
	PanelInboundID    sql.NullInt64  `json:"-"`
	PanelSubID        sql.NullString `json:"-"`
	DeliveredAt       sql.NullString `json:"-"`
	DeliveryError     sql.NullString `json:"-"`
	NotificationError sql.NullString `json:"-"`
}

func (o Order) MarshalJSON() ([]byte, error) {
	type orderJSON struct {
		ID                int64  `json:"id"`
		PackageID         string `json:"package_id"`
		PackageName       string `json:"package_name"`
		PriceToman        int64  `json:"price_toman"`
		Status            string `json:"status"`
		CreatedAt         string `json:"created_at"`
		PanelClientID     any    `json:"panel_client_id,omitempty"`
		PanelEmail        any    `json:"panel_email,omitempty"`
		PanelInboundID    any    `json:"panel_inbound_id,omitempty"`
		PanelSubID        any    `json:"panel_sub_id,omitempty"`
		DeliveredAt       any    `json:"delivered_at,omitempty"`
		DeliveryError     any    `json:"delivery_error,omitempty"`
		NotificationError any    `json:"notification_error,omitempty"`
	}
	out := orderJSON{
		ID:                o.ID,
		PackageID:         o.PackageID,
		PackageName:       o.PackageName,
		PriceToman:        o.PriceToman,
		Status:            o.Status,
		CreatedAt:         o.CreatedAt,
		PanelClientID:     nil,
		PanelEmail:        nil,
		PanelInboundID:    nil,
		PanelSubID:        nil,
		DeliveredAt:       nil,
		DeliveryError:     nil,
		NotificationError: nil,
	}
	if o.PanelClientID.Valid {
		out.PanelClientID = o.PanelClientID.Int64
	}
	if o.PanelEmail.Valid {
		out.PanelEmail = o.PanelEmail.String
	}
	if o.PanelInboundID.Valid {
		out.PanelInboundID = o.PanelInboundID.Int64
	}
	if o.PanelSubID.Valid {
		out.PanelSubID = o.PanelSubID.String
	}
	if o.DeliveredAt.Valid {
		out.DeliveredAt = o.DeliveredAt.String
	}
	if o.DeliveryError.Valid {
		out.DeliveryError = o.DeliveryError.String
	}
	if o.NotificationError.Valid {
		out.NotificationError = o.NotificationError.String
	}
	return json.Marshal(out)
}

const orderColumns = `id,user_id,package_id,package_name,price_toman,receipt_path,receipt_mime,status,created_at,panel_client_id,panel_email,panel_inbound_id,panel_sub_id,delivered_at,delivery_error,notification_error`

func scanOrder(row interface{ Scan(...any) error }) (Order, error) {
	var o Order
	e := row.Scan(&o.ID, &o.UserID, &o.PackageID, &o.PackageName, &o.PriceToman, &o.ReceiptPath, &o.ReceiptMIME, &o.Status, &o.CreatedAt, &o.PanelClientID, &o.PanelEmail, &o.PanelInboundID, &o.PanelSubID, &o.DeliveredAt, &o.DeliveryError, &o.NotificationError)
	return o, e
}
func openStore(driver, dsn string) (*Store, error) {
	if driver == "" {
		return nil, errors.New("database driver is required")
	}
	if dsn == "" {
		return nil, errors.New("database DSN is required")
	}
	db, e := sql.Open(driver, dsn)
	if e != nil {
		return nil, e
	}
	switch driver {
	case "sqlite", "modernc.org/sqlite":
		db.SetMaxOpenConns(1)
		for _, pragma := range []string{"PRAGMA foreign_keys=ON", "PRAGMA journal_mode=WAL", "PRAGMA busy_timeout=5000"} {
			if _, e = db.Exec(pragma); e != nil {
				db.Close()
				return nil, e
			}
		}
		if e = applyMigrations(db); e != nil {
			db.Close()
			return nil, e
		}
	case "mysql":
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(10)
		if e = applyMySQLSchema(db); e != nil {
			db.Close()
			return nil, e
		}
	default:
		db.Close()
		return nil, fmt.Errorf("unsupported database driver: %s", driver)
	}
	return &Store{DB: db, Driver: driver}, nil
}

func applyMySQLSchema(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			telegram_id BIGINT PRIMARY KEY,
			wallet_toman BIGINT NOT NULL DEFAULT 0
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS orders (
			id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			user_id BIGINT NOT NULL,
			package_id VARCHAR(64) NOT NULL,
			package_name VARCHAR(255) NOT NULL,
			price_toman BIGINT NOT NULL,
			receipt_path TEXT NOT NULL,
			receipt_mime VARCHAR(64) NOT NULL,
			status VARCHAR(16) NOT NULL DEFAULT 'pending',
			created_at VARCHAR(40) NOT NULL,
			reviewed_at VARCHAR(40) NULL,
			reviewed_by BIGINT NULL,
			panel_client_id BIGINT NULL,
			panel_email TEXT NULL,
			panel_inbound_id BIGINT NULL,
			panel_sub_id TEXT NULL,
			assigned_at VARCHAR(40) NULL,
			assigned_by BIGINT NULL,
			delivered_at VARCHAR(40) NULL,
			delivery_error TEXT NULL,
			notification_error TEXT NULL,
			KEY orders_user (user_id, id),
			CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users(telegram_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS wallet_ledger (
			id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			user_id BIGINT NOT NULL,
			order_id BIGINT NOT NULL,
			amount_toman BIGINT NOT NULL,
			kind VARCHAR(16) NOT NULL DEFAULT 'purchase',
			created_at VARCHAR(40) NOT NULL,
			UNIQUE KEY wallet_ledger_order (order_id),
			KEY wallet_ledger_user (user_id, id),
			CONSTRAINT wallet_ledger_user_fk FOREIGN KEY (user_id) REFERENCES users(telegram_id),
			CONSTRAINT wallet_ledger_order_fk FOREIGN KEY (order_id) REFERENCES orders(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS match_candidates (
			id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			order_id BIGINT NOT NULL,
			panel_client_id BIGINT NOT NULL,
			panel_email TEXT NOT NULL,
			panel_inbound_id BIGINT NOT NULL,
			panel_sub_id TEXT NOT NULL,
			created_at VARCHAR(40) NOT NULL,
			KEY match_candidates_order (order_id),
			CONSTRAINT match_candidates_order_fk FOREIGN KEY (order_id) REFERENCES orders(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS bot_events (
			id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			order_id BIGINT NOT NULL,
			kind VARCHAR(16) NOT NULL,
			created_at VARCHAR(40) NOT NULL,
			delivered_at VARCHAR(40) NULL,
			KEY bot_events_pending (delivered_at, id),
			CONSTRAINT bot_events_order_fk FOREIGN KEY (order_id) REFERENCES orders(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	}
	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	// Existing installations may predate the `kind` column; add it if missing.
	// New installations already get it from the CREATE TABLE above.
	if _, err := db.Exec("ALTER TABLE wallet_ledger ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'purchase'"); err != nil {
		if !strings.Contains(err.Error(), "Duplicate column name") && !strings.Contains(err.Error(), "already exists") {
			return err
		}
	}
	return nil
}
func applyMigrations(db *sql.DB) error {
	if _, e := db.Exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)"); e != nil {
		return e
	}
	entries, e := migrations.ReadDir("migrations")
	if e != nil {
		return e
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		version, e := strconv.Atoi(strings.SplitN(entry.Name(), "_", 2)[0])
		if e != nil {
			return e
		}
		var exists int
		e = db.QueryRow("SELECT 1 FROM schema_migrations WHERE version=?", version).Scan(&exists)
		if e == nil {
			continue
		}
		if !errors.Is(e, sql.ErrNoRows) {
			return e
		}
		ddl, e := migrations.ReadFile(filepath.ToSlash(filepath.Join("migrations", entry.Name())))
		if e != nil {
			return e
		}
		tx, e := db.Begin()
		if e != nil {
			return e
		}
		if _, e = tx.Exec(string(ddl)); e == nil {
			_, e = tx.Exec("INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)", version, utc())
		}
		if e != nil {
			tx.Rollback()
			return e
		}
		if e = tx.Commit(); e != nil {
			return e
		}
	}
	return nil
}
func utc() string { return time.Now().UTC().Format(time.RFC3339Nano) }
func (s *Store) ensureUser(ctx context.Context, tx *sql.Tx, user int64) error {
	switch s.Driver {
	case "mysql":
		_, e := tx.ExecContext(ctx, "INSERT IGNORE INTO users(telegram_id) VALUES(?)", user)
		return e
	case "sqlite", "modernc.org/sqlite":
		_, e := tx.ExecContext(ctx, "INSERT OR IGNORE INTO users(telegram_id) VALUES(?)", user)
		return e
	default:
		return fmt.Errorf("unsupported database driver: %s", s.Driver)
	}
}

func (s *Store) ensureLedgerEntry(ctx context.Context, tx *sql.Tx, user, orderID int64, kind string, amountToman int64) (bool, error) {
	switch s.Driver {
	case "mysql":
		r, e := tx.ExecContext(ctx, "INSERT IGNORE INTO wallet_ledger(user_id,order_id,amount_toman,kind,created_at) VALUES(?,?,?,?,?)", user, orderID, amountToman, kind, utc())
		if e != nil {
			return false, e
		}
		n, e := r.RowsAffected()
		if e != nil {
			return false, e
		}
		return n == 1, nil
	case "sqlite", "modernc.org/sqlite":
		// Explicit existence check: INSERT OR IGNORE also swallows CHECK failures.
		var exists int
		if e := tx.QueryRowContext(ctx, "SELECT 1 FROM wallet_ledger WHERE order_id=?", orderID).Scan(&exists); e == nil {
			return false, nil
		}
		r, e := tx.ExecContext(ctx, "INSERT INTO wallet_ledger(user_id,order_id,amount_toman,kind,created_at) VALUES(?,?,?,?,?)", user, orderID, amountToman, kind, utc())
		if e != nil {
			return false, e
		}
		n, e := r.RowsAffected()
		if e != nil {
			return false, e
		}
		return n == 1, nil
	default:
		return false, fmt.Errorf("unsupported database driver: %s", s.Driver)
	}
}

func (s *Store) CreateOrder(ctx context.Context, user int64, p Package, path, mime string) (int64, error) {
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return 0, e
	}
	defer tx.Rollback()
	if e = s.ensureUser(ctx, tx, user); e != nil {
		return 0, e
	}
	r, e := tx.ExecContext(ctx, "INSERT INTO orders(user_id,package_id,package_name,price_toman,receipt_path,receipt_mime,created_at) VALUES(?,?,?,?,?,?,?)", user, p.ID, p.Name, p.PriceToman, path, mime, utc())
	if e != nil {
		return 0, e
	}
	id, e := r.LastInsertId()
	if e != nil {
		return 0, e
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO bot_events(order_id,kind,created_at) VALUES(?,'created',?)", id, utc()); e != nil {
		return 0, e
	}
	return id, tx.Commit()
}
func (s *Store) Order(ctx context.Context, id int64) (Order, error) {
	return scanOrder(s.DB.QueryRowContext(ctx, "SELECT "+orderColumns+" FROM orders WHERE id=?", id))
}
func (s *Store) UserOrder(ctx context.Context, user, id int64) (Order, error) {
	return scanOrder(s.DB.QueryRowContext(ctx, "SELECT "+orderColumns+" FROM orders WHERE id=? AND user_id=?", id, user))
}
func (s *Store) Orders(ctx context.Context, user int64) ([]Order, error) {
	rows, e := s.DB.QueryContext(ctx, "SELECT "+orderColumns+" FROM orders WHERE user_id=? ORDER BY id DESC", user)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Order{}
	for rows.Next() {
		o, e := scanOrder(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, o)
	}
	return out, rows.Err()
}
func (s *Store) Pending(ctx context.Context) ([]Order, error) {
	rows, e := s.DB.QueryContext(ctx, "SELECT "+orderColumns+" FROM orders WHERE status='pending' ORDER BY id LIMIT 50")
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Order{}
	for rows.Next() {
		o, e := scanOrder(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, o)
	}
	return out, rows.Err()
}
func (s *Store) Balance(ctx context.Context, user int64) (int64, error) {
	var v int64
	e := s.DB.QueryRowContext(ctx, "SELECT wallet_toman FROM users WHERE telegram_id=?", user).Scan(&v)
	if errors.Is(e, sql.ErrNoRows) {
		return 0, nil
	}
	return v, e
}

// Approve changes the order and credits the ledger in the same SQLite transaction.
func (s *Store) Approve(ctx context.Context, id, admin int64) (bool, error) {
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return false, e
	}
	defer tx.Rollback()
	var status string
	var user int64
	var priceToman int64
	e = tx.QueryRowContext(ctx, "SELECT status,user_id,price_toman FROM orders WHERE id=?", id).Scan(&status, &user, &priceToman)
	if e != nil {
		return false, e
	}
	if status == "approved" {
		return false, nil
	}
	if status != "pending" {
		return false, ErrConflict
	}
	if _, e = tx.ExecContext(ctx, "UPDATE orders SET status='approved',reviewed_at=?,reviewed_by=? WHERE id=?", utc(), admin, id); e != nil {
		return false, e
	}
	created, e := s.ensureLedgerEntry(ctx, tx, user, id, "purchase", priceToman)
	if e != nil {
		return false, e
	}
	if !created {
		return false, fmt.Errorf("wallet ledger invariant failed for order %d", id)
	}
	if _, e = tx.ExecContext(ctx, "UPDATE users SET wallet_toman=wallet_toman+10000 WHERE telegram_id=?", user); e != nil {
		return false, e
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO bot_events(order_id,kind,created_at) VALUES(?,'approved',?)", id, utc()); e != nil {
		return false, e
	}
	return true, tx.Commit()
}
func (s *Store) Reject(ctx context.Context, id, admin int64) (bool, error) {
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return false, e
	}
	defer tx.Rollback()
	r, e := tx.ExecContext(ctx, "UPDATE orders SET status='rejected',reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending'", utc(), admin, id)
	if e != nil {
		return false, e
	}
	n, _ := r.RowsAffected()
	if n == 1 {
		if _, e = tx.ExecContext(ctx, "INSERT INTO bot_events(order_id,kind,created_at) VALUES(?,'rejected',?)", id, utc()); e != nil {
			return false, e
		}
		return true, tx.Commit()
	}
	var status string
	e = tx.QueryRowContext(ctx, "SELECT status FROM orders WHERE id=?", id).Scan(&status)
	if e != nil {
		return false, e
	}
	if status == "rejected" {
		return false, nil
	}
	return false, ErrConflict
}

type BotEvent struct {
	ID    int64  `json:"id"`
	Kind  string `json:"kind"`
	Order Order  `json:"order"`
}

func (s *Store) Events(ctx context.Context) ([]BotEvent, error) {
	rows, e := s.DB.QueryContext(ctx, "SELECT id,order_id,kind FROM bot_events WHERE delivered_at IS NULL ORDER BY id LIMIT 50")
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	events := []BotEvent{}
	for rows.Next() {
		var event BotEvent
		var orderID int64
		if e = rows.Scan(&event.ID, &orderID, &event.Kind); e != nil {
			return nil, e
		}
		event.Order.ID = orderID
		events = append(events, event)
	}
	return events, rows.Err()
}
func (s *Store) AckEvent(ctx context.Context, id int64) error {
	_, e := s.DB.ExecContext(ctx, "UPDATE bot_events SET delivered_at=? WHERE id=? AND delivered_at IS NULL", utc(), id)
	return e
}
func (s *Store) Ledger(ctx context.Context, user int64) ([]map[string]any, error) {
	rows, e := s.DB.QueryContext(ctx, "SELECT order_id,amount_toman,kind,created_at FROM wallet_ledger WHERE user_id=? ORDER BY id DESC", user)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var orderID, amount int64
		var kind, date string
		if e = rows.Scan(&orderID, &amount, &kind, &date); e != nil {
			return nil, e
		}
		out = append(out, map[string]any{"order_id": orderID, "amount_toman": amount, "kind": kind, "created_at": date})
	}
	return out, rows.Err()
}
func (s *Store) Assign(ctx context.Context, id, admin, clientID, inbound int64, email, subID string) error {
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	var status string
	var prior sql.NullInt64
	e = tx.QueryRowContext(ctx, "SELECT status,panel_client_id FROM orders WHERE id=?", id).Scan(&status, &prior)
	if e != nil {
		return e
	}
	if status != "approved" || prior.Valid {
		return ErrConflict
	}
	var other int64
	e = tx.QueryRowContext(ctx, "SELECT user_id FROM orders WHERE panel_client_id=? AND id<>? LIMIT 1", clientID, id).Scan(&other)
	if e != nil && !errors.Is(e, sql.ErrNoRows) {
		return e
	}
	var owner int64
	e = tx.QueryRowContext(ctx, "SELECT user_id FROM orders WHERE id=?", id).Scan(&owner)
	if e != nil {
		return e
	}
	if other != 0 && other != owner {
		return ErrConflict
	}
	_, e = tx.ExecContext(ctx, "UPDATE orders SET panel_client_id=?,panel_email=?,panel_inbound_id=?,panel_sub_id=?,assigned_at=?,assigned_by=? WHERE id=?", clientID, email, inbound, subID, utc(), admin, id)
	if e != nil {
		return e
	}
	return tx.Commit()
}
func (s *Store) SetDelivery(ctx context.Context, id int64, errText string) error {
	if errText == "" {
		_, e := s.DB.ExecContext(ctx, "UPDATE orders SET delivered_at=?,delivery_error=NULL WHERE id=?", utc(), id)
		return e
	}
	_, e := s.DB.ExecContext(ctx, "UPDATE orders SET delivery_error=? WHERE id=?", errText, id)
	return e
}
func (s *Store) SetNotification(ctx context.Context, id int64, errText string) {
	s.DB.ExecContext(ctx, "UPDATE orders SET notification_error=? WHERE id=?", errText, id)
}

type Candidate struct {
	ID, OrderID, ClientID, InboundID int64
	Email, SubID                     string
}

func (s *Store) Candidates(ctx context.Context, order int64, cs []Candidate) ([]Candidate, error) {
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback()
	if _, e = tx.ExecContext(ctx, "DELETE FROM match_candidates WHERE order_id=?", order); e != nil {
		return nil, e
	}
	for i := range cs {
		r, e := tx.ExecContext(ctx, "INSERT INTO match_candidates(order_id,panel_client_id,panel_email,panel_inbound_id,panel_sub_id,created_at) VALUES(?,?,?,?,?,?)", order, cs[i].ClientID, cs[i].Email, cs[i].InboundID, cs[i].SubID, utc())
		if e != nil {
			return nil, e
		}
		cs[i].ID, _ = r.LastInsertId()
	}
	return cs, tx.Commit()
}
func (s *Store) Candidate(ctx context.Context, id int64) (Candidate, error) {
	var c Candidate
	e := s.DB.QueryRowContext(ctx, "SELECT id,order_id,panel_client_id,panel_email,panel_inbound_id,panel_sub_id FROM match_candidates WHERE id=?", id).Scan(&c.ID, &c.OrderID, &c.ClientID, &c.Email, &c.InboundID, &c.SubID)
	return c, e
}
