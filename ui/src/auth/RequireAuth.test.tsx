import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUser = vi.fn()
vi.mock('./authService', () => ({
  getCurrentUser: () => getCurrentUser(),
  signInWithPassword: vi.fn(),
  completeNewPassword: vi.fn(),
  logout: vi.fn(),
}))

import { AuthProvider } from './AuthContext'
import { RequireAuth } from './RequireAuth'

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/signin" element={<div data-testid="signin-screen">Sign in</div>} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<div data-testid="private-screen">Private</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('RequireAuth', () => {
  beforeEach(() => getCurrentUser.mockReset())

  it('sends a signed-out visitor to the sign-in page', async () => {
    getCurrentUser.mockResolvedValue(null)
    renderAt('/')

    expect(await screen.findByTestId('signin-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('private-screen')).not.toBeInTheDocument()
  })

  it('renders the protected screen for a signed-in user', async () => {
    getCurrentUser.mockResolvedValue({ sub: 's1', email: 'a@b.com' })
    renderAt('/')

    expect(await screen.findByTestId('private-screen')).toBeInTheDocument()
  })
})
