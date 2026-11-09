import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DirectAgentTransport } from '../agent/transport'
import type { AgentTransport } from '../agent/types'
import { useChat } from '../agent/useChat'

const defaultTransport = new DirectAgentTransport()

interface ChatDockProps {
  actorId: string
  transport?: AgentTransport
}

export function ChatDock({ actorId, transport = defaultTransport }: ChatDockProps) {
  const { messages, status, tool, error, send, retry, newConversation } = useChat(transport, actorId)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages, status])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || status === 'streaming') return
    setDraft('')
    setOpen(true)
    void send(text)
  }

  return (
    <section className="chat-dock" aria-label="HR assistant" data-testid="chat-dock">
      {open && (
        <div className="chat-panel" data-testid="chat-panel">
          <div className="chat-panel-head">
            <h2>HR assistant</h2>
            <div>
              <button
                type="button"
                className="btn secondary small"
                onClick={newConversation}
                data-testid="chat-new"
              >
                New conversation
              </button>{' '}
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setOpen(false)}
                data-testid="chat-collapse"
              >
                Collapse
              </button>
            </div>
          </div>
          <div
            className="chat-transcript"
            aria-live="polite"
            aria-label="Conversation"
            data-testid="chat-transcript"
          >
            {messages.length === 0 && (
              <p className="muted">Ask about employees, leave balances or HR requests.</p>
            )}
            {messages.map((m) =>
              m.role === 'assistant' && m.text === '' ? null : (
                <div key={m.id} className={`bubble ${m.role}`} data-testid={`chat-message-${m.role}`}>
                  {m.text}
                </div>
              ),
            )}
            {status === 'streaming' && (
              <p className="chat-tool" data-testid="chat-tool">
                {tool ? `Using ${tool}…` : 'Thinking…'}
              </p>
            )}
            {status === 'error' && (
              <div role="alert" data-testid="chat-error">
                <p className="error">{error}</p>
                <button type="button" className="btn small" onClick={() => void retry()} data-testid="chat-retry">
                  Retry
                </button>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>
      )}
      <form className="chat-bar" onSubmit={onSubmit} data-testid="chat-form">
        <label htmlFor="chat-input" className="visually-hidden">
          Ask the HR assistant
        </label>
        <input
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => messages.length > 0 && setOpen(true)}
          placeholder="Ask the HR assistant..."
          autoComplete="off"
          data-testid="chat-input"
        />
        <button
          type="submit"
          className="btn"
          disabled={status === 'streaming' || draft.trim() === ''}
          data-testid="chat-send"
        >
          Send
        </button>
        {!open && messages.length > 0 && (
          <button
            type="button"
            className="btn secondary"
            onClick={() => setOpen(true)}
            data-testid="chat-expand"
          >
            Open chat
          </button>
        )}
      </form>
    </section>
  )
}
