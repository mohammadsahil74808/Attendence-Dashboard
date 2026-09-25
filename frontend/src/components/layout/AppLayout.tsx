import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  children: ReactNode
  requireAdmin?: boolean
}

export function AppLayout({ children, requireAdmin = false }: AppLayoutProps) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (requireAdmin && user.role !== 'admin') return <Navigate to="/dashboard" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" id="main-content" tabIndex={-1}>
        {children}
      </main>
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
    <div className="flex items-start justify-between px-6 py-4 border-b border-border bg-surface-0 sticky top-0 z-10">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actionNode && <div className="flex items-center gap-2">{actionNode}</div>}
    </div>
  )
}
