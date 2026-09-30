package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Panel speaks the global-client API documented by MHSanaei/3x-ui's current OpenAPI.
type Panel struct {
	Base, Token, SubscriptionBase string
	HTTP                          *http.Client
}
type Client struct {
	ID         int64   `json:"id"`
	Email      string  `json:"email"`
	SubID      string  `json:"subId"`
	ExpiryTime int64   `json:"expiryTime"`
	Enabled    bool    `json:"enable"`
	InboundIDs []int64 `json:"inboundIds"`
}

func (p *Panel) get(ctx context.Context, path string, dest any) error {
	base := strings.TrimRight(p.Base, "/")
	base = strings.TrimSuffix(base, "/panel")
	req, e := http.NewRequestWithContext(ctx, "GET", base+path, nil)
	if e != nil {
		return e
	}
	req.Header.Set("Authorization", "Bearer "+p.Token)
	res, e := p.HTTP.Do(req)
	if e != nil {
		return fmt.Errorf("panel unavailable: %w", e)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("panel HTTP %d", res.StatusCode)
	}
	var envelope struct {
		Success bool            `json:"success"`
		Msg     string          `json:"msg"`
		Obj     json.RawMessage `json:"obj"`
	}
	if e = json.NewDecoder(io.LimitReader(res.Body, 8<<20)).Decode(&envelope); e != nil {
		return fmt.Errorf("panel response: %w", e)
	}
	if !envelope.Success {
		return fmt.Errorf("panel rejected request: %s", envelope.Msg)
	}
	if len(envelope.Obj) == 0 || string(envelope.Obj) == "null" {
		return errors.New("panel returned no object")
	}
	return json.Unmarshal(envelope.Obj, dest)
}
func (p *Panel) List(ctx context.Context) ([]Client, error) {
	var cs []Client
	e := p.get(ctx, "/panel/api/clients/list", &cs)
	return cs, e
}
func (p *Panel) Client(ctx context.Context, email string) (Client, error) {
	var response struct {
		Client     Client  `json:"client"`
		InboundIDs []int64 `json:"inboundIds"`
	}
	e := p.get(ctx, "/panel/api/clients/get/"+url.PathEscape(email), &response)
	response.Client.InboundIDs = response.InboundIDs
	return response.Client, e
}
func (p *Panel) SubLinks(ctx context.Context, subID string) ([]string, error) {
	var links []string
	e := p.get(ctx, "/panel/api/clients/subLinks/"+url.PathEscape(subID), &links)
	return links, e
}
func (p *Panel) SubscriptionURL(subID string) (string, error) {
	if subID == "" || strings.ContainsAny(subID, "/?#") {
		return "", errors.New("invalid panel subscription ID")
	}
	return p.SubscriptionBase + url.PathEscape(subID), nil
}
func (p *Panel) UniqueSubscription(ctx context.Context, chosen Client) error {
	clients, e := p.List(ctx)
	if e != nil {
		return e
	}
	count := 0
	for _, c := range clients {
		if c.SubID == chosen.SubID {
			if c.ID != chosen.ID || c.Email != chosen.Email {
				return errors.New("subscription ID belongs to multiple panel clients")
			}
			count++
		}
	}
	if count != 1 {
		return errors.New("selected client is absent or duplicated in panel list")
	}
	return nil
}
func (p *Panel) Verify(ctx context.Context, o Order) (Client, string, error) {
	if !o.PanelClientID.Valid || !o.PanelEmail.Valid || !o.PanelInboundID.Valid || !o.PanelSubID.Valid {
		return Client{}, "", errors.New("service has no assigned client")
	}
	c, e := p.Client(ctx, o.PanelEmail.String)
	if e != nil {
		return c, "", e
	}
	if c.ID != o.PanelClientID.Int64 || c.Email != o.PanelEmail.String || c.SubID != o.PanelSubID.String {
		return c, "", errors.New("panel client identity changed")
	}
	found := false
	for _, id := range c.InboundIDs {
		if id == o.PanelInboundID.Int64 {
			found = true
		}
	}
	if !found {
		return c, "", errors.New("assigned inbound is no longer attached")
	}
	if !c.Enabled {
		return c, "", errors.New("panel client is disabled")
	}
	u, e := p.SubscriptionURL(c.SubID)
	if e != nil {
		return c, "", e
	}
	if e = p.UniqueSubscription(ctx, c); e != nil {
		return c, "", e
	}
	links, e := p.SubLinks(ctx, c.SubID)
	if e != nil {
		return c, "", e
	}
	if len(links) == 0 {
		return c, "", errors.New("panel has no active subscription links")
	}
	return c, u, nil
}
func (p *Panel) Discover(ctx context.Context, user int64) ([]Client, error) {
	cs, e := p.List(ctx)
	if e != nil {
		return nil, e
	}
	prefix := strconv.FormatInt(user, 10)
	matches := []Client{}
	for _, c := range cs {
		if strings.HasPrefix(c.Email, prefix) {
			matches = append(matches, c)
		}
	}
	return matches, nil
}
func newPanel(c Config) *Panel {
	return &Panel{Base: c.PanelURL, Token: c.PanelToken, SubscriptionBase: c.SubscriptionBase, HTTP: &http.Client{Timeout: 12 * time.Second}}
}
