export interface RuntimeConfig {
  region: string
  apiUrl: string
  userPoolId: string
  userPoolClientId: string
  agentRuntimeArn: string
  agentUrl?: string
  agentTokenType?: 'access' | 'id'
}

const REQUIRED_KEYS = [
  'region',
  'apiUrl',
  'userPoolId',
  'userPoolClientId',
  'agentRuntimeArn',
] as const

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/** Returns a normalized config when every required key is a non-empty string, otherwise null. */
export function parseConfig(raw: unknown): RuntimeConfig | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  for (const key of REQUIRED_KEYS) {
    if (!nonEmpty(record[key])) return null
  }
  const config: RuntimeConfig = {
    region: record.region as string,
    apiUrl: record.apiUrl as string,
    userPoolId: record.userPoolId as string,
    userPoolClientId: record.userPoolClientId as string,
    agentRuntimeArn: record.agentRuntimeArn as string,
  }
  if (nonEmpty(record.agentUrl)) config.agentUrl = record.agentUrl
  if (record.agentTokenType === 'id' || record.agentTokenType === 'access') {
    config.agentTokenType = record.agentTokenType
  }
  return config
}

function fromEnv(env: Record<string, string | undefined>): RuntimeConfig | null {
  return parseConfig({
    region: env.VITE_AWS_REGION,
    apiUrl: env.VITE_API_BASE_URL,
    userPoolId: env.VITE_COGNITO_USER_POOL_ID,
    userPoolClientId: env.VITE_COGNITO_USER_POOL_CLIENT_ID,
    agentRuntimeArn: env.VITE_AGENT_RUNTIME_ARN,
    agentUrl: env.VITE_AGENT_ENDPOINT,
    agentTokenType: env.VITE_AGENT_TOKEN_TYPE,
  })
}

export class ConfigError extends Error {
  constructor() {
    super(
      'The application is not configured. Provide /config.json or the VITE_* environment variables ' +
        '(region, API URL, user pool id, user pool client id, agent runtime ARN).',
    )
    this.name = 'ConfigError'
  }
}

/**
 * Loads /config.json (production). When it is missing or invalid (for example the Vite dev
 * server answers with index.html), falls back to the VITE_* variables.
 */
export async function loadRuntimeConfig(
  env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>,
): Promise<RuntimeConfig> {
  try {
    const response = await fetch('/config.json', { cache: 'no-store' })
    if (response.ok) {
      const parsed = parseConfig(await response.json())
      if (parsed) return parsed
    }
  } catch {
    // not JSON, or the request failed: fall back to the environment
  }
  const fallback = fromEnv(env)
  if (!fallback) throw new ConfigError()
  return fallback
}

let current: RuntimeConfig | null = null

export function setConfig(config: RuntimeConfig): void {
  current = config
}

export function getConfig(): RuntimeConfig {
  if (!current) throw new ConfigError()
  return current
}
