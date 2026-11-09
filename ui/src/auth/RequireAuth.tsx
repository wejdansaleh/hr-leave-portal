import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './context'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="fullpage-status" role="status" data-testid="auth-loading">
        Loading…
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
