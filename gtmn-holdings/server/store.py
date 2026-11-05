"""SQLite job board and append-only event log. Standard library only."""
import json
import sqlite3
import threading
import time
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, firm TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', progress REAL NOT NULL DEFAULT 0,
  stage INTEGER NOT NULL DEFAULT 0, formats TEXT NOT NULL DEFAULT '[]',
  design TEXT, created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL, job INTEGER, firm TEXT,
  kind TEXT NOT NULL, text TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS cards(
  id INTEGER PRIMARY KEY AUTOINCREMENT, job INTEGER NOT NULL, firm TEXT NOT NULL,
  payload TEXT NOT NULL, answer TEXT, state TEXT NOT NULL DEFAULT 'open', created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS docs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, job INTEGER NOT NULL, name TEXT NOT NULL,
  kind TEXT NOT NULL, by TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  formats TEXT NOT NULL DEFAULT '[]', created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS design_systems(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, kind TEXT NOT NULL,
  url TEXT, is_default INTEGER NOT NULL DEFAULT 0, created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS charter_reviews(
  id INTEGER PRIMARY KEY AUTOINCREMENT, charter TEXT NOT NULL, decision TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '', created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT, job INTEGER NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL, created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS usage(
  id INTEGER PRIMARY KEY AUTOINCREMENT, job INTEGER, model TEXT, tokens_in INTEGER, tokens_out INTEGER, usd REAL NOT NULL, created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS charter_edits(
  id INTEGER PRIMARY KEY AUTOINCREMENT, charter TEXT NOT NULL, patch TEXT NOT NULL,
  applied TEXT NOT NULL DEFAULT '', cannot TEXT NOT NULL DEFAULT '', request TEXT NOT NULL DEFAULT '', created REAL NOT NULL);
"""


class Store:
    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        with self.lock:
            self.db.executescript(SCHEMA)
            for col in ("src TEXT", "why TEXT"):
                try:
                    self.db.execute(f"ALTER TABLE docs ADD COLUMN {col}")
                except sqlite3.OperationalError:
                    pass
            try:
                self.db.execute("ALTER TABLE jobs ADD COLUMN granola INTEGER NOT NULL DEFAULT 1")
            except sqlite3.OperationalError:
                pass
            self.db.commit()

    def run(self, sql, args=()):
        with self.lock:
            cur = self.db.execute(sql, args)
            self.db.commit()
            return cur.lastrowid

    def rows(self, sql, args=()):
        with self.lock:
            return [dict(r) for r in self.db.execute(sql, args).fetchall()]

    def one(self, sql, args=()):
        r = self.rows(sql, args)
        return r[0] if r else None

    def event(self, kind, text, job=None, firm=None, data=None):
        return self.run("INSERT INTO events(ts,job,firm,kind,text,data) VALUES(?,?,?,?,?,?)",
                        (time.time(), job, firm, kind, text, json.dumps(data or {})))

    def events_after(self, last_id, limit=200):
        return self.rows("SELECT * FROM events WHERE id>? ORDER BY id LIMIT ?", (last_id, limit))
