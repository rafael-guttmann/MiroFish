"""Backups: a consistent SQLite snapshot plus the vault, zipped, written to a primary
folder and optionally a second location (HOLDINGS_BACKUP_DIR2, e.g. a synced cloud folder).
Runs nightly at HOLDINGS_BACKUP_HOUR (default 02:00 local) and on demand. Keeps the last 14."""
import datetime
import shutil
import sqlite3
import tempfile
import threading
import time
import zipfile
from pathlib import Path

KEEP = 14


def run_backup(data_dir, db_path, dests):
    data_dir = Path(data_dir)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    name = f"holdings-{stamp}.zip"
    with tempfile.TemporaryDirectory() as tmp:
        snap = Path(tmp) / "holdings.db"
        src = sqlite3.connect(db_path)
        dst = sqlite3.connect(snap)
        src.backup(dst)
        dst.close()
        src.close()
        z = Path(tmp) / name
        n = 0
        with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(snap, "holdings.db")
            vault = data_dir / "vault"
            if vault.is_dir():
                for f in vault.rglob("*"):
                    if f.is_file():
                        zf.write(f, "vault/" + str(f.relative_to(vault)))
                        n += 1
        with zipfile.ZipFile(z) as zf:
            if zf.testzip() is not None:
                raise RuntimeError("backup failed its integrity check")
        done = []
        for d in dests:
            d = Path(d)
            d.mkdir(parents=True, exist_ok=True)
            shutil.copy2(z, d / name)
            for old in sorted(d.glob("holdings-*.zip"))[:-KEEP]:
                old.unlink()
            done.append(str(d))
    return {"name": name, "files": n, "locations": done, "at": time.time()}


def schedule(fn, hour):
    def loop():
        while True:
            now = datetime.datetime.now()
            nxt = now.replace(hour=hour, minute=0, second=0, microsecond=0)
            if nxt <= now:
                nxt += datetime.timedelta(days=1)
            time.sleep((nxt - now).total_seconds())
            try:
                fn()
            except Exception:
                pass
    threading.Thread(target=loop, daemon=True).start()
