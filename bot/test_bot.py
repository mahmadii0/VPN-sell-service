import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

os.environ["BOT_TOKEN"] = "123456:test-token"
os.environ["BOT_INTERNAL_TOKEN"] = "test-internal-token"
os.environ["ADMIN_IDS"] = "999"
os.environ["MINI_APP_URL"] = "https://example.com/"

spec = importlib.util.spec_from_file_location("pulse_bot", Path(__file__).with_name("bot.py"))
pulse = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pulse)


class BotContractTests(unittest.TestCase):
    def test_admin_commands_cannot_use_customer_identity(self):
        with self.assertRaises(pulse.BackendError):
            pulse.api("POST", "/internal/orders/1/approve", admin=123)
        with patch.object(pulse.requests, "request") as send:
            response = send.return_value
            response.json.return_value = {"changed": True}
            result = pulse.api("POST", "/internal/orders/1/approve", admin=999)
        self.assertTrue(result["changed"])
        self.assertEqual(send.call_args.kwargs["headers"]["X-Admin-ID"], "999")
        self.assertEqual(send.call_args.kwargs["headers"]["X-Bot-Token"], "test-internal-token")

    def test_assignment_waits_for_explicit_selection(self):
        with patch.object(pulse, "api", return_value={"user_id": 123}) as request, patch.object(pulse, "send_link") as deliver:
            result = pulse.assign(7, 999, {"candidate_id": 42})
        request.assert_called_once_with("POST", "/internal/orders/7/assign", 999, {"candidate_id": 42})
        deliver.assert_called_once_with({"id": 7}, 999)
        self.assertIn("assigned", result)


if __name__ == "__main__":
    unittest.main()
