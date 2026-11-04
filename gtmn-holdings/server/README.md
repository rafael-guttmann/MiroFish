# Holdings engine

Run: `python3 app.py` → http://127.0.0.1:8841 (also serves `../ui-prototype`). Override with `HOLDINGS_PORT`.

Env: `HOLDINGS_RUNNER=simulated|sdk`, `HOLDINGS_TOKEN` (bearer auth), `HOLDINGS_HOST`.

API: GET `/api/firms|jobs|jobs/:id|cards|library|stream` (SSE); POST `/api/jobs`, `/api/jobs/:id/steer`, `/api/cards/:id/answer`, `/api/design-systems`.

The simulated runner walks each firm's charter gates. The `sdk` runner (Claude Agent SDK) is not built yet.
