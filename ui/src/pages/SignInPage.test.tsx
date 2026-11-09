import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const signInWithPassword = vi.fn()
const completeNewPassword = vi.fn()
const getCurrentUser = vi.fn()
vi.mock('../auth/authService', () => ({
  signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
  completeNewPassword: (...a: unknown[]) => completeNewPassword(...a),
  getCurrentUser: () => getCurrentUser(),
  logout: vi.fn(),
}))

import { AuthProvider } from '../auth/AuthContext'
import SignInPage from './SignInPage'

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/signin']}>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/" element={<div data-testid="home">Home</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('SignInPage', () => {
  beforeEach(() => {
    signInWithPassword.mockReset()
    completeNewPassword.mockReset()
    getCurrentUser.mockReset()
    getCurrentUser.mockResolvedValue(null)
  })

  it('labels the field "Email" and shows one generic message on a failed sign-in', async () => {
    signInWithPassword.mockRejectedValue(Object.assign(new Error('User does not exist'), { name: 'UserNotFoundException' }))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    await user.type(screen.getByTestId('signin-email'), 'nobody@example.com')
    await user.type(screen.getByTestId('signin-password'), 'wrong-password')
    await user.click(screen.getByTestId('signin-submit'))

    const error = await screen.findByTestId('signin-error')
    expect(error).toHaveTextContent('Sign-in failed. Check your email and password and try again.')
    expect(error).not.toHaveTextContent(/exist/i)
  })

  it('completes sign-in through the new-password step', async () => {
    signInWithPassword.mockResolvedValue('new-password-required')
    completeNewPassword.mockImplementation(async () => {
      getCurrentUser.mockResolvedValue({ sub: 's1', email: 'a@b.com' })
      return 'signed-in'
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByTestId('signin-email'), 'a@b.com')
    await user.type(screen.getByTestId('signin-password'), 'Temp#1234')
    await user.click(screen.getByTestId('signin-submit'))

    const newPassword = await screen.findByTestId('signin-new-password')
    await user.type(newPassword, 'Brand#New5678')
    await user.click(screen.getByTestId('signin-submit'))

    await waitFor(() => expect(screen.getByTestId('home')).toBeInTheDocument())
    expect(signInWithPassword).toHaveBeenCalledWith('a@b.com', 'Temp#1234')
    expect(completeNewPassword).toHaveBeenCalledWith('Brand#New5678')
  })
})
