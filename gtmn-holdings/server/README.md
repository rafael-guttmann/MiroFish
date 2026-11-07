# Holdings engine

Run locally: `HOLDINGS_RUNNER=sdk python3 app.py` -> http://127.0.0.1:8841 (also serves `../ui-prototype`).

## Env
- `ANTHROPIC_API_KEY` (in `server/.env`, git-ignored); optional `GRANOLA_API_KEY` for meeting-note search.
- `HOLDINGS_RUNNER=simulated|sdk`: `sdk` runs firms for real through the Claude API.
- `HOLDINGS_TOKEN`: access key, required when `HOLDINGS_HOST` is not localhost. Browsers sign in at `/login` (cookie); scripts send `Authorization: Bearer <key>`.
- `HOLDINGS_HOST`, `HOLDINGS_PORT` (or `PORT`).
- `HOLDINGS_MODEL`, `HOLDINGS_MODEL_PEN`, `HOLDINGS_MODEL_VERIFY`: the models **Auto** uses for research, writing and the fact-check (defaults `claude-sonnet-5-5`, `claude-opus-5-5`, and the writing model). The other presets ignore them.
- `HOLDINGS_DATA`: database, vault and backups folder (default `server/data`; `/data` on Railway).
- `HOLDINGS_BACKUP_DIR`, `HOLDINGS_BACKUP_DIR2`, `HOLDINGS_BACKUP_HOUR`: nightly snapshot, keeps 14.

## What runs for real
Every approved firm with personas in `../firms/<id>/agents/` (Dani has his own single-agent runner with a corpus search and no Granola) runs through `plenary.py`: seats by specialty, blind positions, cross-examination, rotation of late specialists, question cards, memo, verifier, delivery desk. Two or more firms in `firms` make a Plenary. The Office of the CTO keeps its own runner. A job is marked done only after its files exist.

Agents can search the web, run sandboxed code and, when `GRANOLA_API_KEY` is set and the demand has `granola` true (default), search Rafael's Granola meetings. Each lookup shows in the job activity.

## Models
Each demand picks a model in the New demand form; the browser remembers the choice. The preset is stored on the job (`jobs.model`). A missing or unknown one means Auto, so older jobs keep working and show the model they really ran on.

| Preset | Runs on | Price per word |
|---|---|---|
| Auto (default) | research: Sonnet 5.5; writing and fact-check: Opus 5.5 | Standard to higher |
| Fable 5.1 | everything | Highest |
| Opus 5.5 | everything | Higher |
| Sonnet 5.5 | everything | Standard |
| Haiku 5.5 | everything | Lowest |

Research is the seats, planners, chairs and question cards; writing is the memo, the deliverables and their editor; the fact-check is the verifier. `GET /api/models` offers only presets whose models this API key can run (cached ten minutes), and `POST /api/jobs` rejects any other choice with a readable message. Thinking counts toward `max_tokens`, so each call gets room for it, and an answer that is still cut off is continued rather than dropped.

The price tiers rank each model's token price against Sonnet's. They are a rate card, not a forecast, and the picker shows no speed word: Anthropic rates Haiku fastest per word, but on a whole demand it was the slowest we measured, because it researches and writes more. The Work tab shows what each demand actually cost and which models ran it. Measured on one demand through the live API (`gtmn-cto`, "Evaluate only, no build: should GTMN run its internal agent platform on one managed cloud service or self-host it? Keep the answer to two short paragraphs.", Markdown, Granola off):

| Preset | Time | Bill | Searches | Tokens out |
|---|---|---|---|---|
| Sonnet 5.5 | 54 s | $0.35 | 2 | 8.5k |
| Auto | 78 s | $0.57 | 3 | 10.8k |
| Haiku 5.5 (two runs) | 282 s, 132 s | $0.32, $0.31 | 13, 15 | 77.7k, 36.9k |

Fable 5.1 and Opus 5.5 were call-tested through the same request path on the live API (effort, web search and fetch, code tool) but not run on a full demand. Re-measure before changing the picker's wording or the tiers.

## API
GET `/api/firms|charters|models|jobs|jobs/:id|cards|library|backup|stream` (SSE), `/api/cost`, `/api/jobs/:id/thread`, `/api/jobs/:id/files/:file_id`, `/api/docs/:id/file?format=PDF|Word|Excel|PowerPoint|JPEG|Markdown|text`, `/api/docs.zip`, `/api/backup.zip`.
POST `/api/jobs` (`title`, `firm`, `firms`, `formats`, `granola`, `model`; multipart forms may also include up to eight reference documents), `/api/jobs/bulk` (`ids`, `action`: stop|archive|unarchive|delete), `/api/jobs/:id/steer`, `/api/cards/:id/answer`, `/api/charters/:id/review` (approve, edit), `/api/design-systems`, `/api/backup`.

New-demand reference documents can be PDF, DOCX, XLSX, PPTX, TXT, Markdown or CSV, up to 5 MB each and 10 MB total. Readable text is extracted for the team, while the original is kept with the demand and available to download. Uploaded contents are treated as untrusted evidence, not instructions.

Job statuses: waiting, working, asking, done, stopped. Stop takes effect at the job's next model call; stopped jobs keep their files. Archive hides a job from the Work tab; delete removes its files.
`/api/jobs` lists `convened` (firm ids) for running Plenaries; the boardroom shows only those firms and is empty when none is in session. Jobs also carry `model` (the preset), `model_name` and `ran_on` (the models that actually ran, biggest spend first).

## Cost
`/api/cost` returns spend, the monthly cap and `by_job`. Calls pause at the cap until Rafael extends or stops.

## Deploy (Railway)
`../Dockerfile` builds the app. From `gtmn-holdings/` run `railway up --service holdings`. Variables: `ANTHROPIC_API_KEY`, `GRANOLA_API_KEY`, `HOLDINGS_TOKEN`. Volume mounted at `/data`.
