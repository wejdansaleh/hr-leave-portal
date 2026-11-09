import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setConfig } from '../config/runtimeConfig'

vi.mock('../auth/authService', () => ({
  getIdToken: vi.fn().mockResolvedValue('id-token-123'),
}))

import { ApiError, REQUEST_TIMEOUT_MS, apiFetch, jsonBody, onUnauthorized } from './client'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('apiFetch', () => {
  beforeEach(() => {
    setConfig({
      region: 'us-east-1',
      apiUrl: 'https://api.example.com/prod/',
      userPoolId: 'p',
      userPoolClientId: 'c',
      agentRuntimeArn: 'arn',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    onUnauthorized(null)
  })

  it('sends the raw ID token and joins the path without doubling slashes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [{ employeeId: 'e1' }]))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiFetch<unknown[]>('/employees')

    expect(result).toEqual([{ employeeId: 'e1' }])
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.com/prod/employees')
    expect(new Headers(init.headers).get('Authorization')).toBe('id-token-123')
  })

  it('sends JSON bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, {}))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('employees', jsonBody('POST', { name: 'Ada' }))

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"name":"Ada"}')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
  })

  it('maps 404 to an ApiError with the server detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { detail: 'Employee not found' })))

    await expect(apiFetch('employees/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Employee not found',
    })
  })

  it('maps 422 validation details to a readable message', async () => {
    const detail = [{ loc: ['body', 'startDate'], msg: 'Input should be a valid date' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(422, { detail })))

    const error = await apiFetch('employees').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(422)
    expect((error as ApiError).message).toContain('startDate: Input should be a valid date')
  })

  it('calls the unauthorized handler on 401', async () => {
    const handler = vi.fn()
    onUnauthorized(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' })))

    await expect(apiFetch('employees')).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('aborts and reports a timeout after 30 seconds', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
      ),
    )

    const pending = apiFetch('employees').catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1)
    const error = (await pending) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.message).toMatch(/timed out/i)
  })
})
