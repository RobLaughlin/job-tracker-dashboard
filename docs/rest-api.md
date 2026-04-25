# REST API Contract

All endpoints are under `/v1`.

All secured endpoints require:

- `Authorization: Bearer <token>`

## Common Query Conventions

- Pagination:
  - `limit` (integer, 1..200, default 50)
  - `cursor` (opaque string)
- Filtering:
  - repeated `status` params are allowed (for example `?status=running&status=failed`)

## Endpoints

### GET /v1/health

Purpose:

- Service and contract health probe.

Response `200`:

```json
{
  "status": "ok",
  "service": "job-server",
  "api_version": "v1",
  "schema_version": "1.0.0",
  "time": "2026-04-25T11:22:33Z"
}
```

### GET /v1/jobs

Purpose:

- Return paginated jobs visible to caller.

Query params:

- `limit`, `cursor`
- `status` (optional repeated enum value)

Allowed `status` enum values:

- `queued`
- `waiting_dependency`
- `running`
- `failed`
- `completed`
- `succeeded`
- `cancelled`

Response `200`:

```json
{
  "items": [
    {
      "job_id": "job.import.001",
      "name": "Daily import",
      "status": "running",
      "depends_on": ["job.prepare.001"],
      "created_at": "2026-04-25T10:00:00Z",
      "updated_at": "2026-04-25T10:02:00Z"
    }
  ],
  "next_cursor": null
}
```

### GET /v1/jobs/{job_id}

Purpose:

- Return full details for one job.

Response `200`:

```json
{
  "job_id": "job.import.001",
  "name": "Daily import",
  "status": "running",
  "depends_on": ["job.prepare.001"],
  "dependency_mode": "all_of",
  "created_at": "2026-04-25T10:00:00Z",
  "updated_at": "2026-04-25T10:02:00Z",
  "required_task_summary": {
    "total": 7,
    "succeeded": 5,
    "failed": 0,
    "cancelled": 0
  }
}
```

### GET /v1/jobs/{job_id}/tasks

Purpose:

- Return all tasks for one job.

Task object schema rules:

- `required` is mandatory boolean.
- Task status enum:
  - `queued`
  - `running`
  - `succeeded`
  - `failed`
  - `cancelled`

Response `200`:

```json
{
  "job_id": "job.import.001",
  "items": [
    {
      "task_id": "fetch-source",
      "name": "Fetch source",
      "required": true,
      "status": "succeeded",
      "started_at": "2026-04-25T10:00:05Z",
      "finished_at": "2026-04-25T10:00:30Z"
    },
    {
      "task_id": "notify-analytics",
      "name": "Notify analytics",
      "required": false,
      "status": "failed",
      "started_at": "2026-04-25T10:01:00Z",
      "finished_at": "2026-04-25T10:01:10Z"
    }
  ]
}
```

Dependency model rules:

- `depends_on` is the canonical dependency representation.
- Values contain upstream `job_id` values.
- Array values must be unique and must not include the job's own `job_id`.

## Error Codes

- `400` malformed or invalid params/body
- `401` missing or invalid bearer token
- `403` missing scope
- `404` unknown resource
- `409` state conflict (optional)
- `429` rate limited
- `500` internal error

All errors must use the common envelope from `docs/contract-overview.md`.
