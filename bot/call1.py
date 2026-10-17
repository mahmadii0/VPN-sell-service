import base64
import binascii
import re
from typing import List
import requests
from telebot import types
import json
import os
import threading
from pathlib import Path
from typing import Dict, Optional

import requests


# برای نگهداری وضعیت کاربرانی که روی «دریافت از ساب‌کانفیگ» کلیک کرده‌اند
reserveNotif = {}


# پروتکل‌های رایج کانفیگ
CONFIG_PROTOCOLS = (
    "vmess://",
    "vless://",
    "trojan://",
    "ss://",
    "ssconf://",
    "socks://",
    "http://",
    "https://",
    "tuic://",
    "hysteria://",
    "hysteria2://",
)

DOWNLOAD_DIR = Path("downloads")
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

GITHUB_API_URL = "https://api.github.com/repos/{repo}/releases/latest"

DOWNLOAD_LOCK = threading.Lock()

DOWNLOAD_PRODUCTS = {
    "v2rayn_windows": {
        "repo": "2dust/v2rayN",
        "asset_name": "v2rayN-windows-64.zip",
        "local_name": "v2rayN-windows-64.zip",
        "title": "v2rayN برای ویندوز",
    },
    "v2rayng_arm64": {
        "repo": "2dust/v2rayNG",
        "asset_name": "v2rayNG_2.2.6_arm64-v8a.apk",
        "local_name": "v2rayNG_2.2.6_arm64-v8a.apk",
        "title": "v2rayNG نسخه ARM64",
    },
    "v2rayng_fdroid_arm64": {
        "repo": "2dust/v2rayNG",
        "asset_name": "v2rayNG_2.2.6-fdroid_arm64-v8a.apk",
        "local_name": "v2rayNG_2.2.6-fdroid_arm64-v8a.apk",
        "title": "v2rayNG F-Droid نسخه ARM64",
    },
}



def create_main_keyboard():
    """
    در صورت نیاز، کیبورد اصلی ربات را اینجا بساز.
    این تابع فقط برای جلوگیری از خطا در callback مربوط به groups
    قرار داده شده است.
    """

    keyboard = types.InlineKeyboardMarkup()
    keyboard.add(
        types.InlineKeyboardButton(
            text="بازگشت",
            callback_data="groups"
        )
    )

    return keyboard


def is_config_line(line: str) -> bool:
    """
    بررسی می‌کند که آیا یک خط، کانفیگ معتبر یا احتمالی است یا نه.
    """

    line = line.strip()

    if not line:
        return False

    return line.lower().startswith(CONFIG_PROTOCOLS)


def decode_subscription_content(content: str) -> str:
    """
    بعضی ساب‌کانفیگ‌ها به‌صورت Base64 برگردانده می‌شوند.
    اگر محتوا Base64 باشد، decode می‌شود؛
    در غیر این صورت همان متن خام برگردانده خواهد شد.
    """

    content = content.strip()

    if not content:
        return ""

    # اگر از قبل شامل پروتکل‌های رایج باشد، نیازی به decode ندارد
    if any(protocol in content.lower() for protocol in CONFIG_PROTOCOLS):
        return content

    # حذف فاصله‌ها و خط‌های اضافه برای Base64
    compact_content = re.sub(r"\s+", "", content)

    # Base64 معمولاً طولی مضربی از ۴ دارد
    padding = "=" * (-len(compact_content) % 4)

    try:
        decoded = base64.b64decode(
            compact_content + padding,
            validate=False
        ).decode("utf-8", errors="ignore")

        # فقط در صورتی decode را قبول کن که خروجی شبیه کانفیگ باشد
        if any(
            protocol in decoded.lower()
            for protocol in CONFIG_PROTOCOLS
        ):
            return decoded

    except (binascii.Error, ValueError, UnicodeDecodeError):
        pass

    return content


def extract_configs(content: str) -> List[str]:
    """
    کانفیگ‌ها را از متن ساب‌کانفیگ استخراج می‌کند.
    کانفیگ‌های تکراری حذف می‌شوند.
    """

    decoded_content = decode_subscription_content(content)

    configs = []
    seen = set()

    for line in decoded_content.splitlines():
        line = line.strip()

        # حذف شماره‌گذاری، فاصله و بعضی کاراکترهای اضافی ابتدای خط
        line = re.sub(r"^[\-\*\d\.\)\s]+", "", line).strip()

        if not is_config_line(line):
            continue

        if line not in seen:
            seen.add(line)
            configs.append(line)

    return configs


def download_subscription(url: str) -> List[str]:
    """
    ساب‌کانفیگ را از URL دریافت و کانفیگ‌های داخل آن را استخراج می‌کند.
    """

    response = requests.get(
        url,
        timeout=30,
        headers={
            "User-Agent": (
                "Mozilla/5.0 "
                "(compatible; TelegramBot/1.0)"
            )
        }
    )

    response.raise_for_status()

    return extract_configs(response.text)


def send_configs_one_by_one(bot, chat_id: int, configs: List[str]):
    """
    کانفیگ‌ها را به‌صورت تکی برای کاربر ارسال می‌کند.
    """

    for index, config in enumerate(configs, start=1):
        try:
            bot.send_message(
                chat_id,
                f"کانفیگ شماره {index}:\n\n"
                f"<code>{config}</code>",
                parse_mode="HTML"
            )

        except Exception:
            # اگر کانفیگ شامل کاراکترهای مشکل‌دار برای HTML باشد،
            # دوباره بدون parse_mode ارسال می‌شود.
            bot.send_message(
                chat_id,
                f"کانفیگ شماره {index}:\n\n{config}"
            )


def ask_for_subscription_link(bot, call):
    """
    از کاربر لینک ساب‌کانفیگ را درخواست می‌کند.
    """

    user_id = call.from_user.id
    chat_id = call.message.chat.id

    reserveNotif[user_id] = {
        "action": "waiting_for_subscription_link",
        "chat_id": chat_id
    }

    bot.answer_callback_query(call.id)

    bot.send_message(
        chat_id,
        "لطفاً لینک ساب‌کانفیگ را ارسال کن.\n\n"
        "مثال:\n"
        "https://example.com/subscription",
        reply_markup=types.ForceReply(
            selective=True,
            input_field_placeholder="لینک ساب‌کانفیگ را بفرست"
        )
    )


def handle_subscription_link(bot, message):
    """
    لینک ارسال‌شده توسط کاربر را دریافت می‌کند،
    ساب‌کانفیگ را دانلود می‌کند و کانفیگ‌ها را تکی می‌فرستد.
    """

    user_id = message.from_user.id
    chat_id = message.chat.id

    user_state = reserveNotif.get(user_id)

    if not user_state:
        return False

    if user_state.get("action") != "waiting_for_subscription_link":
        return False

    url = (message.text or "").strip()

    # بعد از دریافت لینک، وضعیت کاربر حذف می‌شود
    reserveNotif.pop(user_id, None)

    if not re.match(r"^https?://", url, re.IGNORECASE):
        bot.send_message(
            chat_id,
            "لینک واردشده معتبر نیست.\n"
            "لطفاً لینکی را بفرست که با http:// یا https:// شروع شود."
        )
        return True

    loading_message = bot.send_message(
        chat_id,
        "در حال دریافت ساب‌کانفیگ، لطفاً کمی صبر کن..."
    )

    try:
        configs = download_subscription(url)

        if not configs:
            bot.edit_message_text(
                "از این لینک هیچ کانفیگ معتبری پیدا نشد.",
                chat_id=chat_id,
                message_id=loading_message.message_id
            )
            return True

        bot.edit_message_text(
            f"{len(configs)} کانفیگ پیدا شد. "
            "ارسال کانفیگ‌ها شروع می‌شود...",
            chat_id=chat_id,
            message_id=loading_message.message_id
        )

        send_configs_one_by_one(
            bot=bot,
            chat_id=chat_id,
            configs=configs
        )

        bot.send_message(
            chat_id,
            f"ارسال {len(configs)} کانفیگ به پایان رسید."
        )

    except requests.exceptions.Timeout:
        bot.edit_message_text(
            "اتصال به ساب‌کانفیگ بیشتر از حد مجاز طول کشید.",
            chat_id=chat_id,
            message_id=loading_message.message_id
        )

    except requests.exceptions.RequestException as error:
        bot.edit_message_text(
            "دریافت ساب‌کانفیگ با خطا مواجه شد.\n\n"
            f"جزئیات خطا: {error}",
            chat_id=chat_id,
            message_id=loading_message.message_id
        )

    except Exception as error:
        bot.edit_message_text(
            "هنگام پردازش ساب‌کانفیگ خطایی رخ داد.\n\n"
            f"جزئیات خطا: {error}",
            chat_id=chat_id,
            message_id=loading_message.message_id
        )

    return True




def get_metadata_path(product_key: str) -> Path:
    return DOWNLOAD_DIR / f"{product_key}.json"


def get_cached_metadata(product_key: str) -> Optional[Dict]:
    metadata_path = get_metadata_path(product_key)

    if not metadata_path.exists():
        return None

    try:
        with metadata_path.open("r", encoding="utf-8") as file:
            return json.load(file)

    except (json.JSONDecodeError, OSError):
        return None


def save_cached_metadata(product_key: str, metadata: Dict):
    metadata_path = get_metadata_path(product_key)

    temporary_path = metadata_path.with_suffix(".tmp")

    with temporary_path.open("w", encoding="utf-8") as file:
        json.dump(metadata, file, ensure_ascii=False, indent=2)

    temporary_path.replace(metadata_path)


def get_latest_release(product_key: str) -> Dict:
    product = DOWNLOAD_PRODUCTS[product_key]

    api_url = GITHUB_API_URL.format(
        repo=product["repo"]
    )

    response = requests.get(
        api_url,
        timeout=30,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "Telegram-Download-Bot",
        }
    )

    response.raise_for_status()

    release = response.json()

    if release.get("draft"):
        raise RuntimeError("آخرین release هنوز draft است.")

    if release.get("prerelease"):
        raise RuntimeError("آخرین release یک نسخه prerelease است.")

    asset = None

    for current_asset in release.get("assets", []):
        if current_asset.get("name") == product["asset_name"]:
            asset = current_asset
            break

    if asset is None:
        raise FileNotFoundError(
            f"فایل {product['asset_name']} در آخرین release پیدا نشد."
        )

    return {
        "product_key": product_key,
        "repo": product["repo"],
        "release_id": release.get("id"),
        "tag_name": release.get("tag_name"),
        "release_name": release.get("name"),
        "asset_id": asset.get("id"),
        "asset_name": asset.get("name"),
        "asset_size": asset.get("size"),
        "download_url": asset.get("browser_download_url"),
        "downloaded_file": str(
            DOWNLOAD_DIR / product["local_name"]
        ),
    }


def is_cached_file_valid(
    product_key: str,
    latest_release: Dict
) -> bool:
    cached_metadata = get_cached_metadata(product_key)

    if not cached_metadata:
        return False

    cached_file = Path(
        cached_metadata.get("downloaded_file", "")
    )

    if not cached_file.exists():
        return False

    return (
        cached_metadata.get("release_id")
        == latest_release.get("release_id")
        and
        cached_metadata.get("asset_id")
        == latest_release.get("asset_id")
        and
        cached_metadata.get("asset_name")
        == latest_release.get("asset_name")
    )


def remove_old_cached_file(product_key: str):
    cached_metadata = get_cached_metadata(product_key)

    if cached_metadata:
        old_file = Path(
            cached_metadata.get("downloaded_file", "")
        )

        if old_file.exists():
            old_file.unlink()

    metadata_path = get_metadata_path(product_key)

    if metadata_path.exists():
        metadata_path.unlink()


def download_latest_file(product_key: str) -> Path:
    """
    آخرین release را بررسی می‌کند.
    اگر فایل مربوط به همان release قبلاً دانلود شده باشد،
    همان فایل قبلی را برمی‌گرداند.

    اگر release جدید باشد، فایل قبلی حذف و فایل جدید دانلود می‌شود.
    """

    if product_key not in DOWNLOAD_PRODUCTS:
        raise ValueError(
            f"محصول ناشناخته است: {product_key}"
        )

    with DOWNLOAD_LOCK:
        latest_release = get_latest_release(product_key)

        if is_cached_file_valid(
            product_key,
            latest_release
        ):
            cached_metadata = get_cached_metadata(product_key)

            return Path(
                cached_metadata["downloaded_file"]
            )

        remove_old_cached_file(product_key)

        product = DOWNLOAD_PRODUCTS[product_key]

        final_path = DOWNLOAD_DIR / product["local_name"]
        temporary_path = final_path.with_suffix(
            final_path.suffix + ".part"
        )

        download_url = latest_release["download_url"]

        response = requests.get(
            download_url,
            stream=True,
            timeout=(30, 300),
            headers={
                "Accept": "application/octet-stream",
                "User-Agent": "Telegram-Download-Bot",
            }
        )

        response.raise_for_status()

        try:
            with temporary_path.open("wb") as file:
                for chunk in response.iter_content(
                    chunk_size=1024 * 1024
                ):
                    if chunk:
                        file.write(chunk)

            temporary_path.replace(final_path)

        except Exception:
            if temporary_path.exists():
                temporary_path.unlink()

            raise

        latest_release["downloaded_file"] = str(final_path)

        save_cached_metadata(
            product_key,
            latest_release
        )

        return final_path

def send_latest_product(bot, chat_id: int, product_key: str):
    product = DOWNLOAD_PRODUCTS[product_key]

    status_message = bot.send_message(
        chat_id,
        f"در حال بررسی آخرین نسخهٔ {product['title']}..."
    )

    try:
        file_path = download_latest_file(product_key)

        with file_path.open("rb") as file:
            bot.send_document(
                chat_id,
                file,
                caption=(
                    f"{product['title']}\n"
                    f"فایل: {file_path.name}"
                )
            )

        bot.edit_message_text(
            f"فایل {product['title']} با موفقیت ارسال شد.",
            chat_id=chat_id,
            message_id=status_message.message_id
        )

    except requests.exceptions.Timeout:
        bot.edit_message_text(
            "اتصال به منبع دانلود طول کشید و عملیات متوقف شد.",
            chat_id=chat_id,
            message_id=status_message.message_id
        )

    except requests.exceptions.HTTPError as error:
        bot.edit_message_text(
            f"منبع دانلود خطای HTTP برگرداند:\n{error}",
            chat_id=chat_id,
            message_id=status_message.message_id
        )

    except FileNotFoundError as error:
        bot.edit_message_text(
            f"فایل موردنظر در آخرین release پیدا نشد:\n{error}",
            chat_id=chat_id,
            message_id=status_message.message_id
        )

    except Exception as error:
        bot.edit_message_text(
            f"خطایی هنگام دریافت فایل رخ داد:\n{error}",
            chat_id=chat_id,
            message_id=status_message.message_id
        )






def callback1(bot, call):
    """
    این تابع را در callback_query_handler اصلی ربات صدا بزن.
    """

    if call.data == "configsBySub":
        ask_for_subscription_link(bot, call)
        return

    if call.data == "download_v2rayn_windows":
        bot.answer_callback_query(call.id)

        send_latest_product(
            bot=bot,
            chat_id=call.message.chat.id,
            product_key="v2rayn_windows"
        )

        return

    if call.data == "download_v2rayng_arm64":
        bot.answer_callback_query(call.id)

        send_latest_product(
            bot=bot,
            chat_id=call.message.chat.id,
            product_key="v2rayng_arm64"
        )

        return

    if call.data == "download_v2rayng_fdroid_arm64":
        bot.answer_callback_query(call.id)

        send_latest_product(
            bot=bot,
            chat_id=call.message.chat.id,
            product_key="v2rayng_fdroid_arm64"
        )

        return


