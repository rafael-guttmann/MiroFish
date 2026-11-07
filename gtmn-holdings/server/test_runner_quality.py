import unittest
from types import SimpleNamespace
from unittest.mock import patch

from runner import AgentSDKRunner


class FakeStore:
    def rows(self, _query, _params):
        return [
            {"name": "portfolio.csv", "text": "ZenCredit portfolio PD estimate and loss history."},
            {"name": "unrelated.txt", "text": "Office lunch schedule and room booking."},
        ]


class FakeStream:
    def __init__(self, response):
        self.response = response

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def __iter__(self):
        return iter(())

    def get_final_message(self):
        return self.response


class FakeMessages:
    def __init__(self):
        self.calls = []
        self.responses = [
            SimpleNamespace(content=[SimpleNamespace(type="text", text="First part")],
                            stop_reason="max_tokens", usage=None),
            SimpleNamespace(content=[SimpleNamespace(type="text", text="Second part")],
                            stop_reason="end_turn", usage=None),
        ]

    def stream(self, **kwargs):
        self.calls.append(kwargs)
        return FakeStream(self.responses.pop(0))


class RunnerQualityTests(unittest.TestCase):
    def test_relevant_documents_excludes_unrelated_uploads(self):
        runner = AgentSDKRunner.__new__(AgentSDKRunner)
        runner.s = FakeStore()

        excerpts = runner._relevant_documents(10, "ZenCredit portfolio PD and loss estimate")

        self.assertEqual(len(excerpts), 1)
        self.assertIn("portfolio.csv", excerpts[0])
        self.assertNotIn("lunch", excerpts[0])

    def test_title_cleanup_and_verification_note(self):
        self.assertEqual(AgentSDKRunner._clean_title("# Memo title\n\nBody", "Memo title"), "Body")
        note = AgentSDKRunner._verification_note(
            "PASS WITH FLAGS",
            "| Claim | Verdict | Evidence |\n|---|---|---|\n| Tax rate | UNVERIFIED | No primary source |")
        self.assertIn("PASS WITH FLAGS", note)
        self.assertIn("Tax rate", note)

    def test_say_streams_and_continues_truncated_output_with_model_effort(self):
        runner = AgentSDKRunner.__new__(AgentSDKRunner)
        messages = FakeMessages()
        runner.client = SimpleNamespace(beta=SimpleNamespace(messages=messages))
        runner.s = FakeStore()
        runner.model = "claude-sonnet-5-5"
        runner.TOOLS, runner.DEEP_TOOLS = [], []

        with patch("runner.cost.gate"), patch("runner.cost.record"):
            result = runner._say("System", "Mandate: ZenCredit portfolio PD", max_tokens=20,
                                 job_id=10, model="claude-opus-5-5", effort="high", include_docs=True)

        self.assertEqual(result, "First part\nSecond part")
        self.assertEqual(messages.calls[0]["model"], "claude-opus-5-5")
        self.assertEqual(messages.calls[0]["output_config"], {"effort": "high"})
        self.assertIn("portfolio.csv", messages.calls[0]["messages"][0]["content"])
        self.assertEqual(messages.calls[1]["messages"][-1]["content"],
                         "Continue exactly where you left off. Do not repeat earlier text.")


if __name__ == "__main__":
    unittest.main()
