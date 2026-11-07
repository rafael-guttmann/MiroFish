import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from runner import AgentSDKRunner


class FakeStore:
    def __init__(self, preset=None):
        self.preset = preset

    def one(self, query, _params=()):
        return {"model": self.preset} if "SELECT model FROM jobs" in query else None

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


def reply(text, stop="end_turn"):
    return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)], stop_reason=stop, usage=None)


class FakeMessages:
    def __init__(self, responses=None):
        self.calls = []
        self.responses = responses or [reply("First part", "max_tokens"), reply("Second part")]

    def stream(self, **kwargs):
        self.calls.append(kwargs)
        return FakeStream(self.responses.pop(0) if len(self.responses) > 1 else self.responses[0])


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


def build_runner(preset=None, available=None):
    """A runner whose model list is already cached, so nothing touches the network."""
    runner = AgentSDKRunner.__new__(AgentSDKRunner)
    messages = FakeMessages([reply("Done")])
    runner.client = SimpleNamespace(beta=SimpleNamespace(messages=messages))
    runner.s = FakeStore(preset)
    runner.TOOLS, runner.DEEP_TOOLS = [], []
    runner._avail = (time.time() + 600, available)
    return runner, messages


class ModelRoutingTests(unittest.TestCase):
    def setUp(self):
        for name in ("gate", "record"):
            patcher = patch(f"runner.cost.{name}")
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_each_role_follows_the_preset_chosen_for_the_job(self):
        auto, _ = build_runner(None)
        self.assertEqual(auto.model_for(1, "work"), "claude-sonnet-5-5")
        self.assertEqual(auto.model_for(1, "pen"), "claude-opus-5-5")
        self.assertEqual(auto.model_for(1, "verify"), "claude-opus-5-5")
        self.assertEqual(auto.model_for(None, "pen"), "claude-opus-5-5")
        haiku, _ = build_runner("haiku")
        self.assertEqual({haiku.model_for(1, r) for r in ("work", "pen", "verify")}, {"claude-haiku-5-5"})
        fable, _ = build_runner("fable")
        self.assertEqual(fable.model_for(1, "verify"), "claude-fable-5-1")

    def test_say_sends_the_role_model_and_leaves_room_to_think(self):
        runner, messages = build_runner("auto")
        runner._say("S", "U", max_tokens=1000, job_id=7, role="verify", effort="medium")
        runner._say("S", "U", max_tokens=1000, job_id=7)
        runner._say("S", "U", max_tokens=1000, job_id=7, role="pen", effort="high")
        verify, work, pen = messages.calls
        self.assertEqual(verify["model"], "claude-opus-5-5")
        self.assertEqual(verify["max_tokens"], 1000 + runner.THINK_ROOM["medium"])
        self.assertEqual(verify["output_config"], {"effort": "medium"})
        self.assertEqual(work["model"], "claude-sonnet-5-5")
        self.assertEqual(work["max_tokens"], 1000 + 6000)
        self.assertNotIn("output_config", work)
        self.assertEqual(pen["max_tokens"], 1000 + runner.THINK_ROOM["high"])

    def test_an_explicit_model_overrides_the_preset(self):
        runner, messages = build_runner("haiku")
        runner._say("S", "U", job_id=7, model="claude-opus-5-5")
        self.assertEqual(messages.calls[0]["model"], "claude-opus-5-5")

    def test_effort_is_left_out_for_models_that_reject_it(self):
        runner, messages = build_runner("haiku", {"claude-haiku-5-5": False})
        runner._say("S", "U", job_id=7, effort="high")
        self.assertNotIn("output_config", messages.calls[0])
        runner, messages = build_runner("haiku", {"claude-haiku-5-5": True})
        runner._say("S", "U", job_id=7, effort="high")
        self.assertEqual(messages.calls[0]["output_config"], {"effort": "high"})
        runner, messages = build_runner("haiku", None)
        runner._say("S", "U", job_id=7, effort="high")
        self.assertEqual(messages.calls[0]["output_config"], {"effort": "high"})


class AvailableModelsTests(unittest.TestCase):
    @staticmethod
    def listed(model_id, effort):
        info = {"capabilities": {"effort": {"supported": effort}}}
        return SimpleNamespace(id=model_id, model_dump=lambda mode=None: info)

    def runner_listing(self, items):
        runner = AgentSDKRunner.__new__(AgentSDKRunner)
        calls = []

        def list_models(limit):
            calls.append(limit)
            if isinstance(items, Exception):
                raise items
            return iter(items)
        runner.client = SimpleNamespace(with_options=lambda **_kw: SimpleNamespace(models=SimpleNamespace(list=list_models)))
        return runner, calls

    def test_lists_the_models_once_and_remembers_whether_each_supports_effort(self):
        runner, calls = self.runner_listing([self.listed("claude-sonnet-5-5", True), self.listed("claude-old-1", False)])
        first = runner.available_models()
        self.assertEqual(first, {"claude-sonnet-5-5": True, "claude-old-1": False})
        self.assertEqual(runner.available_models(), first)
        self.assertEqual(calls, [100])

    def test_keeps_the_last_good_list_when_a_refresh_fails(self):
        runner, calls = self.runner_listing(RuntimeError("API down"))
        self.assertIsNone(runner.available_models())
        runner._avail = (0.0, {"claude-sonnet-5-5": True})
        self.assertEqual(runner.available_models(), {"claude-sonnet-5-5": True})
        self.assertEqual(runner.available_models(), {"claude-sonnet-5-5": True})
        self.assertEqual(len(calls), 2)


if __name__ == "__main__":
    unittest.main()
