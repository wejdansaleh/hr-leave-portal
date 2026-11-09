import { getAccessToken, getIdToken } from '../auth/authService'
import { getConfig } from '../config/runtimeConfig'
import { parseSse } from './sse'
import type { AgentEvent, AgentRequest, AgentTransport } from './types'

export type { AgentTransport } from './types'

/** Session ids must be at least 33 characters for AgentCore. */
export function newSessionId(): string {
  return `hr-session-${crypto.randomUUID()}`
}

export function buildInvokeUrl(region: string, runtimeArn: string, agentUrl?: string): string {
  if (agentUrl) return agentUrl
  return (
    `https://bedrock-agentcore.${region}.amazonaws.com/runtimes/` +
    `${encodeURIComponent(runtimeArn)}/invocations?qualifier=DEFAULT`
  )
}

export class DirectAgentTransport implements AgentTransport {
  async *send(req: AgentRequest): AsyncGenerator<AgentEvent> {
    const config = getConfig()
    const token = config.agentTokenType === 'id' ? await getIdToken() : await getAccessToken()

    const response = await fetch(buildInvokeUrl(config.region, config.agentRuntimeArn, config.agentUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': req.sessionId,
      },
      body: JSON.stringify({ prompt: req.prompt, actorId: req.actorId }),
      signal: req.signal,
    })

    if (!response.ok) {
      throw new Error(`The assistant could not be reached (${response.status}).`)
    }
    if (!response.body) {
      throw new Error('The assistant returned an empty response.')
    }
    yield* parseSse(response.body)
  }
}
