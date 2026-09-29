#!/bin/sh
set -eu
mkdir -p /data/receipts
if [ ! -f /data/shop.sqlite ]; then
  cp /seed/shop.sqlite /data/shop.sqlite
fi
if [ ! -f /data/.receipts_seeded ]; then
  if [ -z "$(ls -A /data/receipts)" ]; then
    cp -a /seed/receipts/. /data/receipts/
  fi
  touch /data/.receipts_seeded
fi
exec /app/shop
