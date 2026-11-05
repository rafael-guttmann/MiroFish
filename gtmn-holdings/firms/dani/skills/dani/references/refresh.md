# Refreshing Dani

Use when Rafael asks to update or refresh Dani, or to add new material (a new episode, a new post, a document Daniel handed over).

The corpus lives on Rafael's Mac in `~/daniel-corpus`. A weekly job there (`scripts/update_corpus.sh`, login service `com.gtmn.dani-update`) fetches new EWOR blog posts and new podcast episodes, transcribes them, separates speakers, verifies Daniel's turns, rebuilds the index and writes `export/` (search chunks and project knowledge files). Its last result is in `logs/update_status.json`.

Steps (needs the Mac linked to the session; use the Mac's shell tools, e.g. Desktop Commander):

1. Read `~/daniel-corpus/logs/update_status.json`. If the last run is older than 8 days or failed, run `zsh ~/daniel-corpus/scripts/update_corpus.sh` (it can take 10–40 minutes when there are new episodes; run it detached with `screen -dmS daniupdate caffeinate -dims zsh ~/daniel-corpus/scripts/update_corpus.sh` and poll the log).
2. Rebuild the plugin: `zsh ~/daniel-corpus/scripts/build_plugin.sh`. It copies the fresh `export/dani_chunks.jsonl` into the plugin, bumps the patch version, and writes `~/daniel-corpus/plugin/dani.plugin`.
3. Bring `dani.plugin` into the session (stage the file), copy it to `/tmp/dani.plugin`, and send it to Rafael with SendUserFile so he can accept the update with one click.
4. If the Dani project is in use: the changed files in `~/daniel-corpus/export/knowledge/` should replace the same-named project knowledge files. From a session bound to the Dani project, use the Projects tool (project_write with local_path after staging); otherwise tell Rafael which files changed.

New material Daniel hands over directly (a PDF, a doc): save it under `~/daniel-corpus/raw/text/` with the front-matter used by the other files (title, date, type: Voice, speaker: daniel, language), then run steps 1–4.
