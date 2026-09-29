package main

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

var ErrConflict = errors.New("order is in an incompatible state")

type Store struct{ DB *sql.DB }
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

const orderColumns = `id,user_id,package_id,package_name,price_toman,receipt_path,receipt_mime,status,created_at,panel_client_id,panel_email,panel_inbound_id,panel_sub_id,delivered_at,delivery_error,notification_error`

func scanOrder(row interface{ Scan(...any) error }) (Order, error) {
	var o Order
	e := row.Scan(&o.ID, &o.UserID, &o.PackageID, &o.PackageName, &o.PriceToman, &o.ReceiptPath, &o.ReceiptMIME, &o.Status, &o.CreatedAt, &o.PanelClientID, &o.PanelEmail, &o.PanelInboundID, &o.PanelSubID, &o.DeliveredAt, &o.DeliveryError, &o.NotificationError)
	return o, e
}
func openStore(path string) (*Store, error) {
	db, e := sql.Open("sqlite", path)
	if e != nil {
		return nil, e
	}
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
	return &Store{db}, nil
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
func (s *Store) CreateOrder(ctx context.Context, user int64, p Package, path, mime string) (int64, error) {
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return 0, e
	}
	defer tx.Rollback()
	if _, e = tx.ExecContext(ctx, "INSERT OR IGNORE INTO users(telegram_id) VALUES(?)", user); e != nil {
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
	e = tx.QueryRowContext(ctx, "SELECT status,user_id FROM orders WHERE id=?", id).Scan(&status, &user)
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
	r, e := tx.ExecContext(ctx, "INSERT OR IGNORE INTO wallet_ledger(user_id,order_id,amount_toman,created_at) VALUES(?,?,10000,?)", user, id, utc())
	if e != nil {
		return false, e
	}
	n, e := r.RowsAffected()
	if e != nil {
		return false, e
	}
	if n != 1 {
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
	rows, e := s.DB.QueryContext(ctx, "SELECT order_id,amount_toman,created_at FROM wallet_ledger WHERE user_id=? ORDER BY id DESC", user)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var orderID, amount int64
		var date string
		if e = rows.Scan(&orderID, &amount, &date); e != nil {
			return nil, e
		}
		out = append(out, map[string]any{"order_id": orderID, "amount_toman": amount, "created_at": date})
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
