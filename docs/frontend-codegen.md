# Frontend Type and Validator Generation

This project keeps API contracts as the source of truth at repo root:

- OpenAPI: `openapi.yaml`
- JSON Schema: `schemas/`

The frontend consumes those contracts from `frontend/` and generates TypeScript types and validator registry artifacts.

## Prerequisites

- Node.js 20+
- npm

## Commands

Run from `frontend/`:

- `npm run generate:types` - generate REST types from `../openapi.yaml`
- `npm run generate:validators` - generate schema registry from `../schemas/**/*.json`
- `npm run generate` - run both generators
- `npm run check:generated` - fail if generated files are stale

## Generated Files

- `frontend/src/generated/api-types.ts`
- `frontend/src/generated/schema-registry.ts`

Do not edit generated files manually.

## Runtime Validation

Runtime validation is implemented in:

- `frontend/src/lib/contract/validators.ts`
- `frontend/src/lib/contract/client.ts`
- `frontend/src/lib/contract/sse.ts`

Helpers include:

- `validateSchema(schemaPath, payload)`
- `validateSseEvent(payload)`
- `createJobServerClient({ baseUrl, token })`
- `openValidatedEventStream(options, handlers)`

Schema path constants are in:

- `frontend/src/lib/contract/schema-paths.ts`

## Tests

Validator tests live in:

- `frontend/src/lib/contract/validators.test.ts`
- `frontend/src/lib/contract/client.test.ts`
- `frontend/src/lib/contract/sse.test.ts`

Run with:

- `npm run test`
