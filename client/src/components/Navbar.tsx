
import { Link, NavLink } from 'react-router-dom'
import type { CurrentUser } from '../types/reservation'

interface NavbarProps {
  user: CurrentUser | null
  onSignOut: () => void
}

function Navbar({ user, onSignOut }: NavbarProps) {
  return (
    <header className="navbar">
      <Link className="brand" to="/equipment" aria-label="CELD home">
        <span className="brand-icon">C</span>
        <span>CELD</span>
      </Link>

      <nav aria-label="Main navigation">
        <NavLink to="/equipment">Equipment</NavLink>

        {user?.role === 'Student' && (
          <NavLink to="/my-reservations">My Reservations</NavLink>
        )}

        {user?.role === 'Staff' && (
          <NavLink to="/staff/reservations">Staff Reservations</NavLink>
        )}
      </nav>

      <div className="session-controls">
        {user ? (
          <>
            <span className="user-label">
              {user.displayName} · {user.role}
            </span>
            <button
              className="login-button secondary-button"
              onClick={onSignOut}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link className="login-button" to="/login">
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}

export default Navbar
