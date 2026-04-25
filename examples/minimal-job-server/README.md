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

- Uses in-memory data and periodic status simulation for demonstration.
- Uses `depends_on` as the canonical job dependency model.
- Not intended for production deployment.
