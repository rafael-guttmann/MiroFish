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
Every approved firm with personas in `../firms/<id>/agents/` (all except Dani) runs through `plenary.py`: seats by specialty, blind positions, cross-examination, rotation of late specialists, question cards, memo, verifier, delivery desk. Two or more firms in `firms` make a Plenary. The Office of the CTO keeps its own runner. A job is marked done only after its files exist.

Agents can search the web, run sandboxed code and, when `GRANOLA_API_KEY` is set and the demand has `granola` true (default), search Rafael's Granola meetings. Each lookup shows in the job activity.

## API
GET `/api/firms|charters|jobs|jobs/:id|cards|library|backup|stream` (SSE), `/api/docs/:id/file?format=PDF|Word|Excel|PowerPoint|JPEG|Markdown`.
POST `/api/jobs` (`title`, `firm`, `firms`, `formats`, `granola`), `/api/jobs/:id/steer`, `/api/cards/:id/answer`, `/api/charters/:id/review`, `/api/design-systems`, `/api/backup`.

## Deploy (Railway)
`../Dockerfile` builds the app. From `gtmn-holdings/` run `railway up --service holdings`. Variables: `ANTHROPIC_API_KEY`, `GRANOLA_API_KEY`, `HOLDINGS_TOKEN`. Volume mounted at `/data`.
