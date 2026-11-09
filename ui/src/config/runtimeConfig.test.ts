import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigError, loadRuntimeConfig } from './runtimeConfig'

const valid = {
  region: 'us-east-1',
  apiUrl: 'https://api.example.com/prod/',
  userPoolId: 'us-east-1_abc',
  userPoolClientId: 'client',
  agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-east-1:1:runtime/x',
}

const env = {
  VITE_AWS_REGION: 'eu-west-1',
  VITE_API_BASE_URL: 'http://local/api/',
  VITE_COGNITO_USER_POOL_ID: 'eu-west-1_env',
  VITE_COGNITO_USER_POOL_CLIENT_ID: 'envclient',
  VITE_AGENT_RUNTIME_ARN: 'arn:env',
  VITE_AGENT_ENDPOINT: 'http://localhost:8080/invocations',
}

afterEach(() => vi.unstubAllGlobals())

describe('loadRuntimeConfig', () => {
  it('loads /config.json without caching and honors optional keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...valid, agentUrl: 'http://x/invocations', agentTokenType: 'id' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const config = await loadRuntimeConfig({})

    expect(fetchMock).toHaveBeenCalledWith('/config.json', { cache: 'no-store' })
    expect(config).toEqual({ ...valid, agentUrl: 'http://x/invocations', agentTokenType: 'id' })
  })

  it('falls back to VITE_* variables when the response is HTML (dev server)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html>', { status: 200 })))

    const config = await loadRuntimeConfig(env)

    expect(config.region).toBe('eu-west-1')
    expect(config.userPoolId).toBe('eu-west-1_env')
    expect(config.agentUrl).toBe('http://localhost:8080/invocations')
  })

  it('falls back to the environment when config.json is missing a required key', async () => {
    const { userPoolId: _omit, ...partial } = valid
    void _omit
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(partial), { status: 200 })))

    const config = await loadRuntimeConfig(env)

    expect(config.userPoolId).toBe('eu-west-1_env')
  })

  it('throws ConfigError when neither source is complete', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })))

    await expect(loadRuntimeConfig({})).rejects.toBeInstanceOf(ConfigError)
  })
})
