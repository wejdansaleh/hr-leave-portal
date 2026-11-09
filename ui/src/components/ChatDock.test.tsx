import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEvent, AgentRequest, AgentTransport } from '../agent/types'

vi.mock('../auth/authService', () => ({ getAccessToken: vi.fn(), getIdToken: vi.fn() }))

import { ChatDock } from './ChatDock'

class FakeTransport implements AgentTransport {
  requests: AgentRequest[] = []
  script: Array<AgentEvent[] | Error>

  constructor(script: Array<AgentEvent[] | Error>) {
    this.script = script
  }

  async *send(req: AgentRequest): AsyncGenerator<AgentEvent> {
    this.requests.push(req)
    const next = this.script.shift() ?? []
    if (next instanceof Error) throw next
    for (const event of next) yield event
  }
}

describe('ChatDock', () => {
  it('streams the assistant reply into an aria-live transcript', async () => {
    const transport = new FakeTransport([
      [
        { type: 'tool', name: 'list_employees' },
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'there' },
        { type: 'end' },
      ],
    ])
    const user = userEvent.setup()
    render(<ChatDock actorId="sub-1" transport={transport} />)

    await user.type(screen.getByTestId('chat-input'), 'hi')
    await user.click(screen.getByTestId('chat-send'))

    expect(await screen.findByText('Hello there')).toBeInTheDocument()
    expect(screen.getByTestId('chat-transcript')).toHaveAttribute('aria-live', 'polite')
    expect(transport.requests[0]).toMatchObject({ prompt: 'hi', actorId: 'sub-1' })
  })

  it('shows an error with a retry action that resends the prompt', async () => {
    const transport = new FakeTransport([
      new Error('The assistant could not be reached (403).'),
      [{ type: 'text', text: 'Recovered' }, { type: 'end' }],
    ])
    const user = userEvent.setup()
    render(<ChatDock actorId="sub-1" transport={transport} />)

    await user.type(screen.getByTestId('chat-input'), 'help')
    await user.click(screen.getByTestId('chat-send'))

    expect(await screen.findByTestId('chat-error')).toHaveTextContent('403')
    await user.click(screen.getByTestId('chat-retry'))

    expect(await screen.findByText('Recovered')).toBeInTheDocument()
    expect(transport.requests).toHaveLength(2)
    expect(transport.requests[1].prompt).toBe('help')
    expect(transport.requests[1].sessionId).toBe(transport.requests[0].sessionId)
  })

  it('starts a new session and clears the history on "New conversation"', async () => {
    const transport = new FakeTransport([
      [{ type: 'text', text: 'First answer' }, { type: 'end' }],
      [{ type: 'text', text: 'Second answer' }, { type: 'end' }],
    ])
    const user = userEvent.setup()
    render(<ChatDock actorId="sub-1" transport={transport} />)

    await user.type(screen.getByTestId('chat-input'), 'one')
    await user.click(screen.getByTestId('chat-send'))
    await screen.findByText('First answer')

    await user.click(screen.getByTestId('chat-new'))
    expect(screen.queryByText('First answer')).not.toBeInTheDocument()

    await user.type(screen.getByTestId('chat-input'), 'two')
    await user.click(screen.getByTestId('chat-send'))
    await screen.findByText('Second answer')

    const [first, second] = transport.requests
    expect(second.sessionId).not.toBe(first.sessionId)
    expect(second.sessionId.length).toBeGreaterThanOrEqual(33)
  })
})
