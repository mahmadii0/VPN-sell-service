package main

import (
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
)

// The Python bot uses these private routes; Go owns all SQLite and panel changes.
func (a *API) internal(next http.HandlerFunc, admin bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("X-Bot-Token")
		if a.Config.BotInternalToken == "" || subtle.ConstantTimeCompare([]byte(token), []byte(a.Config.BotInternalToken)) != 1 {
			bad(w, 401, "bot authentication failed")
			return
		}
		if admin {
			id, e := strconv.ParseInt(r.Header.Get("X-Admin-ID"), 10, 64)
			if e != nil || !a.Config.Admins[id] {
				bad(w, 403, "admin required")
				return
			}
		}
		next(w, r)
	}
}
func internalAdmin(r *http.Request) int64 {
	id, _ := strconv.ParseInt(r.Header.Get("X-Admin-ID"), 10, 64)
	return id
}
func orderPath(r *http.Request) (int64, error) {
	id, e := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if e != nil || id < 1 {
		return 0, errors.New("invalid order ID")
	}
	return id, nil
}
func botOrder(o Order) map[string]any {
	return map[string]any{"id": o.ID, "user_id": o.UserID, "package_name": o.PackageName, "price_toman": o.PriceToman, "status": o.Status,
		"assigned": o.PanelClientID.Valid, "panel_email": o.PanelEmail.String, "panel_client_id": o.PanelClientID.Int64, "panel_inbound_id": o.PanelInboundID.Int64}
}
func (a *API) internalOrder(w http.ResponseWriter, r *http.Request) (Order, bool) {
	id, e := orderPath(r)
	if e != nil {
		bad(w, 400, e.Error())
		return Order{}, false
	}
	o, e := a.Store.Order(r.Context(), id)
	if errors.Is(e, sql.ErrNoRows) {
		bad(w, 404, "order not found")
		return Order{}, false
	}
	if e != nil {
		bad(w, 500, "database error")
		return Order{}, false
	}
	return o, true
}
func (a *API) reviewResponse(w http.ResponseWriter, id int64, changed bool, e error) {
	if errors.Is(e, sql.ErrNoRows) {
		bad(w, 404, "order not found")
		return
	}
	if e == ErrConflict {
		bad(w, 409, e.Error())
		return
	}
	if e != nil {
		bad(w, 500, "database error")
		return
	}
	jsonOut(w, 200, map[string]any{"id": id, "changed": changed})
}
func (a *API) internalRoutes(m *http.ServeMux) {
	m.HandleFunc("GET /internal/events", a.internal(func(w http.ResponseWriter, r *http.Request) {
		events, e := a.Store.Events(r.Context())
		if e != nil {
			bad(w, 500, "database error")
			return
		}
		out := []map[string]any{}
		for _, v := range events {
			o, e := a.Store.Order(r.Context(), v.Order.ID)
			if e != nil {
				bad(w, 500, "database error")
				return
			}
			out = append(out, map[string]any{"id": v.ID, "kind": v.Kind, "order": botOrder(o)})
		}
		jsonOut(w, 200, map[string]any{"events": out})
	}, false))
	m.HandleFunc("POST /internal/events/{id}/ack", a.internal(func(w http.ResponseWriter, r *http.Request) {
		id, e := orderPath(r)
		if e != nil {
			bad(w, 400, e.Error())
			return
		}
		if e = a.Store.AckEvent(r.Context(), id); e != nil {
			bad(w, 500, "database error")
			return
		}
		jsonOut(w, 200, map[string]any{"ok": true})
	}, false))
	m.HandleFunc("GET /internal/orders/pending", a.internal(func(w http.ResponseWriter, r *http.Request) {
		orders, e := a.Store.Pending(r.Context())
		if e != nil {
			bad(w, 500, "database error")
			return
		}
		out := []map[string]any{}
		for _, o := range orders {
			out = append(out, botOrder(o))
		}
		jsonOut(w, 200, map[string]any{"orders": out})
	}, true))
	m.HandleFunc("GET /internal/orders/{id}", a.internal(func(w http.ResponseWriter, r *http.Request) {
		o, ok := a.internalOrder(w, r)
		if ok {
			jsonOut(w, 200, botOrder(o))
		}
	}, true))
	m.HandleFunc("GET /internal/orders/{id}/receipt", a.internal(func(w http.ResponseWriter, r *http.Request) {
		o, ok := a.internalOrder(w, r)
		if !ok {
			return
		}
		name := path.Base(strings.ReplaceAll(o.ReceiptPath, "\\", "/"))
		if name == "." || name == ".." || name == "/" {
			bad(w, 404, "receipt missing")
			return
		}
		f, e := os.Open(filepath.Join(a.Config.ReceiptDir, name))
		if e != nil {
			bad(w, 404, "receipt missing")
			return
		}
		defer f.Close()
		w.Header().Set("Content-Type", o.ReceiptMIME)
		w.Header().Set("Cache-Control", "no-store")
		info, e := f.Stat()
		if e != nil {
			bad(w, 500, "receipt storage error")
			return
		}
		http.ServeContent(w, r, "receipt", info.ModTime(), f)
	}, true))
	m.HandleFunc("POST /internal/orders/{id}/approve", a.internal(func(w http.ResponseWriter, r *http.Request) {
		id, e := orderPath(r)
		if e != nil {
			bad(w, 400, e.Error())
			return
		}
		changed, e := a.Store.Approve(r.Context(), id, internalAdmin(r))
		a.reviewResponse(w, id, changed, e)
	}, true))
	m.HandleFunc("POST /internal/orders/{id}/reject", a.internal(func(w http.ResponseWriter, r *http.Request) {
		id, e := orderPath(r)
		if e != nil {
			bad(w, 400, e.Error())
			return
		}
		changed, e := a.Store.Reject(r.Context(), id, internalAdmin(r))
		a.reviewResponse(w, id, changed, e)
	}, true))
	m.HandleFunc("GET /internal/orders/{id}/matches", a.internal(a.matchCandidates, true))
	m.HandleFunc("POST /internal/orders/{id}/assign", a.internal(a.assignClient, true))
	m.HandleFunc("GET /internal/orders/{id}/link", a.internal(func(w http.ResponseWriter, r *http.Request) {
		o, ok := a.internalOrder(w, r)
		if !ok {
			return
		}
		if o.Status != "approved" || !o.PanelClientID.Valid {
			bad(w, 409, "client not assigned")
			return
		}
		_, link, e := a.Panel.Verify(r.Context(), o)
		if e != nil {
			a.Store.SetDelivery(r.Context(), o.ID, e.Error())
			bad(w, 502, e.Error())
			return
		}
		jsonOut(w, 200, map[string]any{"user_id": o.UserID, "subscription_url": link})
	}, true))
	m.HandleFunc("POST /internal/orders/{id}/delivery", a.internal(func(w http.ResponseWriter, r *http.Request) {
		o, ok := a.internalOrder(w, r)
		if !ok {
			return
		}
		var body struct {
			Error string `json:"error"`
		}
		if e := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048)).Decode(&body); e != nil {
			bad(w, 400, "invalid body")
			return
		}
		if e := a.Store.SetDelivery(r.Context(), o.ID, body.Error); e != nil {
			bad(w, 500, "database error")
			return
		}
		jsonOut(w, 200, map[string]any{"ok": true})
	}, true))
}
func (a *API) matchCandidates(w http.ResponseWriter, r *http.Request) {
	o, ok := a.internalOrder(w, r)
	if !ok {
		return
	}
	if o.Status != "approved" || o.PanelClientID.Valid {
		bad(w, 409, "order cannot be assigned")
		return
	}
	cs, e := a.Panel.Discover(r.Context(), o.UserID)
	if e != nil {
		bad(w, 502, e.Error())
		return
	}
	matches := []Candidate{}
	for _, c := range cs {
		for _, in := range c.InboundIDs {
			matches = append(matches, Candidate{OrderID: o.ID, ClientID: c.ID, InboundID: in, Email: c.Email, SubID: c.SubID})
		}
	}
	if len(matches) > 20 {
		bad(w, 409, "too many matches; use exact email and inbound ID")
		return
	}
	matches, e = a.Store.Candidates(r.Context(), o.ID, matches)
	if e != nil {
		bad(w, 500, "database error")
		return
	}
	out := []map[string]any{}
	for _, c := range matches {
		out = append(out, map[string]any{"id": c.ID, "client_id": c.ClientID, "email": c.Email, "inbound_id": c.InboundID, "sub_id": c.SubID})
	}
	jsonOut(w, 200, map[string]any{"candidates": out})
}
func (a *API) assignClient(w http.ResponseWriter, r *http.Request) {
	o, ok := a.internalOrder(w, r)
	if !ok {
		return
	}
	if o.Status != "approved" || o.PanelClientID.Valid {
		bad(w, 409, "order cannot be assigned")
		return
	}
	var body struct {
		CandidateID int64  `json:"candidate_id"`
		Email       string `json:"email"`
		InboundID   int64  `json:"inbound_id"`
	}
	if e := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); e != nil {
		bad(w, 400, "invalid body")
		return
	}
	expected := int64(0)
	expectedSubID := ""
	if body.CandidateID > 0 {
		c, e := a.Store.Candidate(r.Context(), body.CandidateID)
		if e != nil || c.OrderID != o.ID {
			bad(w, 400, "invalid candidate for order")
			return
		}
		body.Email, body.InboundID, expected, expectedSubID = c.Email, c.InboundID, c.ClientID, c.SubID
	}
	if body.Email == "" || body.InboundID <= 0 {
		bad(w, 400, "explicit email and inbound required")
		return
	}
	c, e := a.Panel.Client(r.Context(), body.Email)
	if e != nil {
		bad(w, 502, e.Error())
		return
	}
	if expected > 0 && (c.ID != expected || c.SubID != expectedSubID) {
		bad(w, 409, "candidate changed; run match again")
		return
	}
	if c.ID <= 0 || c.Email != body.Email || c.SubID == "" || !c.Enabled {
		bad(w, 409, "client identity or state changed")
		return
	}
	found := false
	for _, in := range c.InboundIDs {
		if in == body.InboundID {
			found = true
		}
	}
	if !found {
		bad(w, 409, "client not on selected inbound")
		return
	}
	if _, e = a.Panel.SubscriptionURL(c.SubID); e == nil {
		e = a.Panel.UniqueSubscription(r.Context(), c)
	}
	if e == nil {
		var links []string
		links, e = a.Panel.SubLinks(r.Context(), c.SubID)
		if e == nil && len(links) == 0 {
			e = errors.New("panel has no active links")
		}
	}
	if e != nil {
		bad(w, 502, e.Error())
		return
	}
	if e = a.Store.Assign(r.Context(), o.ID, internalAdmin(r), c.ID, body.InboundID, c.Email, c.SubID); e != nil {
		if e == ErrConflict {
			bad(w, 409, e.Error())
		} else {
			bad(w, 500, e.Error())
		}
		return
	}
	jsonOut(w, 200, map[string]any{"user_id": o.UserID, "client_id": c.ID})
}
