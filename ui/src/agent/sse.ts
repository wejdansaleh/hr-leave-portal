import type { AgentEvent } from './types'

interface ConverseEvent {
  contentBlockDelta?: { delta?: { text?: unknown } }
  contentBlockStart?: { start?: { toolUse?: { name?: unknown } } }
  messageStop?: unknown
}

/** Converts one SSE `data:` payload into an AgentEvent, or null when it is not relevant or malformed. */
export function parseDataLine(payload: string): AgentEvent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const event = (parsed as { event?: ConverseEvent }).event
  if (typeof event !== 'object' || event === null) return null

  const text = event.contentBlockDelta?.delta?.text
  if (typeof text === 'string') return { type: 'text', text }

  const name = event.contentBlockStart?.start?.toolUse?.name
  if (typeof name === 'string') return { type: 'tool', name }

  if (event.messageStop !== undefined) return { type: 'end' }
  return null
}

/** Incrementally parses a server-sent-event byte stream; chunks may be split anywhere. */
export async function* parseSse(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  function* drain(final: boolean): Generator<AgentEvent> {
    let newline = buffer.indexOf('\n')
    while (newline !== -1 || (final && buffer !== '')) {
      let line: string
      if (newline !== -1) {
        line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
      } else {
        line = buffer
        buffer = ''
      }
      line = line.replace(/\r$/, '')
      if (line.startsWith('data:')) {
        const event = parseDataLine(line.slice(5).trim())
        if (event) yield event
      }
      newline = buffer.indexOf('\n')
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      yield* drain(false)
    }
    buffer += decoder.decode()
    yield* drain(true)
  } finally {
    reader.releaseLock()
  }
}
