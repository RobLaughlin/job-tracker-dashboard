# Job Dashboard Frontend

React + TypeScript + Vite frontend for the Job Server contract.

## Setup

```bash
npm install
```

## Development

```bash
npm run generate
npm run dev
```

## Contract Code Generation

The frontend uses contract artifacts from the repository root:

- `../openapi.yaml`
- `../schemas/`

Commands:

- `npm run generate:types`
- `npm run generate:validators`
- `npm run generate`
- `npm run check:generated`

Generated output:

- `src/generated/api-types.ts`
- `src/generated/schema-registry.ts`

## Validation Helpers

- `src/lib/contract/validators.ts`
- `src/lib/contract/schema-paths.ts`
- `src/lib/contract/client.ts`
- `src/lib/contract/sse.ts`

Main entrypoint exports are re-exported from `src/lib/contract/index.ts`.

## Verification

```bash
npm run lint
npm run test
npm run build
```
