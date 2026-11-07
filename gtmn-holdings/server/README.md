# Holdings engine

Run locally: `HOLDINGS_RUNNER=sdk python3 app.py` -> http://127.0.0.1:8841 (also serves `../ui-prototype`).

## Env
- `ANTHROPIC_API_KEY` (in `server/.env`, git-ignored); optional `GRANOLA_API_KEY` for meeting-note search.
- `HOLDINGS_RUNNER=simulated|sdk`: `sdk` runs firms for real through the Claude API.
- `HOLDINGS_TOKEN`: access key, required when `HOLDINGS_HOST` is not localhost. Browsers sign in at `/login` (cookie); scripts send `Authorization: Bearer <key>`.
- `HOLDINGS_HOST`, `HOLDINGS_PORT` (or `PORT`), `HOLDINGS_MODEL`.
- `HOLDINGS_DATA`: database, vault and backups folder (default `server/data`; `/data` on Railway).
- `HOLDINGS_BACKUP_DIR`, `HOLDINGS_BACKUP_DIR2`, `HOLDINGS_BACKUP_HOUR`: nightly snapshot, keeps 14.

## What runs for real
Every approved firm with personas in `../firms/<id>/agents/` (Dani has his own single-agent runner with a corpus search and no Granola) runs through `plenary.py`: seats by specialty, blind positions, cross-examination, rotation of late specialists, question cards, memo, verifier, delivery desk. Two or more firms in `firms` make a Plenary. The Office of the CTO keeps its own runner. A job is marked done only after its files exist.

Agents can search the web, run sandboxed code and, when `GRANOLA_API_KEY` is set and the demand has `granola` true (default), search Rafael's Granola meetings. Each lookup shows in the job activity.

## API
GET `/api/firms|charters|jobs|jobs/:id|cards|library|backup|stream` (SSE), `/api/cost`, `/api/jobs/:id/thread`, `/api/jobs/:id/files/:file_id`, `/api/docs/:id/file?format=PDF|Word|Excel|PowerPoint|JPEG|Markdown|text`, `/api/docs.zip`, `/api/backup.zip`.
POST `/api/jobs` (`title`, `firm`, `firms`, `formats`, `granola`; multipart forms may also include up to eight reference documents), `/api/jobs/bulk` (`ids`, `action`: stop|archive|unarchive|delete), `/api/jobs/:id/steer`, `/api/cards/:id/answer`, `/api/charters/:id/review` (approve, edit), `/api/design-systems`, `/api/backup`.

New-demand reference documents can be PDF, DOCX, XLSX, PPTX, TXT, Markdown or CSV, up to 5 MB each and 10 MB total. Readable text is extracted for the team, while the original is kept with the demand and available to download. Uploaded contents are treated as untrusted evidence, not instructions.

Job statuses: waiting, working, asking, done, stopped. Stop takes effect at the job's next model call; stopped jobs keep their files. Archive hides a job from the Work tab; delete removes its files.
`/api/jobs` lists `convened` (firm ids) for running Plenaries; the boardroom shows only those firms and is empty when none is in session.

## Cost
`/api/cost` returns spend, the monthly cap and `by_job`. Calls pause at the cap until Rafael extends or stops.

## Deploy (Railway)
`../Dockerfile` builds the app. From `gtmn-holdings/` run `railway up --service holdings`. Variables: `ANTHROPIC_API_KEY`, `GRANOLA_API_KEY`, `HOLDINGS_TOKEN`. Volume mounted at `/data`.
