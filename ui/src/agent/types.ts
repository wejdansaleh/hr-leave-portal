export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'end' }

export interface AgentRequest {
  prompt: string
  actorId: string
  sessionId: string
  signal?: AbortSignal
}

export interface AgentTransport {
  send(req: AgentRequest): AsyncIterable<AgentEvent>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export type ChatStatus = 'idle' | 'streaming' | 'error'
