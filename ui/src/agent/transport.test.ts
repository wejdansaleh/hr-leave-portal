import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setConfig } from '../config/runtimeConfig'

vi.mock('../auth/authService', () => ({
  getAccessToken: vi.fn().mockResolvedValue('access-abc'),
  getIdToken: vi.fn().mockResolvedValue('id-xyz'),
}))

import { DirectAgentTransport, buildInvokeUrl, newSessionId } from './transport'
import type { AgentEvent } from './types'

const ARN = 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/hrAgent-xxx'
const baseConfig = {
  region: 'us-east-1',
  apiUrl: 'https://api.example.com/prod/',
  userPoolId: 'p',
  userPoolClientId: 'c',
  agentRuntimeArn: ARN,
}

function sseResponse(): Response {
  const body = `data: ${JSON.stringify({ event: { contentBlockDelta: { delta: { text: 'Hi' } } } })}\n\n`
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

async function run(transport: DirectAgentTransport): Promise<AgentEvent[]> {
  const events: AgentEvent[] = []
  for await (const e of transport.send({ prompt: 'hello', actorId: 'sub-1', sessionId: newSessionId() })) {
    events.push(e)
  }
  return events
}

describe('DirectAgentTransport', () => {
  beforeEach(() => setConfig({ ...baseConfig }))
  afterEach(() => vi.unstubAllGlobals())

  it('builds the invoke URL from the runtime ARN', () => {
    expect(buildInvokeUrl('us-east-1', ARN)).toBe(
      `https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/${encodeURIComponent(ARN)}/invocations?qualifier=DEFAULT`,
    )
    expect(buildInvokeUrl('us-east-1', ARN, 'http://localhost:8080/invocations')).toBe(
      'http://localhost:8080/invocations',
    )
  })

  it('creates session ids of at least 33 characters that differ each time', () => {
    const a = newSessionId()
    expect(a.length).toBeGreaterThanOrEqual(33)
    expect(newSessionId()).not.toBe(a)
  })

  it('posts {prompt, actorId} with the access token as Bearer by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse())
    vi.stubGlobal('fetch', fetchMock)

    const events = await run(new DirectAgentTransport())

    expect(events).toEqual([{ type: 'text', text: 'Hi' }])
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/runtimes/' + encodeURIComponent(ARN) + '/invocations')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer access-abc')
    expect(headers.Accept).toBe('text/event-stream')
    expect(headers['X-Amzn-Bedrock-AgentCore-Runtime-Session-Id'].length).toBeGreaterThanOrEqual(33)
    expect(JSON.parse(init.body as string)).toEqual({ prompt: 'hello', actorId: 'sub-1' })
  })

  it('uses the ID token when agentTokenType is "id"', async () => {
    setConfig({ ...baseConfig, agentTokenType: 'id' })
    const fetchMock = vi.fn().mockResolvedValue(sseResponse())
    vi.stubGlobal('fetch', fetchMock)

    await run(new DirectAgentTransport())

    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer id-xyz')
  })

  it('throws a readable error when the agent responds with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('no', { status: 403 })))

    await expect(run(new DirectAgentTransport())).rejects.toThrow(/403/)
  })
})
