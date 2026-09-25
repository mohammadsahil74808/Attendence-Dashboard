import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CalendarClock, Users,
  Phone, MessageSquare, TrendingUp, CheckCircle2, X,
} from 'lucide-react'
import { AppLayout, PageHeader } from '../components/layout/AppLayout'
import { CardSkeleton } from '../components/ui/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import type { DashboardSummary } from '../types'

interface MetricCardProps {
  label: string
  value: number
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconColor?: string
  to?: string
  badge?: 'overdue' | 'warning' | 'good'
}

function MetricCard({ label, value, icon: Icon, iconColor = 'text-brand-400', to, badge }: MetricCardProps) {
  const navigate = useNavigate()
  const badgeColors = {
    overdue: 'text-red-400',
    warning: 'text-amber-400',
    good: 'text-emerald-400',
  }

  return (
    <div
      className="metric-card"
      onClick={() => to && navigate(to)}
      role={to ? 'button' : undefined}
      tabIndex={to ? 0 : undefined}
      onKeyDown={(e) => { if (to && (e.key === 'Enter' || e.key === ' ')) navigate(to) }}
      aria-label={`${label}: ${value}${to ? '. Click to filter contacts.' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={`metric-card-value ${badge ? badgeColors[badge] : ''}`}>
            {value.toLocaleString()}
          </div>
          <div className="metric-card-label">{label}</div>
        </div>
        <div className={`mt-0.5 ${iconColor} opacity-60 group-hover:opacity-90 transition-opacity`}>
          <Icon size={20} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()

  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/dashboard/summary').then((r) => r.data),
    refetchInterval: 60_000,
  })

  return (
    <AppLayout>
      <PageHeader
        title="Dashboard"
        subtitle={user?.role === 'admin' ? 'Team-wide overview' : 'Your assigned contacts'}
      />

      <div className="p-6 space-y-6">

        {/* ── Contact Status Overview ──────────────────────────────── */}
        <section aria-labelledby="contact-status-heading">
          <h2 id="contact-status-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Contact Status
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
            ) : (
              <>
                <MetricCard
                  label="Total Contacts"
                  value={summary?.total_contacts ?? 0}
                  icon={Users}
                  to="/contacts"
                />
                <MetricCard
                  label="Not Contacted"
                  value={summary?.not_contacted ?? 0}
                  icon={Phone}
                  iconColor="text-text-muted"
                  to="/contacts?contact_status=not_contacted"
                />
                <MetricCard
                  label="Interested"
                  value={summary?.interested ?? 0}
                  icon={TrendingUp}
                  iconColor="text-emerald-400"
                  badge="good"
                  to="/contacts?contact_status=interested"
                />
                <MetricCard
                  label="No Response"
                  value={summary?.no_response ?? 0}
                  icon={MessageSquare}
                  iconColor="text-amber-400"
                  badge="warning"
                  to="/contacts?contact_status=no_response"
                />
                <MetricCard
                  label="Follow-Up Req."
                  value={summary?.follow_up_required ?? 0}
                  icon={CalendarClock}
                  iconColor="text-orange-400"
                  badge="warning"
                  to="/contacts?contact_status=follow_up_required"
                />
                <MetricCard
                  label="Registered"
                  value={summary?.status_registered ?? 0}
                  icon={CheckCircle2}
                  iconColor="text-emerald-500"
                  badge="good"
                  to="/contacts?contact_status=registered"
                />
                <MetricCard
                  label="Closed"
                  value={summary?.closed ?? 0}
                  icon={X}
                  iconColor="text-rose-500"
                  to="/contacts?contact_status=closed"
                />
              </>
            )}
          </div>
        </section>

        {/* ── Registration Overview ───────────────────────────────── */}
        <section aria-labelledby="registration-heading">
          <h2 id="registration-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Registration
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} />)
            ) : (
              <>
                <MetricCard
                  label="Registered (Event)"
                  value={summary?.registered ?? 0}
                  icon={CheckCircle2}
                  iconColor="text-emerald-400"
                  badge="good"
                  to="/contacts?registration_status=registered"
                />
                <MetricCard
                  label="Not Registered"
                  value={summary?.not_registered ?? 0}
                  icon={Users}
                  iconColor="text-text-muted"
                  to="/contacts?registration_status=not_registered"
                />
              </>
            )}
          </div>
        </section>

        {/* ── Follow-Up Urgency ───────────────────────────────────── */}
        <section aria-labelledby="followup-heading">
          <h2 id="followup-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Follow-Up Urgency
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
            ) : (
              <>
                <MetricCard
                  label="Overdue"
                  value={summary?.overdue_follow_ups ?? 0}
                  icon={AlertTriangle}
                  iconColor="text-red-400"
                  badge={summary?.overdue_follow_ups ? 'overdue' : undefined}
                  to="/follow-ups?view=overdue"
                />
                <MetricCard
                  label="Due Today"
                  value={summary?.due_today ?? 0}
                  icon={CalendarClock}
                  iconColor="text-orange-400"
                  badge={summary?.due_today ? 'warning' : undefined}
                  to="/follow-ups?view=due_today"
                />
                <MetricCard
                  label="Completed Today"
                  value={summary?.completed_today ?? 0}
                  icon={CheckCircle2}
                  iconColor="text-brand-400"
                  badge="good"
                  to="/follow-ups?view=completed"
                />
              </>
            )}
          </div>
        </section>

      </div>
    </AppLayout>
  )
}
