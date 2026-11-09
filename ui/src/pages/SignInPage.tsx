import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'

const GENERIC_ERROR = 'Sign-in failed. Check your email and password and try again.'

export default function SignInPage() {
  const { user, loading, signIn, confirmNewPassword } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'credentials' | 'new-password'>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (step === 'credentials' && (!email.trim() || !password)) {
      setError('Enter your email and password.')
      return
    }
    if (step === 'new-password' && !newPassword) {
      setError('Enter a new password.')
      return
    }
    setBusy(true)
    try {
      if (step === 'credentials') {
        const result = await signIn(email.trim(), password)
        if (result === 'new-password-required') setStep('new-password')
        else navigate('/', { replace: true })
      } else {
        await confirmNewPassword(newPassword)
        navigate('/', { replace: true })
      }
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="signin">
      <form className="card" onSubmit={(e) => void onSubmit(e)} noValidate data-testid="signin-form">
        <div className="logo">
          <span className="logo-mark" aria-hidden="true" /> HR Leave Portal
        </div>
        <h1>{step === 'credentials' ? 'Sign in' : 'Set a new password'}</h1>
        <div className="form">
          {step === 'credentials' ? (
            <>
              <label className="field">
                Email
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="signin-email"
                />
              </label>
              <label className="field">
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="signin-password"
                />
              </label>
            </>
          ) : (
            <>
              <p className="muted">Your account requires a new password before you continue.</p>
              <label className="field">
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="signin-new-password"
                />
              </label>
            </>
          )}
        </div>
        {error && (
          <p className="error" role="alert" data-testid="signin-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn" disabled={busy} data-testid="signin-submit">
          {busy ? 'Please wait…' : step === 'credentials' ? 'Sign in' : 'Set password and sign in'}
        </button>
      </form>
    </main>
  )
}
