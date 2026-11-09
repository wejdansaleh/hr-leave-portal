import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUser = vi.fn()
const logout = vi.fn()
vi.mock('./authService', () => ({
  getCurrentUser: () => getCurrentUser(),
  signInWithPassword: vi.fn(),
  completeNewPassword: vi.fn(),
  logout: () => logout(),
}))

let unauthorizedHandler: (() => void) | null = null
vi.mock('../api/client', () => ({
  onUnauthorized: (handler: (() => void) | null) => {
    unauthorizedHandler = handler
  },
}))

import { AuthProvider } from './AuthContext'
import { useAuth } from './context'

function Probe() {
  const { user, loading, signOut } = useAuth()
  if (loading) return <p data-testid="loading">loading</p>
  return (
    <div>
      <p data-testid="who">{user ? user.email : 'signed-out'}</p>
      <button type="button" data-testid="probe-signout" onClick={() => void signOut()}>
        out
      </button>
    </div>
  )
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    getCurrentUser.mockReset()
    logout.mockReset()
    logout.mockResolvedValue(undefined)
    unauthorizedHandler = null
  })

  it('keeps an existing session signed in after a page reload', async () => {
    getCurrentUser.mockResolvedValue({ sub: 's1', email: 'ada@example.com' })
    renderProbe()

    expect(await screen.findByTestId('who')).toHaveTextContent('ada@example.com')
    expect(logout).not.toHaveBeenCalled()
  })

  it('signs out: calls logout and clears the user', async () => {
    getCurrentUser.mockResolvedValue({ sub: 's1', email: 'ada@example.com' })
    const user = userEvent.setup()
    renderProbe()
    await screen.findByText('ada@example.com')

    await user.click(screen.getByTestId('probe-signout'))

    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('signed-out'))
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('signs the user out when the API reports an expired session (401)', async () => {
    getCurrentUser.mockResolvedValue({ sub: 's1', email: 'ada@example.com' })
    renderProbe()
    await screen.findByText('ada@example.com')

    expect(unauthorizedHandler).toBeTypeOf('function')
    await act(async () => {
      unauthorizedHandler?.()
    })

    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('signed-out'))
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
