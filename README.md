# PULSE VPN shop

The Go HTTP service serves the existing Telegram Mini App from `web/`, validates
Telegram `initData` on every customer request, owns MySQL and the existing
3x-ui client API, and validates receipt uploads. The Python `pyTelegramBotAPI`
process handles Telegram polling, notifications and administrator commands.
It uses a private HTTP token to call Go; Redis is not needed.

## Setup

Copy `.env.example` to `.env` and set real values. Keep `.env` out of Git.
Set `BOT_INTERNAL_TOKEN` to a long random value shared by the two services.
The package IDs and prices in `PACKAGES_JSON` are the server's source of truth;
the UI has metadata for the listed plan IDs. The configured card number is
shown at checkout. The bot needs a public HTTPS `MINI_APP_URL`; the Go port
must be exposed behind your HTTPS reverse proxy for Telegram.

```sh
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Compose starts a MySQL 8.4 container and the backend connects to it with
`DB_DRIVER=mysql` and `DB_DSN=...`. Receipts are stored in a named volume and
the bot accesses them through authenticated internal HTTP. Image builds need
access to the Go module proxy and PyPI.

## Admin workflow

Open the bot in a private chat and use `/pending` or `/receipt ORDER_ID`.
After manually reviewing payment, use `/approve ORDER_ID` or
`/reject ORDER_ID`. Approval credits exactly 10,000 toman once, even if
repeated. `/match ORDER_ID` shows candidates whose panel email starts with
the customer's Telegram ID. Select one exact client and inbound in the panel
before clicking its button, or use `/assign ORDER_ID EMAIL INBOUND_ID` for
an explicitly checked client. The Go service validates the actual client,
inbound, unique subscription ID and active links and stores that precise
association. Use `/deliver ORDER_ID` to resend the link if delivery fails.

Customers can reopen the Mini App for order history, wallet credit, remaining
time and their subscription URL. Panel traffic usage is not currently returned
by the existing panel client API path, so the UI does not invent usage numbers.
Wallet spending and manual wallet top-ups have no backend operation and remain
disabled in checkout.

## Validation

```sh
go test ./...
python -m unittest discover -s bot -p 'test_*.py'
python -m py_compile bot/bot.py
docker compose config --quiet
```
