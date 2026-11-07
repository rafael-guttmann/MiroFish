import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import cost
import models
from store import Store

ALL = {"claude-haiku-5-5": True, "claude-sonnet-5-5": True, "claude-opus-5-5": True, "claude-fable-5-1": True}


class PresetTests(unittest.TestCase):
    def test_catalog_lists_the_presets_in_order_with_auto_recommended(self):
        catalog = models.catalog(ALL)
        self.assertEqual([m["id"] for m in catalog], ["auto", "fable", "opus", "sonnet", "haiku"])
        self.assertEqual(catalog[0]["badge"], "Recommended")
        self.assertEqual([m["name"] for m in catalog], ["Auto", "Fable 5.1", "Opus 5.5", "Sonnet 5.5", "Haiku 5.5"])
        self.assertTrue(all(m["tagline"] and m["cost"] and m["summary"] for m in catalog))

    def test_haiku_is_not_sold_as_fast(self):
        # Measured on a live demand: Haiku ran 2-5x slower than Sonnet for a bill about 10% lower.
        haiku = next(m for m in models.catalog(ALL) if m["id"] == "haiku")
        self.assertNotRegex(haiku["tagline"], r"(?i)fast|quick")
        self.assertNotIn("speed", haiku)

    def test_auto_researches_on_sonnet_and_writes_and_checks_on_opus(self):
        auto = models.catalog(ALL)[0]
        self.assertEqual({r["role"]: r["model"] for r in auto["roles"]},
                         {"work": "claude-sonnet-5-5", "pen": "claude-opus-5-5", "verify": "claude-opus-5-5"})
        self.assertEqual(auto["summary"], "Research: Sonnet 5.5 · Writing and fact-check: Opus 5.5")

    def test_a_single_model_preset_runs_every_role_on_that_model(self):
        opus = next(m for m in models.catalog(ALL) if m["id"] == "opus")
        self.assertEqual({r["model"] for r in opus["roles"]}, {"claude-opus-5-5"})
        self.assertEqual(opus["summary"], "Everything runs on Opus 5.5.")

    def test_cost_notes_are_price_tiers_against_sonnet(self):
        notes = {m["id"]: m["cost"] for m in models.catalog(ALL)}
        self.assertEqual(notes, {"auto": "Standard to higher price per word", "fable": "Highest price per word",
                                 "opus": "Higher price per word", "sonnet": "Standard price per word",
                                 "haiku": "Lowest price per word"})

    def test_cost_tiers_follow_token_price(self):
        order = [models._tier(m) for m in ("claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-1")]
        self.assertEqual(order, [0, 1, 2, 3])

    def test_auto_note_follows_the_environment_overrides(self):
        with patch.dict(os.environ, {"HOLDINGS_MODEL": "claude-haiku-5-5", "HOLDINGS_MODEL_PEN": "claude-fable-5-1"}):
            self.assertEqual(models.catalog(ALL)[0]["cost"], "Lowest to highest price per word")

    def test_unknown_or_missing_preset_means_auto(self):
        for value in (None, "", "nonsense", 7):
            self.assertEqual(models.roles_for(value), models.roles_for("auto"))

    def test_auto_follows_the_environment_overrides(self):
        env = {"HOLDINGS_MODEL": "claude-haiku-5-5", "HOLDINGS_MODEL_PEN": "claude-fable-5-1"}
        with patch.dict(os.environ, env):
            self.assertEqual(models.roles_for("auto"),
                             {"work": "claude-haiku-5-5", "pen": "claude-fable-5-1", "verify": "claude-fable-5-1"})
            self.assertEqual(models.roles_for("sonnet")["pen"], "claude-sonnet-5-5")

    def test_preset_name(self):
        self.assertEqual(models.preset_name("auto"), "Auto")
        self.assertEqual(models.preset_name("fable"), "Fable 5.1")
        self.assertIsNone(models.preset_name(None))
        self.assertIsNone(models.preset_name("nonsense"))

    def test_label(self):
        self.assertEqual(models.label("claude-sonnet-5-5"), "Sonnet 5.5")
        self.assertEqual(models.label("claude-opus-5"), "Opus 5")
        self.assertEqual(models.label("claude-sonnet-4-5-20250929"), "Sonnet 4.5")
        self.assertEqual(models.label("claude-opus-4-5-20251101"), "Opus 4.5")
        self.assertEqual(models.label("something-else"), "something-else")
        self.assertEqual(models.label(None), "")


class AvailabilityTests(unittest.TestCase):
    def test_only_presets_the_key_can_run_are_offered(self):
        ids = lambda avail: [m["id"] for m in models.catalog(avail)]
        self.assertEqual(ids({"claude-sonnet-5-5": True, "claude-opus-5-5": True}), ["auto", "opus", "sonnet"])
        self.assertEqual(ids({"claude-sonnet-5-5": True}), ["sonnet"])
        self.assertEqual(ids({"claude-haiku-5-5": False}), ["haiku"])

    def test_an_unknown_list_offers_everything(self):
        self.assertEqual(len(models.catalog(None)), 5)

    def test_find_matches_an_alias_to_its_dated_snapshot(self):
        listed = {"claude-opus-5-5-20260101": True, "claude-opus-5-5-mini": True}
        self.assertEqual(models.find("claude-opus-5-5", listed), "claude-opus-5-5-20260101")
        self.assertIsNone(models.find("claude-opus-5-5", {"claude-opus-5-5-mini": True}))
        self.assertIsNone(models.find("claude-opus-5-5", None))
        self.assertEqual([m["id"] for m in models.catalog({"claude-sonnet-5-5-20260101": True})], ["sonnet"])

    def test_effort_is_assumed_unless_the_api_says_the_model_rejects_it(self):
        self.assertTrue(models.supports_effort("claude-sonnet-5-5", None))
        self.assertTrue(models.supports_effort("claude-sonnet-5-5", {"claude-sonnet-5-5": True}))
        self.assertTrue(models.supports_effort("claude-sonnet-5-5", {"claude-sonnet-5-5": None}))
        self.assertTrue(models.supports_effort("claude-sonnet-5-5", {}))
        self.assertFalse(models.supports_effort("claude-sonnet-5-5", {"claude-sonnet-5-5": False}))
        self.assertFalse(models.supports_effort("claude-sonnet-5-5", {"claude-sonnet-5-5-20260101": False}))


class ValidateTests(unittest.TestCase):
    def test_a_missing_choice_becomes_auto(self):
        self.assertEqual(models.validate(None, ALL), "auto")
        self.assertEqual(models.validate("", ALL), "auto")

    def test_accepts_every_offered_preset(self):
        for preset in ("auto", "fable", "opus", "sonnet", "haiku"):
            self.assertEqual(models.validate(preset, ALL), preset)

    def test_rejects_an_unknown_choice(self):
        for value in ("gpt", ["auto"], 3):
            with self.assertRaisesRegex(ValueError, "Unknown model choice"):
                models.validate(value, ALL)

    def test_rejects_a_preset_the_key_cannot_run_in_words_rafael_can_read(self):
        with self.assertRaisesRegex(ValueError, "Haiku 5.5 is not available on this account right now"):
            models.validate("haiku", {"claude-sonnet-5-5": True})
        with self.assertRaisesRegex(ValueError, "Auto is not available"):
            models.validate("auto", {"claude-sonnet-5-5": True})

    def test_anything_known_passes_when_the_list_is_unknown(self):
        self.assertEqual(models.validate("fable", None), "fable")


class RanOnTests(unittest.TestCase):
    def test_lists_the_models_a_job_used_biggest_spend_first(self):
        rows = [{"model": "claude-sonnet-5-5", "usd": 0.4}, {"model": "claude-opus-5-5", "usd": 1.2},
                {"model": "claude-sonnet-5-5-20260101", "usd": 0.1}]
        self.assertEqual(models.ran_on(rows), ["Opus 5.5", "Sonnet 5.5"])

    def test_old_jobs_show_the_model_they_really_ran_on(self):
        self.assertEqual(models.ran_on([{"model": "claude-sonnet-4-5-20250929", "usd": 2.0}]), ["Sonnet 4.5"])

    def test_nothing_spent_yet(self):
        self.assertEqual(models.ran_on([]), [])
        self.assertEqual(models.ran_on([{"model": None, "usd": None}]), [])


class CostTests(unittest.TestCase):
    class Rows:
        def __init__(self):
            self.inserted = []

        def run(self, sql, args=()):
            self.inserted.append(args)

    @staticmethod
    def usage(**kw):
        return SimpleNamespace(**{"input_tokens": 0, "output_tokens": 0, "cache_read_input_tokens": 0,
                                  "cache_creation_input_tokens": 0, "server_tool_use": None, **kw})

    def test_haiku_charges_the_higher_rate_once_a_prompt_passes_100k_tokens(self):
        self.assertEqual(cost._price("claude-haiku-5-5", 99_999), (0.10, 0.50, 0.10))
        self.assertEqual(cost._price("claude-haiku-5-5", 100_001), (0.50, 2.50, 0.10))
        self.assertEqual(cost._price("claude-sonnet-5-5", 500_000), (2.0, 10.0, 0.05))

    def test_record_prices_the_whole_prompt_including_cached_tokens(self):
        rows = self.Rows()
        small = cost.record(rows, 1, "claude-haiku-5-5", self.usage(input_tokens=10_000, output_tokens=1_000))
        self.assertAlmostEqual(small, (10_000 * 0.10 + 1_000 * 0.50) / 1e6)
        big = cost.record(rows, 1, "claude-haiku-5-5",
                          self.usage(input_tokens=10_000, cache_read_input_tokens=95_000, output_tokens=1_000))
        self.assertAlmostEqual(big, (10_000 * 0.50 + 1_000 * 2.50 + 95_000 * 0.50 * 0.10) / 1e6)
        self.assertEqual(rows.inserted[1][2], 105_000)

    def test_each_model_is_priced_at_its_own_rate(self):
        usage = self.usage(input_tokens=100_000, output_tokens=100_000)
        expected = {"claude-fable-5-1": 6.0, "claude-opus-5-5": 2.4, "claude-sonnet-5-5": 1.2,
                    "claude-haiku-5-5": 0.06, "claude-sonnet-4-5-20250929": 1.8}
        for model, usd in expected.items():
            self.assertAlmostEqual(cost.record(self.Rows(), 1, model, usage), usd, msg=model)


class MigrationTests(unittest.TestCase):
    def test_an_existing_database_gains_the_model_column_and_old_jobs_stay_on_auto(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "holdings.db"
            db = sqlite3.connect(path)
            db.execute("CREATE TABLE jobs(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, firm TEXT NOT NULL, "
                       "status TEXT NOT NULL DEFAULT 'waiting', progress REAL NOT NULL DEFAULT 0, stage INTEGER NOT NULL DEFAULT 0, "
                       "formats TEXT NOT NULL DEFAULT '[]', design TEXT, created REAL NOT NULL)")
            db.execute("INSERT INTO jobs(title, firm, created) VALUES('Old demand', 'gtmn-cto', 1)")
            db.commit()
            db.close()
            for _ in range(2):
                store = Store(path)
                try:
                    self.assertTrue({"model", "brief", "company"} <= {r["name"] for r in store.rows("PRAGMA table_info(jobs)")})
                    old = store.one("SELECT * FROM jobs WHERE title='Old demand'")
                    self.assertEqual((old["title"], old["brief"], old["company"]), ("Old demand", "", ""))
                    self.assertIsNone(old["model"])
                    self.assertEqual(models.roles_for(old["model"]), models.roles_for("auto"))
                finally:
                    store.db.close()


if __name__ == "__main__":
    unittest.main()
