package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

// validateInitData follows Telegram's WebAppData HMAC specification. User identity always comes from signed data.
func validateInitData(raw, token string, now time.Time) (int64, error) {
	vals, err := url.ParseQuery(raw)
	if err != nil || len(vals) == 0 {
		return 0, errors.New("invalid initData")
	}
	hash := vals.Get("hash")
	supplied, err := hex.DecodeString(hash)
	if err != nil || len(supplied) != sha256.Size {
		return 0, errors.New("invalid hash")
	}
	keys := make([]string, 0, len(vals))
	for k, v := range vals {
		if k == "hash" {
			continue
		}
		if len(v) != 1 {
			return 0, errors.New("duplicate initData field")
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	lines := make([]string, 0, len(keys))
	for _, k := range keys {
		lines = append(lines, k+"="+vals.Get(k))
	}
	secret := hmac.New(sha256.New, []byte("WebAppData"))
	secret.Write([]byte(token))
	mac := hmac.New(sha256.New, secret.Sum(nil))
	mac.Write([]byte(strings.Join(lines, "\n")))
	if !hmac.Equal(supplied, mac.Sum(nil)) {
		return 0, errors.New("bad signature")
	}
	ts, err := strconv.ParseInt(vals.Get("auth_date"), 10, 64)
	if err != nil || time.Unix(ts, 0).After(now.Add(time.Minute)) || now.Sub(time.Unix(ts, 0)) > 24*time.Hour {
		return 0, errors.New("expired initData")
	}
	var user struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal([]byte(vals.Get("user")), &user); err != nil || user.ID <= 0 {
		return 0, errors.New("invalid user")
	}
	return user.ID, nil
}
