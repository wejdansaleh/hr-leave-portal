import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { ChatDock } from './ChatDock'

export function AppShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/signin', { replace: true })
  }

  const close = () => setMenuOpen(false)

  return (
    <div className="shell">
      <header className="topbar">
        <span className="logo">
          <span className="logo-mark" aria-hidden="true" /> HR Leave Portal
        </span>
        <button
          type="button"
          className="btn secondary small"
          aria-expanded={menuOpen}
          aria-controls="sidebar"
          onClick={() => setMenuOpen((v) => !v)}
          data-testid="menu-toggle"
        >
          {menuOpen ? 'Close menu' : 'Menu'}
        </button>
      </header>
      <aside id="sidebar" className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="logo">
          <span className="logo-mark" aria-hidden="true" /> HR Leave Portal
        </div>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end onClick={close} data-testid="nav-employees">
            Employees
          </NavLink>
          <NavLink to="/hr-requests" onClick={close} data-testid="nav-hr-requests">
            HR requests
          </NavLink>
        </nav>
        <div className="sidebar-user">
          <span data-testid="user-email">{user?.email}</span>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void handleSignOut()}
            data-testid="signout-button"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
      {user && <ChatDock actorId={user.sub} />}
    </div>
  )
}
