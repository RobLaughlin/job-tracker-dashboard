# Minimal Job Server Example

This is a reference implementation of a contract-compliant Job Server for local development.

It implements:

- `GET /v1/health`
- `GET /v1/jobs`
- `GET /v1/jobs/{job_id}`
- `GET /v1/jobs/{job_id}/tasks`
- `GET /v1/stream` (SSE with snapshot, heartbeat, and resume support)

## Run

```bash
npm install
JOB_SERVER_TOKEN=dev-token npm run dev
```

Server defaults:

- URL: `http://localhost:8080`
- Bearer token: `dev-token` (or `JOB_SERVER_TOKEN`)
- Allowed CORS origin: `http://localhost:5173` (override via `CORS_ALLOWED_ORIGINS`)

## Verify with the Dashboard Conformity Suite

1. Start the server.
2. Open the frontend app (`frontend/`).
3. Enter:
   - URL: `http://localhost:8080`
   - API token: `dev-token`
4. Run the full suite.

## Example Requests

```bash
curl -H "Authorization: Bearer dev-token" \
  http://localhost:8080/v1/jobs
```

```bash
curl -N -H "Accept: text/event-stream" \
  -H "Authorization: Bearer dev-token" \
  http://localhost:8080/v1/stream
```

## Notes

- Uses an in-memory store plus a lightweight runner loop that evaluates dependencies, starts tasks, and derives terminal job statuses.
- Uses `depends_on` as the canonical job dependency model.
- Not intended for production deployment.

## How It Works

- `InMemoryJobStore` keeps jobs/tasks and computes detail summaries.
- `JobRunner` drives realistic lifecycle behavior:
  - waits for upstream `depends_on` jobs to succeed
  - starts queued tasks
  - marks tasks terminal after runtime threshold
  - computes final job status from required/optional task outcomes
- `SseBroker` handles stream clients, event fan-out, snapshots, heartbeat, and replay via `Last-Event-ID`.

## Production Extension Points

- Replace in-memory store with Postgres/Redis.
- Replace runner loop with a queue worker system (BullMQ, Temporal, etc.).
- Keep the same API contract and event payload shapes.
- Plug in your auth provider while preserving bearer behavior and scopes.
