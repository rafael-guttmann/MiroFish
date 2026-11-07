import json
import os
import shutil
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib import error, request

_DATA = tempfile.mkdtemp(prefix="holdings-test-")
os.environ.update({"HOLDINGS_DATA": _DATA, "HOLDINGS_RUNNER": "simulated", "HOLDINGS_TOKEN": ""})

import app  # noqa: E402  (reads the environment above when imported)


class FakeLiveRunner:
    """Stands in for the Claude runner: it has a client and a list of models, and starts nothing."""
    client = object()

    def __init__(self, available):
        self.available = available
        self.started = []
        self.waiting = {}

    def available_models(self):
        return self.available

    def start(self, job_id):
        self.started.append(job_id)


SONNET_AND_OPUS = {"claude-sonnet-5-5": True, "claude-opus-5-5": True}


def setUpModule():
    global server, base
    server = ThreadingHTTPServer(("127.0.0.1", 0), app.H)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    app.store.run("INSERT INTO charter_reviews(charter,decision,note,created) VALUES(?,?,?,?)",
                  ("gtmn-cto", "approved", "", time.time()))


def tearDownModule():
    server.shutdown()
    server.server_close()
    shutil.rmtree(_DATA, ignore_errors=True)


def call(path, body=None, raw=None, headers=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = request.Request(base + path, data=data, headers=headers or ({"Content-Type": "application/json"} if data else {}))
    try:
        with request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except error.HTTPError as e:
        return e.code, json.loads(e.read())


def new_demand(**extra):
    return call("/api/jobs", {"title": "Review our vendor architecture", "firm": "gtmn-cto", **extra})


class ModelPickerApiTests(unittest.TestCase):
    def live(self, available=SONNET_AND_OPUS):
        patcher = patch.object(app, "runner", FakeLiveRunner(available))
        runner = patcher.start()
        self.addCleanup(patcher.stop)
        return runner

    def test_the_simulated_runner_offers_no_picker(self):
        status, body = call("/api/models")
        self.assertEqual((status, body["live"], body["models"]), (200, False, []))

    def test_only_models_the_account_can_run_are_listed(self):
        self.live()
        status, body = call("/api/models")
        self.assertEqual(status, 200)
        self.assertTrue(body["live"])
        self.assertEqual(body["default"], "auto")
        self.assertEqual([m["id"] for m in body["models"]], ["auto", "opus", "sonnet"])
        self.assertEqual(body["models"][0]["summary"], "Research: Sonnet 5.5 · Writing and fact-check: Opus 5.5")

    def test_every_preset_is_offered_when_the_model_list_cannot_be_fetched(self):
        self.live(None)
        self.assertEqual(len(call("/api/models")[1]["models"]), 5)

    def test_the_chosen_model_is_stored_with_the_demand(self):
        runner = self.live()
        status, created = new_demand(model="opus")
        self.assertEqual(status, 201)
        self.assertEqual(runner.started, [created["id"]])
        status, job = call(f"/api/jobs/{created['id']}")
        self.assertEqual((job["model"], job["model_name"], job["ran_on"]), ("opus", "Opus 5.5", []))

    def test_no_choice_means_auto(self):
        self.live()
        _, created = new_demand()
        job = call(f"/api/jobs/{created['id']}")[1]
        self.assertEqual((job["model"], job["model_name"]), ("auto", "Auto"))

    def test_a_model_the_account_cannot_run_is_refused_and_no_demand_is_created(self):
        runner = self.live()
        before = len(call("/api/jobs")[1])
        status, body = new_demand(model="haiku")
        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "Haiku 5.5 is not available on this account right now. Choose another model.")
        self.assertEqual(new_demand(model="gpt-9")[1]["error"], "Unknown model choice.")
        self.assertEqual(len(call("/api/jobs")[1]), before)
        self.assertEqual(runner.started, [])

    def test_the_model_travels_with_an_upload(self):
        self.live()
        boundary = "model-boundary"
        meta = json.dumps({"title": "Review this brief", "brief": "Check the attached business case.",
                           "company": "Upload Company", "firm": "gtmn-cto", "model": "sonnet"})
        body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"metadata\"\r\n\r\n{meta}"
                f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"files\"; filename=\"brief.md\"\r\n"
                f"Content-Type: text/markdown\r\n\r\nBusiness case.\r\n--{boundary}--\r\n").encode()
        status, created = call("/api/jobs", raw=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        self.assertEqual((status, created["files"]), (201, 1))
        job = call(f"/api/jobs/{created['id']}")[1]
        self.assertEqual((job["model"], job["company"], job["brief"]),
                         ("sonnet", "Upload Company", "Check the attached business case."))

    def test_work_detail_and_the_list_show_what_each_job_really_ran_on(self):
        self.live()
        _, created = new_demand(model="auto")
        jid = created["id"]
        for model, usd in (("claude-sonnet-5-5", 0.4), ("claude-opus-5-5", 1.2)):
            app.store.run("INSERT INTO usage(job,model,tokens_in,tokens_out,usd,created) VALUES(?,?,?,?,?,?)",
                          (jid, model, 10, 10, usd, time.time()))
        detail = call(f"/api/jobs/{jid}")[1]
        listed = next(j for j in call("/api/jobs")[1] if j["id"] == jid)
        for job in (detail, listed):
            self.assertEqual((job["model_name"], job["ran_on"]), ("Auto", ["Opus 5.5", "Sonnet 5.5"]))

    def test_a_demand_from_before_the_picker_still_shows_the_model_it_ran_on(self):
        old = app.store.run("INSERT INTO jobs(title,firm,formats,created) VALUES(?,?,?,?)",
                            ("Earlier demand", "gtmn-cto", "[]", time.time()))
        app.store.run("INSERT INTO usage(job,model,tokens_in,tokens_out,usd,created) VALUES(?,?,?,?,?,?)",
                      (old, "claude-sonnet-4-5-20250929", 10, 10, 2.0, time.time()))
        job = call(f"/api/jobs/{old}")[1]
        self.assertEqual((job["model"], job["model_name"], job["ran_on"]), (None, None, ["Sonnet 4.5"]))


class DemandMetadataApiTests(unittest.TestCase):
    def setUp(self):
        self.runner = FakeLiveRunner(SONNET_AND_OPUS)
        patcher = patch.object(app, "runner", self.runner)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_title_company_and_full_instructions_are_stored_and_returned(self):
        brief = "Check architecture and operations.\n\n" + "Preserve every requirement. " * 40
        status, created = new_demand(title="  Platform   review ", company="  Example   Holdings  ", brief=brief)
        self.assertEqual(status, 201)
        detail = call(f"/api/jobs/{created['id']}")[1]
        listed = next(j for j in call("/api/jobs")[1] if j["id"] == created["id"])
        for job in (detail, listed):
            self.assertEqual((job["title"], job["company"], job["brief"]),
                             ("Platform review", "Example Holdings", brief.strip()))
        self.assertEqual(self.runner.started, [created["id"]])
        from store import Store
        reopened = Store(app.DATA / "holdings.db")
        try:
            saved = reopened.one("SELECT title, brief, company FROM jobs WHERE id=?", (created["id"],))
            self.assertEqual((saved["title"], saved["brief"], saved["company"]),
                             ("Platform review", brief.strip(), "Example Holdings"))
        finally:
            reopened.db.close()

    def test_title_only_clients_and_existing_demands_keep_their_instructions(self):
        _, created = new_demand(title="Earlier client request")
        old = app.store.run("INSERT INTO jobs(title,firm,created) VALUES(?,?,?)",
                            ("Legacy demand", "gtmn-cto", time.time()))
        for jid, text in ((created["id"], "Earlier client request"), (old, "Legacy demand")):
            detail = call(f"/api/jobs/{jid}")[1]
            listed = next(j for j in call("/api/jobs")[1] if j["id"] == jid)
            for job in (detail, listed):
                self.assertEqual((job["title"], job["brief"], job["company"]), (text, text, ""))

    def test_existing_company_spelling_is_reused_case_insensitively(self):
        _, first = new_demand(company="Árvore Capital")
        _, second = new_demand(company="  ÁRVORE   CAPITAL ")
        a = call(f"/api/jobs/{first['id']}")[1]
        b = call(f"/api/jobs/{second['id']}")[1]
        self.assertEqual(a["company"], b["company"])

    def test_routing_uses_the_full_demand_not_just_the_short_title(self):
        with patch.object(app, "approved", return_value=True):
            status, created = new_demand(title="Quarterly review", firm=None,
                                         brief="Prepare the noteholder credit analysis.")
        self.assertEqual((status, created["firm"]), (201, "zencredit-firm"))

    def test_invalid_metadata_is_refused_without_creating_or_starting_work(self):
        before = len(call("/api/jobs")[1])
        invalid = [{"title": " "}, {"brief": ""}, {"brief": " \n "}, {"title": None},
                   {"brief": ["task"]}, {"company": {"name": "Bad"}}, {"company": None},
                   {"title": "t" * 301}, {"company": "c" * 161}, {"brief": "b" * 20001}]
        for values in invalid:
            with self.subTest(values=list(values)):
                status, body = new_demand(**values)
                self.assertEqual(status, 400)
                self.assertTrue(body["error"])
        self.assertEqual(call("/api/jobs", [])[0], 400)
        self.assertEqual(len(call("/api/jobs")[1]), before)
        self.assertEqual(self.runner.started, [])

    def test_field_limits_are_inclusive_without_truncation(self):
        values = {"title": "T" * 300, "company": "C" * 160, "brief": "B" * 20000}
        status, created = new_demand(**values)
        self.assertEqual(status, 201)
        job = call(f"/api/jobs/{created['id']}")[1]
        self.assertEqual({key: job[key] for key in values}, values)

    def test_library_metadata_stays_linked_when_a_demand_is_archived(self):
        _, created = new_demand(title="Company review", brief="Review the supplied accounts.", company="Library Co")
        jid = created["id"]
        doc_id = app.store.run("INSERT INTO docs(job,name,kind,by,created) VALUES(?,?,?,?,?)",
                               (jid, "Review memo", "Memo", "desk", time.time()))
        self.assertEqual(call("/api/jobs/bulk", {"ids": [jid], "action": "archive"})[0], 200)
        docs = call("/api/library")[1]["docs"]
        doc = next(d for d in docs if d["id"] == doc_id)
        self.assertEqual((doc["job"], doc["demand_title"], doc["company"], doc["archived"]),
                         (jid, "Company review", "Library Co", 1))


if __name__ == "__main__":
    unittest.main()
