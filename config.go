package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Package struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	PriceToman  int64  `json:"price_toman"`
}
type Config struct {
	BotToken, BotInternalToken, MiniAppURL, CardNumber, PanelURL, PanelToken, SubscriptionBase, DBPath, ReceiptDir, Listen string
	Admins                                                                                                                 map[int64]bool
	Packages                                                                                                               []Package
}

func loadConfig() (Config, error) {
	if e := loadDotEnv(".env"); e != nil {
		return Config{}, e
	}
	c := Config{BotToken: os.Getenv("BOT_TOKEN"), BotInternalToken: os.Getenv("BOT_INTERNAL_TOKEN"), MiniAppURL: os.Getenv("MINI_APP_URL"), CardNumber: os.Getenv("CARD_NUMBER"), PanelURL: strings.TrimRight(os.Getenv("PANEL_URL"), "/"), PanelToken: os.Getenv("PANEL_API_TOKEN"), SubscriptionBase: os.Getenv("PANEL_SUBSCRIPTION_BASE_URL"), DBPath: os.Getenv("DB_PATH"), ReceiptDir: os.Getenv("RECEIPT_DIR"), Listen: os.Getenv("LISTEN_ADDR"), Admins: map[int64]bool{}}
	if c.DBPath == "" {
		c.DBPath = "shop.sqlite"
	}
	if c.ReceiptDir == "" {
		c.ReceiptDir = "receipts"
	}
	if c.Listen == "" {
		c.Listen = ":8080"
	}
	for _, s := range strings.Split(os.Getenv("ADMIN_IDS"), ",") {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		id, e := strconv.ParseInt(s, 10, 64)
		if e != nil || id <= 0 {
			return c, fmt.Errorf("invalid ADMIN_IDS entry %q", s)
		}
		c.Admins[id] = true
	}
	var missing []string
	for _, item := range []struct{ name, value string }{{"BOT_TOKEN", c.BotToken}, {"BOT_INTERNAL_TOKEN", c.BotInternalToken}, {"CARD_NUMBER", c.CardNumber}, {"PANEL_API_TOKEN", c.PanelToken}, {"ADMIN_IDS", os.Getenv("ADMIN_IDS")}, {"MINI_APP_URL", c.MiniAppURL}, {"PANEL_URL", c.PanelURL}, {"PANEL_SUBSCRIPTION_BASE_URL", c.SubscriptionBase}, {"PACKAGES_JSON", os.Getenv("PACKAGES_JSON")}} {
		if strings.TrimSpace(item.value) == "" {
			missing = append(missing, item.name)
		}
	}
	if len(missing) > 0 {
		return c, fmt.Errorf("missing settings in environment or .env: %s", strings.Join(missing, ", "))
	}
	for _, v := range []string{c.MiniAppURL, c.PanelURL, c.SubscriptionBase} {
		u, e := url.Parse(v)
		if e != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
			return c, fmt.Errorf("expected HTTPS URL: %q", v)
		}
	}
	if !strings.HasSuffix(c.SubscriptionBase, "/") {
		return c, errors.New("PANEL_SUBSCRIPTION_BASE_URL must end in /")
	}
	if e := json.Unmarshal([]byte(os.Getenv("PACKAGES_JSON")), &c.Packages); e != nil || len(c.Packages) == 0 {
		return c, errors.New("PACKAGES_JSON must be a nonempty JSON array")
	}
	seen := map[string]bool{}
	for _, p := range c.Packages {
		if p.ID == "" || p.Name == "" || p.PriceToman <= 0 || seen[p.ID] {
			return c, errors.New("packages need unique IDs, names and positive integer prices")
		}
		seen[p.ID] = true
	}
	return c, nil
}

// loadDotEnv reads simple KEY=VALUE lines; already-set process variables win.
// This keeps deployment environment configuration authoritative.
func loadDotEnv(path string) error {
	f, e := os.Open(path)
	if errors.Is(e, os.ErrNotExist) {
		return nil
	}
	if e != nil {
		return fmt.Errorf("open .env: %w", e)
	}
	defer f.Close()
	return parseDotEnv(f)
}

func parseDotEnv(r io.Reader) error {
	s := bufio.NewScanner(r)
	for line := 1; s.Scan(); line++ {
		text := strings.TrimSpace(s.Text())
		if text == "" || strings.HasPrefix(text, "#") {
			continue
		}
		key, value, ok := strings.Cut(text, "=")
		key = strings.TrimSpace(key)
		if !ok || key == "" || strings.ContainsAny(key, " \t") {
			return fmt.Errorf("invalid .env line %d: expected KEY=VALUE", line)
		}
		value = strings.TrimSpace(value)
		if len(value) >= 2 && ((value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'')) {
			value = value[1 : len(value)-1]
		}
		if _, set := os.LookupEnv(key); !set {
			if e := os.Setenv(key, value); e != nil {
				return fmt.Errorf("invalid .env key on line %d", line)
			}
		}
	}
	if e := s.Err(); e != nil {
		return fmt.Errorf("read .env: %w", e)
	}
	return nil
}
