import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Upload, CalendarClock,
  FileBarChart, Settings, LogOut, UserCog,
  Activity, X, GraduationCap,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/colleges', icon: GraduationCap, label: 'Colleges' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/follow-ups', icon: CalendarClock, label: 'Follow-Ups' },
  { to: '/reports', icon: FileBarChart, label: 'Reports & Export' },
]

const adminItems = [
  { to: '/contacts/import', icon: Upload, label: 'Import Contacts' },
  { to: '/users', icon: UserCog, label: 'User Management' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps = {}) {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    onClose?.()
    logout()
    navigate('/login')
  }

  return (
    <nav
      className="w-full md:w-56 flex-shrink-0 bg-surface-1 border-r border-border flex flex-col h-full sticky top-0"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="px-4 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-brand-600 rounded flex items-center justify-center flex-shrink-0">
            <Activity size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary leading-none">FMS</p>
            <p className="text-xs text-text-muted mt-0.5 leading-none">Follow-Up System</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Primary nav */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <p className="px-3 mb-1 text-xs font-medium text-text-muted uppercase tracking-wider">
          Workspace
        </p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn('nav-item', isActive && 'active')
            }
          >
            <Icon size={15} aria-hidden="true" />
            <span className="flex-1">{label}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p className="px-3 mt-4 mb-1 text-xs font-medium text-text-muted uppercase tracking-wider">
              Admin
            </p>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn('nav-item', isActive && 'active')
                }
              >
                <Icon size={15} aria-hidden="true" />
                <span className="flex-1">{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </div>

      {/* User footer */}
      <div className="px-2 py-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-brand-800 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-brand-200">
              {user?.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">{user?.name}</p>
            <p className="text-xs text-text-muted capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="nav-item w-full mt-1 text-text-muted hover:text-red-400"
          aria-label="Log out"
        >
          <LogOut size={14} aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </nav>
  )
}
