
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import type { CurrentUser } from '../types/reservation'

interface LayoutProps {
  user: CurrentUser | null
  onSignOut: () => void
}

function Layout({ user, onSignOut }: LayoutProps) {
  return (
    <div className="app">
      <Navbar user={user} onSignOut={onSignOut} />

      <main>
        <Outlet />
      </main>

      <footer>
        <p>CELD · Campus Equipment Lending Desk</p>
      </footer>
    </div>
  )
}

export default Layout
