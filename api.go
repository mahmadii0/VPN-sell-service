package main

import (
	"bytes"
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"io/fs"
	"net/http"
	"os"
	"strconv"
	"time"
)

type API struct {
	Config Config
	Store  *Store
	Panel  *Panel
}

//go:embed web/*
var webFiles embed.FS

type userKey struct{}

func jsonOut(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
func bad(w http.ResponseWriter, status int, msg string) {
	jsonOut(w, status, map[string]string{"error": msg})
}
func (a *API) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		raw := r.Header.Get("X-Telegram-Init-Data")
		user, e := validateInitData(raw, a.Config.BotToken, time.Now())
		if e != nil {
			bad(w, 401, "Telegram authentication failed")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), userKey{}, user)))
	}
}
func userID(r *http.Request) int64 { return r.Context().Value(userKey{}).(int64) }
func (a *API) routes() http.Handler {
	m := http.NewServeMux()
	m.HandleFunc("GET /api/shop", a.auth(func(w http.ResponseWriter, r *http.Request) {
		jsonOut(w, 200, map[string]any{"packages": a.Config.Packages, "card_number": a.Config.CardNumber, "subscription_base": a.Config.SubscriptionBase})
	}))
	m.HandleFunc("GET /api/me", a.auth(func(w http.ResponseWriter, r *http.Request) {
		balance, e := a.Store.Balance(r.Context(), userID(r))
		if e != nil {
			bad(w, 500, "database error")
			return
		}
		jsonOut(w, 200, map[string]any{"wallet_toman": balance})
	}))
	m.HandleFunc("GET /api/orders", a.auth(func(w http.ResponseWriter, r *http.Request) {
		orders, e := a.Store.Orders(r.Context(), userID(r))
		if e != nil {
			bad(w, 500, "database error")
			return
		}
		jsonOut(w, 200, map[string]any{"orders": orders})
	}))
	m.HandleFunc("POST /api/orders", a.auth(a.createOrder))
	m.HandleFunc("GET /api/orders/{id}/service", a.auth(a.service))
	m.HandleFunc("GET /api/orders/{id}", a.auth(a.userOrder))
	m.HandleFunc("GET /api/wallet/transactions", a.auth(a.walletTransactions))
	a.internalRoutes(m)
	static, _ := fs.Sub(webFiles, "web")
	staticHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		http.FileServer(http.FS(static)).ServeHTTP(w, r)
	})
	m.Handle("/", staticHandler)
	return m
}
func (a *API) createOrder(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 5<<20)
	if e := r.ParseMultipartForm(5 << 20); e != nil {
		bad(w, 413, "upload exceeds 5 MiB or invalid form")
		return
	}
	pID := r.FormValue("package_id")
	var p *Package
	for i := range a.Config.Packages {
		if a.Config.Packages[i].ID == pID {
			p = &a.Config.Packages[i]
		}
	}
	if p == nil {
		bad(w, 400, "unknown package")
		return
	}
	f, _, e := r.FormFile("receipt")
	if e != nil {
		bad(w, 400, "receipt required")
		return
	}
	defer f.Close()
	data, e := io.ReadAll(io.LimitReader(f, 4<<20+1))
	if e != nil || len(data) == 0 || len(data) > 4<<20 {
		bad(w, 400, "receipt must be at most 4 MiB")
		return
	}
	mime := http.DetectContentType(data)
	if mime != "image/jpeg" && mime != "image/png" {
		bad(w, 400, "receipt must be JPEG or PNG")
		return
	}
	imageInfo, _, e := image.DecodeConfig(bytes.NewReader(data))
	if e != nil || imageInfo.Width <= 0 || imageInfo.Height <= 0 || int64(imageInfo.Width)*int64(imageInfo.Height) > 20_000_000 {
		bad(w, 400, "invalid or oversized image dimensions")
		return
	}
	if _, _, e = image.Decode(bytes.NewReader(data)); e != nil {
		bad(w, 400, "invalid image")
		return
	}
	ext := ".jpg"
	if mime == "image/png" {
		ext = ".png"
	}
	file, e := os.CreateTemp(a.Config.ReceiptDir, "receipt-*")
	if e != nil {
		bad(w, 500, "receipt storage error")
		return
	}
	path := file.Name()
	defer file.Close()
	if e = file.Chmod(0600); e == nil {
		_, e = file.Write(data)
	}
	if e != nil {
		os.Remove(path)
		bad(w, 500, "receipt storage error")
		return
	}
	file.Close()
	newPath := path + ext
	if e = os.Rename(path, newPath); e != nil {
		os.Remove(path)
		bad(w, 500, "receipt storage error")
		return
	}
	id, e := a.Store.CreateOrder(r.Context(), userID(r), *p, newPath, mime)
	if e != nil {
		os.Remove(newPath)
		bad(w, 500, "order storage error")
		return
	}
	jsonOut(w, 201, map[string]any{"id": id, "status": "pending", "price_toman": p.PriceToman, "message": "Receipt submitted. An admin must manually review the payment."})
}
func (a *API) service(w http.ResponseWriter, r *http.Request) {
	id, e := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if e != nil || id < 1 {
		bad(w, 400, "invalid order ID")
		return
	}
	o, e := a.Store.UserOrder(r.Context(), userID(r), id)
	if e == sql.ErrNoRows {
		bad(w, 404, "order not found")
		return
	}
	if e != nil {
		bad(w, 500, "database error")
		return
	}
	if o.Status != "approved" || !o.PanelClientID.Valid {
		bad(w, 409, "service has not been assigned")
		return
	}
	c, link, e := a.Panel.Verify(r.Context(), o)
	if e != nil {
		bad(w, 502, fmt.Sprintf("panel service unavailable: %v", e))
		return
	}
	var expiry any
	var remaining any
	if c.ExpiryTime > 0 {
		t := time.UnixMilli(c.ExpiryTime).UTC()
		expiry = t.Format(time.RFC3339)
		seconds := int64(time.Until(t).Seconds())
		if seconds < 0 {
			seconds = 0
		}
		remaining = seconds
	}
	jsonOut(w, 200, map[string]any{"order_id": o.ID, "package_name": o.PackageName, "panel_email": c.Email, "inbound_id": o.PanelInboundID.Int64, "expiry_utc": expiry, "remaining_seconds": remaining, "subscription_url": link})
}
func (a *API) userOrder(w http.ResponseWriter, r *http.Request) {
	id, e := orderPath(r)
	if e != nil {
		bad(w, 400, e.Error())
		return
	}
	o, e := a.Store.UserOrder(r.Context(), userID(r), id)
	if e == sql.ErrNoRows {
		bad(w, 404, "order not found")
		return
	}
	if e != nil {
		bad(w, 500, "database error")
		return
	}
	jsonOut(w, 200, o)
}
func (a *API) walletTransactions(w http.ResponseWriter, r *http.Request) {
	entries, e := a.Store.Ledger(r.Context(), userID(r))
	if e != nil {
		bad(w, 500, "database error")
		return
	}
	jsonOut(w, 200, map[string]any{"transactions": entries})
}
func ensureStorage(c Config) error {
	return os.MkdirAll(c.ReceiptDir, 0700)
}
