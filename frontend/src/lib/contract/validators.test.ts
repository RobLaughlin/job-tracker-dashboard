import { describe, expect, it } from 'vitest'
import { REST_SCHEMA_PATHS, SSE_SCHEMA_PATHS } from './schema-paths'
import { validateSchema, validateSseEvent } from './validators'

describe('contract validators', () => {
  it('accepts a valid health response', () => {
    const payload = {
      status: 'ok',
      service: 'job-server',
      api_version: 'v1',
      schema_version: '1.0.0',
      time: '2026-04-25T11:22:33Z',
    }

    const result = validateSchema(REST_SCHEMA_PATHS.healthResponse, payload)
    expect(result.ok).toBe(true)
  })

  it('rejects health response with invalid schema version', () => {
    const payload = {
      status: 'ok',
      service: 'job-server',
      api_version: 'v1',
      schema_version: '2.0.0',
      time: '2026-04-25T11:22:33Z',
    }

    const result = validateSchema(REST_SCHEMA_PATHS.healthResponse, payload)
    expect(result.ok).toBe(false)
  })

  it('accepts a valid SSE task.updated event envelope', () => {
    const payload = {
      event_id: '01JSGYP5AT4M5053X90TT5X6YS',
      event_type: 'task.updated',
      schema_version: '1.0.0',
      occurred_at: '2026-04-25T10:00:20Z',
      job_id: 'job.import.001',
      payload: {
        task_id: 'fetch-source',
        required: true,
        status: 'succeeded',
      },
    }

    const result = validateSchema(SSE_SCHEMA_PATHS.streamEvent, payload)
    expect(result.ok).toBe(true)

    const dedicatedResult = validateSseEvent(payload)
    expect(dedicatedResult.ok).toBe(true)
  })

  it('rejects SSE event with illegal task status', () => {
    const payload = {
      event_id: '01JSGYP5AT4M5053X90TT5X6YS',
      event_type: 'task.updated',
      schema_version: '1.0.0',
      occurred_at: '2026-04-25T10:00:20Z',
      job_id: 'job.import.001',
      payload: {
        task_id: 'fetch-source',
        required: true,
        status: 'skipped',
      },
    }

    const result = validateSchema(SSE_SCHEMA_PATHS.streamEvent, payload)
    expect(result.ok).toBe(false)
  })
})
