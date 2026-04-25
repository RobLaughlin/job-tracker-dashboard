# Agent Contribution Rules

This repository is contract-first. Agents must keep code, generated artifacts, and documentation aligned.

## Required checks before commit/push

- Pre-commit runs `npm run verify:precommit` from repo root.
- Pre-push runs `npm run verify:prepush` from repo root.

## Test policy

- Add or update unit tests whenever behavior changes.
- Do not ship contract runtime/client changes without tests.
- Keep existing tests green.

## Contract change policy

If `openapi.yaml` or anything under `schemas/` changes, agents must:

1. Regenerate frontend artifacts (`frontend/src/generated/*`) via `npm --prefix frontend run generate`.
2. Update documentation that describes the contract (`README.md`, `docs/*.md`, `frontend/README.md` as needed).
3. Update examples when semantics changed.

## Documentation policy

- Keep root `README.md` current with workflow/tooling changes.
- Keep `docs/frontend-codegen.md` current with generation and validation behavior.
- Keep `frontend/README.md` current with local developer commands.
