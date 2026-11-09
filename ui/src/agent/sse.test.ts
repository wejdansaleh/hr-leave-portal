import { describe, expect, it } from 'vitest'
import { parseSse } from './sse'
import type { AgentEvent } from './types'

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = []
  for await (const event of parseSse(stream)) events.push(event)
  return events
}

const text = (t: string) => `data: ${JSON.stringify({ event: { contentBlockDelta: { delta: { text: t } } } })}\n\n`
const tool = (n: string) =>
  `data: ${JSON.stringify({ event: { contentBlockStart: { start: { toolUse: { name: n } } } } })}\n\n`
const stop = `data: ${JSON.stringify({ event: { messageStop: { stopReason: 'end_turn' } } })}\n\n`

describe('parseSse', () => {
  it('yields text, tool and end events and ignores everything else', async () => {
    const other = `data: ${JSON.stringify({ event: { messageStart: { role: 'assistant' } } })}\n\n`
    const events = await collect(
      streamOf([other, tool('list_employees'), text('Hello'), text(' world'), `data: ${JSON.stringify({ init: true })}\n\n`, stop]),
    )

    expect(events).toEqual([
      { type: 'tool', name: 'list_employees' },
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' world' },
      { type: 'end' },
    ])
  })

  it('handles chunks split at arbitrary byte positions', async () => {
    const whole = text('Split reply') + stop
    const chunks = whole.match(/[\s\S]{1,7}/g) ?? []

    const events = await collect(streamOf(chunks))

    expect(events).toEqual([{ type: 'text', text: 'Split reply' }, { type: 'end' }])
  })

  it('ignores malformed lines without failing', async () => {
    const events = await collect(streamOf(['data: {not json\n\n', 'event: ping\n\n', text('ok')]))

    expect(events).toEqual([{ type: 'text', text: 'ok' }])
  })
})
