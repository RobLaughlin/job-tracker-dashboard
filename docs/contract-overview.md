# Contract Overview

This document defines Phase 0 behavior for a compliant Job Server.

## Scope

- Transport: HTTPS for production, HTTP allowed for localhost development.
- APIs: REST for snapshot and query, SSE for live updates.
- Graph model: job-to-job dependencies only.
- Schema policy: strict, versioned, no undocumented fields.

## Base Rules

- Base path: `/v1`
- Content type for JSON responses: `application/json`
- Content type for SSE stream: `text/event-stream`
- Auth required everywhere except optional `/v1/health` in local dev mode.

## Authentication and Authorization

- Header: `Authorization: Bearer <token>`
- Missing or invalid token: `401 Unauthorized`
- Authenticated but insufficient scope: `403 Forbidden`
- Recommended scopes:
  - `jobs:read` for REST resources
  - `stream:read` for SSE

## Versioning and Compatibility

- Major contract version is represented by the URL prefix (`/v1`).
- Payloads include `schema_version` where applicable.
- Breaking changes require a new major prefix (`/v2`).

## Strict Validation Policy

- Enumerations are closed.
- Unknown fields are rejected.
- IDs, timestamps, arrays, and pagination have explicit constraints.
- Use `additionalProperties: false` on every object schema.

## IDs and Timestamps

- `job_id`, `task_id`, `dependency_id`: non-empty, max length 128, regex `^[A-Za-z0-9._:-]+$`
- `event_id`: UUIDv7 or ULID string
- `occurred_at`, `created_at`, `updated_at`: RFC3339 UTC timestamp

## Error Envelope

REST errors must use this shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "status contains unsupported value",
    "details": [
      {
        "field": "status",
        "issue": "must be one of queued|running|succeeded|failed|cancelled"
      }
    ]
  }
}
```

Rules:

- `code` is machine-readable snake_case.
- `message` is short and human-readable.
- `details` is optional but recommended for `400`.

## Recommended Operational Limits

- SSE max concurrent connections per token/IP.
- REST rate limiting with `429` and retry guidance.
- Max JSON payload size per event/response.
- Heartbeat cadence to keep stream alive across proxies.
