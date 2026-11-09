import { getIdToken } from '../auth/authService'
import { getConfig } from '../config/runtimeConfig'

export const REQUEST_TIMEOUT_MS = 30_000

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let unauthorizedHandler: (() => void) | null = null

export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

interface ValidationItem {
  msg?: string
  loc?: unknown[]
}

async function readMessage(response: Response): Promise<string> {
  let detail: unknown
  try {
    const body = (await response.json()) as { detail?: unknown; message?: unknown }
    detail = body.detail ?? body.message
  } catch {
    detail = undefined
  }
  if (response.status === 422 && Array.isArray(detail)) {
    const text = (detail as ValidationItem[])
      .map((item) => {
        const field = Array.isArray(item.loc) ? String(item.loc[item.loc.length - 1]) : ''
        return field ? `${field}: ${item.msg ?? 'invalid'}` : (item.msg ?? 'invalid')
      })
      .join('; ')
    return `Please check your input. ${text}`
  }
  if (typeof detail === 'string' && detail) return detail
  if (response.status === 404) return 'Not found'
  return `Request failed (${response.status})`
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getIdToken()
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  const headers = new Headers(init.headers)
  headers.set('Authorization', token)
  headers.set('Accept', 'application/json')

  let response: Response
  try {
    response = await fetch(joinUrl(getConfig().apiUrl, path), {
      ...init,
      headers,
      signal: controller.signal,
    })
  } catch {
    throw new ApiError(
      0,
      timedOut ? 'The request timed out. Please try again.' : 'Network error. Please try again.',
    )
  } finally {
    clearTimeout(timer)
  }

  if (response.status === 401) {
    unauthorizedHandler?.()
    throw new ApiError(401, 'Your session has expired. Please sign in again.')
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readMessage(response))
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Builds RequestInit for a JSON body. */
export function jsonBody(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
