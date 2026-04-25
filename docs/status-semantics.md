# Status Semantics and Transition Rules

This document is normative for status meaning and legal transitions.

## Task Statuses

Allowed values:

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

Terminal task statuses:

- `succeeded`
- `failed`
- `cancelled`

### Legal Task Transitions

- `queued -> running`
- `queued -> cancelled`
- `running -> succeeded`
- `running -> failed`
- `running -> cancelled`

Disallowed examples:

- `succeeded -> running`
- `failed -> succeeded`
- `cancelled -> running`

## Job Statuses

Allowed values:

- `queued`
- `waiting_dependency`
- `running`
- `failed`
- `completed`
- `succeeded`
- `cancelled`

Terminal job statuses:

- `failed`
- `completed`
- `succeeded`
- `cancelled`

## Required Task Rule

Each task includes mandatory `required: boolean`.

Normative rules:

- If any required task is `failed`, job status must become `failed`.
- If any required task is `cancelled`, job status must become `failed`.
- Job can be `succeeded` only when all required tasks are `succeeded`.
- Non-required task failures/cancellations do not force job `failed`.

## Job Outcome Derivation

At terminal evaluation time:

1. If explicit job-level abort occurred, result is `cancelled`.
2. Else if any required task is `failed` or `cancelled`, result is `failed`.
3. Else if all required tasks are `succeeded` and all tasks terminal:
   - If any non-required task is `failed` or `cancelled`, result is `completed`.
   - Otherwise, result is `succeeded`.

Notes:

- `completed` means terminal with required outcomes satisfied but optional degradation present.
- `succeeded` means clean success across all required tasks.

## Dependency Gate

Jobs with required upstream dependencies in `depends_on` must not enter `running` until dependency policy is satisfied.

Recommended dependency mode for Phase 0:

- `all_of`: all required upstream jobs must be `succeeded`.

If dependencies are unresolved, status should remain `waiting_dependency`.

## Legal Job Transitions

- `queued -> waiting_dependency`
- `queued -> running` (if no dependencies)
- `waiting_dependency -> running`
- `running -> failed`
- `running -> completed`
- `running -> succeeded`
- `queued -> cancelled`
- `waiting_dependency -> cancelled`
- `running -> cancelled`

Disallowed examples:

- `failed -> running`
- `succeeded -> running`
- `completed -> running`
- `cancelled -> running`

## Graph Visualization Mapping (Recommended)

- `queued`: neutral gray dot
- `waiting_dependency`: amber clock
- `running`: blue pulse
- `failed`: red error icon
- `completed`: orange check-warning icon
- `succeeded`: green check icon
- `cancelled`: slate stop icon
