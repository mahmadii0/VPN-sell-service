"""Telegram transport and admin commands; Go owns payment, SQLite and panel state."""
import io
import logging
import os
import threading
import time

import requests
import telebot
from telebot import types
from telebot import apihelper

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger("pulse-bot")
TOKEN = os.environ["BOT_TOKEN"]
SECRET = os.environ["BOT_INTERNAL_TOKEN"]
MINI_URL = os.environ["MINI_APP_URL"]
BACKEND = os.environ.get("BACKEND_URL", "http://backend:8080").rstrip("/")
ADMINS = {int(value) for value in os.environ["ADMIN_IDS"].split(",") if value.strip()}
if not ADMINS:
    raise RuntimeError("ADMIN_IDS must contain an administrator")

proxy = os.getenv("TELEGRAM_PROXY")

if proxy:
    apihelper.proxy = {
        "http": proxy,
        "https": proxy,
    }
bot = telebot.TeleBot(TOKEN)


class BackendError(Exception):
    pass


def api(method, path, admin=None, payload=None, binary=False):
    headers = {"X-Bot-Token": SECRET}
    if admin is not None:
        if admin not in ADMINS:
            raise BackendError("admin required")
        headers["X-Admin-ID"] = str(admin)
    try:
        response = requests.request(method, BACKEND + path, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        return response.content if binary else response.json()
    except requests.RequestException as exc:
        detail = getattr(exc.response, "text", "") if exc.response is not None else str(exc)
        raise BackendError(detail[:300]) from exc


def order_id(parts):
    if len(parts) < 2 or not parts[1].isdigit() or int(parts[1]) < 1:
        raise BackendError("positive order ID required")
    return int(parts[1])


def send_link(order, admin):
    order_id_value = order["id"]
    data = api("GET", f"/internal/orders/{order_id_value}/link", admin)
    try:
        bot.send_message(data["user_id"], f"Service for order #{order_id_value}:\n{data['subscription_url']}")
    except Exception as exc:
        api("POST", f"/internal/orders/{order_id_value}/delivery", admin, {"error": str(exc)[:500]})
        raise
    api("POST", f"/internal/orders/{order_id_value}/delivery", admin, {"error": ""})


def assign(order_id_value, admin, payload):
    api("POST", f"/internal/orders/{order_id_value}/assign", admin, payload)
    try:
        send_link({"id": order_id_value}, admin)
        return "Client assigned and subscription link sent."
    except Exception as exc:
        return f"Client assigned; delivery pending: {exc}. Retry with /deliver {order_id_value}."


@bot.message_handler(commands=["start"])
def start(message):
    if message.chat.type != "private":
        return
    markup = types.InlineKeyboardMarkup()
    markup.add(types.InlineKeyboardButton("Open shop", web_app=types.WebAppInfo(MINI_URL)))
    bot.send_message(message.chat.id, "Open the shop to browse packages, submit receipts, and view services.", reply_markup=markup)


@bot.message_handler(commands=["pending", "receipt", "approve", "reject", "match", "assign", "deliver"])
def admin_command(message):
    if message.chat.type != "private" or message.from_user.id not in ADMINS:
        return
    admin = message.from_user.id
    parts = message.text.split()
    command = parts[0].split("@")[0]
    try:
        if command == "/pending":
            orders = api("GET", "/internal/orders/pending", admin)["orders"]
            if not orders:
                bot.send_message(message.chat.id, "No pending orders.")
            for order in orders:
                markup = types.InlineKeyboardMarkup()
                markup.add(types.InlineKeyboardButton("Approve after review", callback_data=f"a:{order['id']}"),
                           types.InlineKeyboardButton("Reject", callback_data=f"r:{order['id']}"))
                bot.send_message(message.chat.id,
                                 f"#{order['id']} user {order['user_id']}: {order['package_name']}, {order['price_toman']} toman. /receipt {order['id']}",
                                 reply_markup=markup)
            return
        number = order_id(parts)
        path = f"/internal/orders/{number}"
        if command == "/receipt":
            order = api("GET", path, admin)
            image = io.BytesIO(api("GET", path + "/receipt", admin, binary=True))
            image.name = "receipt.jpg"
            bot.send_photo(message.chat.id, image, caption=f"Order #{number}, {order['price_toman']} toman, user {order['user_id']}. Receipt unverified.")
        elif command in ("/approve", "/reject"):
            action = command[1:]
            result = api("POST", path + f"/{action}", admin)
            label = "approved" if action == "approve" else "rejected"
            bot.send_message(message.chat.id, f"Order #{number} {label}." if result["changed"] else f"Order #{number} already {label}.")
        elif command == "/match":
            matches = api("GET", path + "/matches", admin)["candidates"]
            if not matches:
                bot.send_message(message.chat.id, "No prefix matches. Use /assign ORDER_ID EMAIL INBOUND_ID after checking the panel.")
            for candidate in matches:
                markup = types.InlineKeyboardMarkup()
                markup.add(types.InlineKeyboardButton("Select this exact client", callback_data=f"m:{candidate['id']}:{number}"))
                bot.send_message(message.chat.id,
                                 f"Order #{number}: {candidate['email']} (client {candidate['client_id']}), inbound {candidate['inbound_id']}, sub ID {candidate['sub_id']}. Verify in the panel before selecting.",
                                 reply_markup=markup)
        elif command == "/assign":
            if len(parts) != 4 or not parts[3].isdigit():
                raise BackendError("usage: /assign ORDER_ID EMAIL INBOUND_ID")
            bot.send_message(message.chat.id, assign(number, admin, {"email": parts[2], "inbound_id": int(parts[3])}))
        elif command == "/deliver":
            send_link({"id": number}, admin)
            bot.send_message(message.chat.id, "Link sent.")
    except (BackendError, ValueError, requests.RequestException) as exc:
        bot.send_message(message.chat.id, f"Action failed: {exc}")


@bot.callback_query_handler(func=lambda call: True)
def callback(call):
    if not call.message or call.message.chat.type != "private" or call.from_user.id not in ADMINS:
        bot.answer_callback_query(call.id, "Admin only")
        return
    admin = call.from_user.id
    try:
        parts = call.data.split(":")
        if parts[0] in ("a", "r") and len(parts) == 2 and parts[1].isdigit():
            action = "approve" if parts[0] == "a" else "reject"
            result = api("POST", f"/internal/orders/{parts[1]}/{action}", admin)
            label = "approved" if action == "approve" else "rejected"
            message = f"Order #{parts[1]} {label}." if result["changed"] else "Already reviewed."
        elif parts[0] == "m" and len(parts) == 3 and all(x.isdigit() for x in parts[1:]):
            message = assign(int(parts[2]), admin, {"candidate_id": int(parts[1])})
        else:
            raise BackendError("invalid selection")
        bot.answer_callback_query(call.id, "Done")
        bot.send_message(call.message.chat.id, message)
    except (BackendError, ValueError) as exc:
        bot.answer_callback_query(call.id, "Action failed")
        bot.send_message(call.message.chat.id, f"Action failed: {exc}")


def deliver_events():
    while True:
        try:
            events = api("GET", "/internal/events")["events"]
            for event in events:
                order = event["order"]
                kind = event["kind"]
                if kind == "created":
                    if order["status"] == "pending":
                        sent = 0
                        for admin in ADMINS:
                            try:
                                image = io.BytesIO(api("GET", f"/internal/orders/{order['id']}/receipt", admin, binary=True))
                                image.name = "receipt.jpg"
                                bot.send_photo(admin, image, caption=f"Pending order #{order['id']}\nUser: {order['user_id']}\nPackage: {order['package_name']}\nExact price: {order['price_toman']} toman\nReceipt unverified. /approve {order['id']} /reject {order['id']} /match {order['id']}")
                                sent += 1
                            except Exception:
                                LOG.exception("Receipt notification to admin %s failed", admin)
                        if not sent:
                            continue
                elif kind in ("approved", "rejected"):
                    try:
                        text = (f"Order #{order['id']} approved. An admin will assign your service." if kind == "approved"
                                else f"Order #{order['id']} rejected. Contact support if needed.")
                        bot.send_message(order["user_id"], text)
                    except Exception:
                        LOG.exception("Customer notification failed for order %s", order["id"])
                api("POST", f"/internal/events/{event['id']}/ack")
        except Exception:
            LOG.exception("Event delivery failed")
        time.sleep(5)


if __name__ == "__main__":
    threading.Thread(target=deliver_events, daemon=True).start()
    bot.infinity_polling(timeout=25, long_polling_timeout=25)
