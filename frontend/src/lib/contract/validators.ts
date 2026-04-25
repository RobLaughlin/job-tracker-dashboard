import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { ErrorObject, ValidateFunction } from 'ajv'
import {
  schemaRegistry,
  streamEventSchemaPath,
  type SchemaPath,
} from '../../generated/schema-registry'

const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  allowUnionTypes: false,
})

addFormats(ajv)

for (const [schemaPath, schema] of Object.entries(schemaRegistry)) {
  ajv.addSchema(schema, schemaPath)
}

const validatorCache = new Map<SchemaPath, ValidateFunction>()

function formatError(error: ErrorObject) {
  const field = error.instancePath || '/'
  return `${field}: ${error.message ?? 'validation error'}`
}

function validatorFor(schemaPath: SchemaPath) {
  const existing = validatorCache.get(schemaPath)
  if (existing) {
    return existing
  }

  const compiled = ajv.getSchema(schemaPath)
  if (!compiled) {
    throw new Error(`Schema not loaded: ${schemaPath}`)
  }

  validatorCache.set(schemaPath, compiled)
  return compiled
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] }

export function validateSchema<T>(schemaPath: SchemaPath, payload: unknown): ValidationResult<T> {
  const validate = validatorFor(schemaPath)
  const valid = validate(payload)

  if (valid) {
    return { ok: true, data: payload as T }
  }

  const errors = (validate.errors ?? []).map(formatError)
  return { ok: false, errors }
}

export function validateSseEvent<T>(payload: unknown): ValidationResult<T> {
  return validateSchema<T>(streamEventSchemaPath, payload)
}
