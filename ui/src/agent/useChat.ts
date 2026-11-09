import { useCallback, useEffect, useRef, useState } from 'react'
import { newSessionId } from './transport'
import type { AgentTransport, ChatMessage, ChatStatus } from './types'

export interface UseChat {
  messages: ChatMessage[]
  status: ChatStatus
  tool: string | null
  error: string | null
  send: (prompt: string) => Promise<void>
  retry: () => Promise<void>
  newConversation: () => void
}

let counter = 0
function nextId(): string {
  counter += 1
  return `m${counter}`
}

export function useChat(transport: AgentTransport, actorId: string): UseChat {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [tool, setTool] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef(newSessionId())
  const abortRef = useRef<AbortController | null>(null)
  const lastPromptRef = useRef<string | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const run = useCallback(
    async (prompt: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const assistantId = nextId()

      setError(null)
      setTool(null)
      setStatus('streaming')
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', text: '' }])

      try {
        for await (const event of transport.send({
          prompt,
          actorId,
          sessionId: sessionRef.current,
          signal: controller.signal,
        })) {
          if (event.type === 'text') {
            setTool(null)
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + event.text } : m)),
            )
          } else if (event.type === 'tool') {
            setTool(event.name)
          } else {
            break
          }
        }
        if (!controller.signal.aborted) setStatus('idle')
      } catch (e) {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
        setStatus('error')
      } finally {
        if (!controller.signal.aborted) setTool(null)
      }
    },
    [transport, actorId],
  )

  const send = useCallback(
    async (prompt: string) => {
      const text = prompt.trim()
      if (!text) return
      lastPromptRef.current = text
      setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }])
      await run(text)
    },
    [run],
  )

  const retry = useCallback(async () => {
    const prompt = lastPromptRef.current
    if (!prompt) return
    // Drop the failed (possibly partial) assistant reply and ask again.
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      return last && last.role === 'assistant' ? prev.slice(0, -1) : prev
    })
    await run(prompt)
  }, [run])

  const newConversation = useCallback(() => {
    abortRef.current?.abort()
    sessionRef.current = newSessionId()
    lastPromptRef.current = null
    setMessages([])
    setStatus('idle')
    setTool(null)
    setError(null)
  }, [])

  return { messages, status, tool, error, send, retry, newConversation }
}
