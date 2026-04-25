# Validation Examples

## Valid task object

```json
{
  "task_id": "load-target",
  "name": "Load target",
  "required": true,
  "status": "running",
  "started_at": "2026-04-25T10:04:00Z",
  "finished_at": null
}
```

## Invalid task object (status)

```json
{
  "task_id": "load-target",
  "name": "Load target",
  "required": true,
  "status": "skipped"
}
```

Why invalid:

- `skipped` is not an allowed task status.

## Invalid task object (missing required)

```json
{
  "task_id": "load-target",
  "name": "Load target",
  "status": "queued"
}
```

Why invalid:

- `required` must always be present and boolean.

## Valid job completion with optional failure

```json
{
  "job_id": "job.import.001",
  "status": "completed",
  "required_task_summary": {
    "total": 2,
    "succeeded": 2,
    "failed": 0,
    "cancelled": 0
  },
  "optional_task_summary": {
    "total": 1,
    "succeeded": 0,
    "failed": 1,
    "cancelled": 0
  }
}
```

Reason:

- Required tasks succeeded, but optional task degraded outcome.

## Valid job failure due to cancelled required task

```json
{
  "job_id": "job.import.002",
  "status": "failed",
  "failure_reason": "required_task_cancelled",
  "failed_required_task_ids": ["fetch-source"]
}
```

Reason:

- Required task cancellation is treated as job failure by contract.
