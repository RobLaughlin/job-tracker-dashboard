# SSE Protocol Contract

This document defines live update behavior over Server-Sent Events.

## Endpoint

- `GET /v1/stream`

Headers:

- Required: `Accept: text/event-stream`
- Required: `Authorization: Bearer <token>`

Query parameters:

- `job_id` (optional, repeatable): include only matching jobs
- `status` (optional, repeatable): strict job status filter

If `status` is omitted, no status filter is applied (all visible statuses).

Allowed `status` values:

- `queued`
- `waiting_dependency`
- `running`
- `failed`
- `completed`
- `succeeded`
- `cancelled`

Invalid query values must return `400` (do not silently ignore).

## Response Requirements

Headers:

- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`

The server must keep the connection open and emit events over time.

## Event Framing

Each event uses standard SSE framing:

```text
id: 01JSGYF6H2NNBCX6CG5W6BCHY1
event: task.updated
data: {"event_id":"01JSGYF6H2NNBCX6CG5W6BCHY1","event_type":"task.updated","schema_version":"1.0.0","occurred_at":"2026-04-25T10:02:40Z","job_id":"job.import.001","payload":{"task_id":"fetch-source","required":true,"status":"succeeded"}}

```

Rules:

- `id` is required for every business event.
- `event` is required and must be known.
- `data` is JSON and must match schema.
- Blank line terminates the event.

## Event Types

- `snapshot`
- `job.updated`
- `task.updated`
- `heartbeat`
- `error`

### snapshot

Sent immediately after stream opens, before incremental updates.

Payload should include the current job/task state within active filters.

### job.updated

Sent on any job state or metadata change.

### task.updated

Sent on task status/progress change. Must include `task_id`, `required`, and `status`.

### heartbeat

Sent at a fixed cadence (recommended every 15s) to keep intermediaries from closing idle streams.

### error

Optional stream-level error event. If unrecoverable, server may send `error` and close.

## Envelope Schema

All non-comment events in `data` must follow this envelope:

```json
{
  "event_id": "01JSGYF6H2NNBCX6CG5W6BCHY1",
  "event_type": "task.updated",
  "schema_version": "1.0.0",
  "occurred_at": "2026-04-25T10:02:40Z",
  "job_id": "job.import.001",
  "payload": {}
}
```

Strictness:

- No unknown top-level properties.
- `event_type` and SSE `event` value must match.
- `payload` schema depends on `event_type`.

## Reconnect and Resume

- Client should reconnect with exponential backoff.
- Client should send `Last-Event-ID` when reconnecting.
- Server should resume from the next event after `Last-Event-ID` if still retained.
- If resume is not possible, send a new `snapshot` first.

## Security Notes

- Never include secrets in stream payloads.
- Enforce per-token/per-IP stream limits.
- Return `401`/`403` on auth failures.
- Prefer immediate close on expired token.
- Support CORS preflight for browser clients and allow `Last-Event-ID` in `Access-Control-Allow-Headers`.
