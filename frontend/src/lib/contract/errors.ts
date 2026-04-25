import type { ErrorResponse } from './types'

export class ContractValidationError extends Error {
  readonly kind = 'contract_validation_error'
  readonly schemaPath: string
  readonly validationErrors: string[]
  readonly payload: unknown

  constructor(schemaPath: string, validationErrors: string[], payload: unknown) {
    super(`Payload failed schema validation: ${schemaPath}`)
    this.schemaPath = schemaPath
    this.validationErrors = validationErrors
    this.payload = payload
  }
}

export class JobServerHttpError extends Error {
  readonly kind = 'job_server_http_error'
  readonly status: number
  readonly url: string
  readonly details?: ErrorResponse

  constructor(status: number, url: string, details?: ErrorResponse) {
    super(`Job server request failed with status ${status}: ${url}`)
    this.status = status
    this.url = url
    this.details = details
  }
}
