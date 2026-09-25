import { useState, type ReactNode } from 'react'
import { Navigate, NavLink } from 'react-router-dom'
import {
  Menu, Activity, LayoutDashboard, Users, CalendarClock, FileBarChart
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Sidebar } from './Sidebar'
import { cn } from '../../lib/utils'

interface AppLayoutProps {
  children: ReactNode
  requireAdmin?: boolean
}

const mobileNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/follow-ups', icon: CalendarClock, label: 'Follow-Ups' },
  { to: '/reports', icon: FileBarChart, label: 'Reports' },
]

export function AppLayout({ children, requireAdmin = false }: AppLayoutProps) {
  const { user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (!user) return <Navigate to="/login" replace />
  if (requireAdmin && user.role !== 'admin') return <Navigate to="/dashboard" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar />
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-surface-1 shadow-2xl transition-transform duration-300 ease-in-out md:hidden flex flex-col",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar onClose={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Mobile Header Bar */}
        <header className="flex md:hidden items-center justify-between px-4 py-2.5 bg-surface-1 border-b border-border sticky top-0 z-20 flex-shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 -ml-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand-600 rounded flex items-center justify-center">
              <Activity size={13} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-text-primary">FMS Follow-Up</span>
          </div>

          <div className="w-7 h-7 rounded-full bg-brand-800 flex items-center justify-center text-xs font-semibold text-brand-200">
            {user?.name.charAt(0).toUpperCase()}
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0" id="main-content" tabIndex={-1}>
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav
          className="fixed bottom-0 inset-x-0 bg-surface-1/95 backdrop-blur border-t border-border z-30 md:hidden flex justify-around items-center py-1.5 px-2"
          role="navigation"
          aria-label="Quick navigation"
        >
          {mobileNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-2xs transition-colors',
                  isActive
                    ? 'text-brand-400 font-semibold'
                    : 'text-text-muted hover:text-text-secondary'
                )
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  action?: ReactNode
}

export function PageHeader({ title, subtitle, actions, action }: PageHeaderProps) {
  const actionNode = actions || action
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-surface-0 sticky top-0 z-10 gap-3">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold text-text-primary truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actionNode && (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {actionNode}
        </div>
      )}
    </div>
  )
}
