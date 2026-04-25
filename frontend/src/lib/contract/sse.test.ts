import { describe, expect, it } from 'vitest'
import { parseSseChunk } from './sse'

describe('parseSseChunk', () => {
  it('parses complete SSE frames and returns remainder', () => {
    const input = [
      'id: 01',
      'event: task.updated',
      'data: {"event_type":"task.updated"}',
      '',
      'id: 02',
      'event: heartbeat',
      'data: {"event_type":"heartbeat"}',
      '',
      'id: 03',
    ].join('\n')

    const parsed = parseSseChunk(input)

    expect(parsed.frames).toHaveLength(2)
    expect(parsed.frames[0]).toEqual({
      id: '01',
      event: 'task.updated',
      data: '{"event_type":"task.updated"}',
    })
    expect(parsed.frames[1]?.event).toBe('heartbeat')
    expect(parsed.remainder).toBe('id: 03')
  })

  it('joins multiline data values', () => {
    const input = ['event: snapshot', 'data: {"line":1,', 'data: "line":2}', '', ''].join('\n')
    const parsed = parseSseChunk(input)

    expect(parsed.frames).toHaveLength(1)
    expect(parsed.frames[0]?.data).toBe('{"line":1,\n"line":2}')
  })
})
