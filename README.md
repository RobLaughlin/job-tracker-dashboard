# Job Server Contract (Phase 0)

This repository defines a strict, secure contract for any Job Server that powers a static frontend dashboard.

The dashboard lets a user enter a Job Server URL (for example `http://localhost:8080` or `https://jobserver.example.io`), fetch initial state over REST, then receive live updates over Server-Sent Events (SSE).

## Goals

- Define a strict REST + SSE contract that servers must follow to be considered valid.
- Keep schema and event behavior deterministic and versioned.
- Support job-level dependency graph visualization with status-driven node color/icon.
- Keep security baseline production-safe while still friendly for localhost development.

## Contract Highlights

- API versioning: `/v1/...`
- Authentication: `Authorization: Bearer <token>` required for REST and SSE.
- SSE model: one global stream endpoint (`GET /v1/stream`) with optional filters.
- Schema strictness: strong validation, explicit enums, `additionalProperties: false`.
- Job dependencies: job-to-job edges only in Phase 0.

## Status Model

- Task statuses:
  - `queued`
  - `running`
  - `succeeded`
  - `failed`
  - `cancelled`

- Job statuses:
  - `queued`
  - `waiting_dependency`
  - `running`
  - `failed`
  - `completed`
  - `succeeded`
  - `cancelled`

- Required-task rules:
  - Every task has required `required: boolean`.
  - Any required task in `failed` -> job becomes `failed`.
  - Any required task in `cancelled` -> job becomes `failed`.
  - Job is `succeeded` only if all required tasks are `succeeded`.
  - Job is `completed` when terminal with required tasks satisfied, but one or more non-required tasks failed or were cancelled.

## Valid Job Server Checklist

A server is considered valid if it:

- Implements all required endpoints in `docs/rest-api.md`.
- Implements SSE framing and event types in `docs/sse-protocol.md`.
- Enforces auth and returns contract-compliant errors.
- Emits only schema-valid payloads and events.
- Enforces legal state transitions in `docs/status-semantics.md`.
- Supports reconnect/resume behavior via SSE `id` and `Last-Event-ID`.

## Frontend Integration Flow

1. Validate user-provided base URL and token.
2. Bootstrap state via REST (`/jobs`, `/jobs/{job_id}`, `/jobs/{job_id}/tasks`, `/jobs/{job_id}/dependencies`).
3. Open SSE stream with `GET /v1/stream`.
4. Apply strict runtime validation for each incoming event.
5. Reconnect with backoff and `Last-Event-ID` on disconnect.

## Documentation Index

- Contract overview: `docs/contract-overview.md`
- REST contract: `docs/rest-api.md`
- SSE protocol: `docs/sse-protocol.md`
- Status semantics and transitions: `docs/status-semantics.md`
- OpenAPI contract: `openapi.yaml`
- JSON Schemas: `schemas/`
