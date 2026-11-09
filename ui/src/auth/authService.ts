import { Amplify } from 'aws-amplify'
import {
  confirmSignIn,
  fetchAuthSession,
  signIn,
  signOut,
} from 'aws-amplify/auth'
import type { RuntimeConfig } from '../config/runtimeConfig'

export interface AuthUser {
  sub: string
  email: string
}

export type SignInResult = 'signed-in' | 'new-password-required'

export function configureAuth(config: RuntimeConfig): void {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
      },
    },
  })
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<SignInResult> {
  const result = await signIn({
    username: email,
    password,
    options: { authFlowType: 'USER_PASSWORD_AUTH' },
  })
  if (result.isSignedIn) return 'signed-in'
  if (
    result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED'
  ) {
    return 'new-password-required'
  }
  throw new Error('Unsupported sign-in step')
}

export async function completeNewPassword(
  newPassword: string,
): Promise<SignInResult> {
  const result = await confirmSignIn({ challengeResponse: newPassword })
  if (result.isSignedIn) return 'signed-in'
  throw new Error('Unsupported sign-in step')
}

export async function logout(): Promise<void> {
  await signOut()
}

/** Returns the signed-in user, or null when there is no valid session. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const session = await fetchAuthSession()
    const payload = session.tokens?.idToken?.payload
    const sub = session.userSub ?? (payload?.sub as string | undefined)
    if (!session.tokens?.idToken || !sub) return null
    return { sub, email: String(payload?.email ?? '') }
  } catch {
    return null
  }
}

/** Raw ID token (no "Bearer" prefix), as the API Gateway Cognito authorizer expects. */
export async function getIdToken(): Promise<string> {
  const session = await fetchAuthSession()
  const token = session.tokens?.idToken?.toString()
  if (!token) throw new Error('Not signed in')
  return token
}

export async function getAccessToken(): Promise<string> {
  const session = await fetchAuthSession()
  const token = session.tokens?.accessToken?.toString()
  if (!token) throw new Error('Not signed in')
  return token
}
