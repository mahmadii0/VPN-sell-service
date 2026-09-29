package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"
)

func TestDotEnv(t *testing.T) {
	key := "PULSE_TEST_DOTENV_PRIORITY"
	t.Setenv(key, "from-process")
	other := "PULSE_TEST_DOTENV_NEW"
	t.Setenv(other, "")
	os.Unsetenv(other)
	input := strings.NewReader("# local settings\n" + key + "=from-file\n" + other + "=value=with-equals\n")
	if e := parseDotEnv(input); e != nil {
		t.Fatal(e)
	}
	if os.Getenv(key) != "from-process" || os.Getenv(other) != "value=with-equals" {
		t.Fatal(".env priority or parsing is wrong")
	}
	if e := parseDotEnv(strings.NewReader("invalid line\n")); e == nil {
		t.Fatal("malformed .env accepted")
	}
}

func signedData(token string, user int64, t time.Time) string {
	v := url.Values{}
	v.Set("auth_date", fmt.Sprint(t.Unix()))
	v.Set("user", fmt.Sprintf(`{"id":%d}`, user))
	keys := []string{"auth_date", "user"}
	sort.Strings(keys)
	lines := []string{}
	for _, k := range keys {
		lines = append(lines, k+"="+v.Get(k))
	}
	s := hmac.New(sha256.New, []byte("WebAppData"))
	s.Write([]byte(token))
	mac := hmac.New(sha256.New, s.Sum(nil))
	mac.Write([]byte(strings.Join(lines, "\n")))
	v.Set("hash", hex.EncodeToString(mac.Sum(nil)))
	return v.Encode()
}
func TestInitData(t *testing.T) {
	now := time.Now()
	raw := signedData("secret", 123, now)
	id, e := validateInitData(raw, "secret", now)
	if e != nil || id != 123 {
		t.Fatalf("valid signed user: %d %v", id, e)
	}
	if _, e = validateInitData(raw, "wrong", now); e == nil {
		t.Fatal("wrong token accepted")
	}
	if _, e = validateInitData(signedData("secret", 123, now.Add(-25*time.Hour)), "secret", now); e == nil {
		t.Fatal("expired data accepted")
	}
	v, _ := url.ParseQuery(raw)
	v.Set("user", `{"id":999}`)
	if _, e = validateInitData(v.Encode(), "secret", now); e == nil {
		t.Fatal("browser-supplied identity accepted")
	}
}
func testStore(t *testing.T) *Store {
	t.Helper()
	s, e := openStore(filepath.Join(t.TempDir(), "shop.db"))
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { s.DB.Close() })
	return s
}
func TestApprovalOnce(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	id, e := s.CreateOrder(ctx, 123, Package{ID: "p", Name: "Package", PriceToman: 35000}, "receipt.png", "image/png")
	if e != nil {
		t.Fatal(e)
	}
	for i := 0; i < 3; i++ {
		changed, e := s.Approve(ctx, id, 999)
		if e != nil || changed != (i == 0) {
			t.Fatalf("approve %d: changed %v, %v", i, changed, e)
		}
	}
	balance, e := s.Balance(ctx, 123)
	if e != nil || balance != 10000 {
		t.Fatalf("wallet: %d %v", balance, e)
	}
	var n int
	e = s.DB.QueryRow("SELECT count(*) FROM wallet_ledger WHERE order_id=?", id).Scan(&n)
	if e != nil || n != 1 {
		t.Fatalf("ledger count %d: %v", n, e)
	}
	if _, e = s.Reject(ctx, id, 999); e == nil {
		t.Fatal("approved order rejected")
	}
}
func TestOwnership(t *testing.T) {
	s := testStore(t)
	id, e := s.CreateOrder(context.Background(), 123, Package{ID: "p", Name: "P", PriceToman: 100}, "private", "image/png")
	if e != nil {
		t.Fatal(e)
	}
	api := &API{Config: Config{BotToken: "secret"}, Store: s}
	request := httptest.NewRequest("GET", fmt.Sprintf("/api/orders/%d/service", id), nil)
	request.Header.Set("X-Telegram-Init-Data", signedData("secret", 456, time.Now()))
	w := httptest.NewRecorder()
	api.routes().ServeHTTP(w, request)
	if w.Code != 404 {
		t.Fatalf("other user's service status: %d", w.Code)
	}
	request = httptest.NewRequest("GET", "/api/orders", nil)
	request.Header.Set("X-Telegram-Init-Data", signedData("secret", 456, time.Now()))
	w = httptest.NewRecorder()
	api.routes().ServeHTTP(w, request)
	if w.Code != 200 || strings.Contains(w.Body.String(), `"id":`+fmt.Sprint(id)) {
		t.Fatalf("other user's order leaked: %d %s", w.Code, w.Body.String())
	}
	request = httptest.NewRequest("GET", "/api/orders", nil)
	w = httptest.NewRecorder()
	api.routes().ServeHTTP(w, request)
	if w.Code != 401 {
		t.Fatalf("unauthenticated status: %d", w.Code)
	}
}
func TestPrefixDiscoveryIsAmbiguousAndNotAssignment(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/panel/api/clients/list" || r.Header.Get("Authorization") != "Bearer token" {
			t.Errorf("unexpected panel request: %s", r.URL.Path)
		}
		fmt.Fprint(w, `{"success":true,"obj":[{"id":10,"email":"123alice","subId":"a","inboundIds":[1]},{"id":11,"email":"123bob","subId":"b","inboundIds":[2]},{"id":12,"email":"456foo","subId":"c","inboundIds":[3]}]}`)
	}))
	defer server.Close()
	p := &Panel{Base: server.URL, Token: "token", HTTP: server.Client()}
	matches, e := p.Discover(context.Background(), 123)
	if e != nil || len(matches) != 2 || matches[0].ID == matches[1].ID {
		t.Fatalf("ambiguous discovery: %+v %v", matches, e)
	}
	s := testStore(t)
	id, _ := s.CreateOrder(context.Background(), 123, Package{ID: "p", Name: "P", PriceToman: 1}, "receipt", "image/png")
	s.Approve(context.Background(), id, 999)
	o, _ := s.Order(context.Background(), id)
	if o.PanelClientID.Valid {
		t.Fatal("prefix discovery assigned a client")
	}
}
func TestSharedSubscriptionIDCannotBeExposed(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/panel/api/clients/get/123alice":
			fmt.Fprint(w, `{"success":true,"obj":{"client":{"id":10,"email":"123alice","subId":"shared","enable":true},"inboundIds":[1]}}`)
		case "/panel/api/clients/list":
			fmt.Fprint(w, `{"success":true,"obj":[{"id":10,"email":"123alice","subId":"shared"},{"id":11,"email":"999other","subId":"shared"}]}`)
		default:
			t.Errorf("unexpected request to %s", r.URL.Path)
		}
	}))
	defer server.Close()
	p := &Panel{Base: server.URL, SubscriptionBase: "https://example.com/sub/", HTTP: server.Client()}
	o := Order{PanelClientID: sql.NullInt64{Int64: 10, Valid: true}, PanelEmail: sql.NullString{String: "123alice", Valid: true}, PanelInboundID: sql.NullInt64{Int64: 1, Valid: true}, PanelSubID: sql.NullString{String: "shared", Valid: true}}
	_, link, e := p.Verify(context.Background(), o)
	if e == nil || link != "" {
		t.Fatalf("shared subscription exposed: %q, %v", link, e)
	}
}
func TestChangedSubscriptionIDCannotBeExposed(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/panel/api/clients/get/123alice" {
			t.Errorf("unexpected panel path %s", r.URL.Path)
		}
		fmt.Fprint(w, `{"success":true,"obj":{"client":{"id":10,"email":"123alice","subId":"new","enable":true},"inboundIds":[1]}}`)
	}))
	defer server.Close()
	p := &Panel{Base: server.URL, SubscriptionBase: "https://example.com/sub/", HTTP: server.Client()}
	o := Order{PanelClientID: sql.NullInt64{Int64: 10, Valid: true}, PanelEmail: sql.NullString{String: "123alice", Valid: true}, PanelInboundID: sql.NullInt64{Int64: 1, Valid: true}, PanelSubID: sql.NullString{String: "original", Valid: true}}
	_, link, e := p.Verify(context.Background(), o)
	if e == nil || link != "" {
		t.Fatalf("changed subscription exposed: %q %v", link, e)
	}
}
func TestInternalReviewRequiresBotAndAdminAndCreditsOnce(t *testing.T) {
	s := testStore(t)
	id, e := s.CreateOrder(context.Background(), 123, Package{ID: "p", Name: "P", PriceToman: 35000}, "receipt.png", "image/png")
	if e != nil {
		t.Fatal(e)
	}
	api := &API{Config: Config{BotInternalToken: "internal-secret", Admins: map[int64]bool{999: true}}, Store: s}
	path := fmt.Sprintf("/internal/orders/%d/approve", id)
	request := func(token, admin string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", path, nil)
		r.Header.Set("X-Bot-Token", token)
		r.Header.Set("X-Admin-ID", admin)
		w := httptest.NewRecorder()
		api.routes().ServeHTTP(w, r)
		return w
	}
	if w := request("", "999"); w.Code != 401 {
		t.Fatalf("missing service token: %d", w.Code)
	}
	if w := request("internal-secret", "123"); w.Code != 403 {
		t.Fatalf("non-admin approved: %d", w.Code)
	}
	if w := request("internal-secret", "999"); w.Code != 200 || !strings.Contains(w.Body.String(), `"changed":true`) {
		t.Fatalf("first review: %d %s", w.Code, w.Body.String())
	}
	if w := request("internal-secret", "999"); w.Code != 200 || !strings.Contains(w.Body.String(), `"changed":false`) {
		t.Fatalf("repeat review: %d %s", w.Code, w.Body.String())
	}
	balance, e := s.Balance(context.Background(), 123)
	if e != nil || balance != 10000 {
		t.Fatalf("wallet balance %d: %v", balance, e)
	}
	events, e := s.Events(context.Background())
	if e != nil || len(events) != 2 || events[0].Kind != "created" || events[1].Kind != "approved" {
		t.Fatalf("transactional events: %+v %v", events, e)
	}
}
func TestRepeatRejectionAndOwnershipOfOrderDetail(t *testing.T) {
	s := testStore(t)
	id, e := s.CreateOrder(context.Background(), 123, Package{ID: "p", Name: "P", PriceToman: 100}, "receipt.png", "image/png")
	if e != nil {
		t.Fatal(e)
	}
	for i := 0; i < 2; i++ {
		changed, e := s.Reject(context.Background(), id, 999)
		if e != nil || changed != (i == 0) {
			t.Fatalf("reject %d: %v %v", i, changed, e)
		}
	}
	api := &API{Config: Config{BotToken: "secret"}, Store: s}
	r := httptest.NewRequest("GET", fmt.Sprintf("/api/orders/%d", id), nil)
	r.Header.Set("X-Telegram-Init-Data", signedData("secret", 456, time.Now()))
	w := httptest.NewRecorder()
	api.routes().ServeHTTP(w, r)
	if w.Code != 404 {
		t.Fatalf("private order exposed: %d", w.Code)
	}
}
func TestStaleCandidateSubscriptionCannotBeAssigned(t *testing.T) {
	s := testStore(t)
	id, e := s.CreateOrder(context.Background(), 123, Package{ID: "p", Name: "P", PriceToman: 100}, "receipt.png", "image/png")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = s.Approve(context.Background(), id, 999); e != nil {
		t.Fatal(e)
	}
	candidates, e := s.Candidates(context.Background(), id, []Candidate{{OrderID: id, ClientID: 10, InboundID: 1, Email: "123alice", SubID: "original"}})
	if e != nil {
		t.Fatal(e)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"success":true,"obj":{"client":{"id":10,"email":"123alice","subId":"changed","enable":true},"inboundIds":[1]}}`)
	}))
	defer server.Close()
	api := &API{Config: Config{BotInternalToken: "internal-secret", Admins: map[int64]bool{999: true}}, Store: s, Panel: &Panel{Base: server.URL, HTTP: server.Client()}}
	body := strings.NewReader(fmt.Sprintf(`{"candidate_id":%d}`, candidates[0].ID))
	req := httptest.NewRequest("POST", fmt.Sprintf("/internal/orders/%d/assign", id), body)
	req.Header.Set("X-Bot-Token", "internal-secret")
	req.Header.Set("X-Admin-ID", "999")
	w := httptest.NewRecorder()
	api.routes().ServeHTTP(w, req)
	if w.Code != 409 {
		t.Fatalf("stale selection accepted: %d %s", w.Code, w.Body.String())
	}
	o, e := s.Order(context.Background(), id)
	if e != nil || o.PanelClientID.Valid {
		t.Fatalf("stale client stored: %+v %v", o, e)
	}
}
