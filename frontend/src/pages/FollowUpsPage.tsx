import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, Clock, CheckCircle, Phone, ArrowUpRight,
  RefreshCw, AlertTriangle
} from 'lucide-react'
import { AppLayout, PageHeader } from '../components/layout/AppLayout'
import { Modal } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { formatDate } from '../lib/utils'
import type { FollowUp } from '../types'

export default function FollowUpsPage() {
  const { isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeView = searchParams.get('view') || 'due_today'
  const setView = (v: string) => setSearchParams({ view: v })
  const toast = useToast()
  const queryClient = useQueryClient()

  const [rescheduleItem, setRescheduleItem] = useState<FollowUp | null>(null)

  // Fetch follow-ups based on active view
  const { data: followups = [], isLoading, refetch } = useQuery<FollowUp[]>({
    queryKey: ['followups-list', activeView],
    queryFn: async () => {
      const res = await api.get('/followups/', { params: { view: activeView } })
      return res.data
    },
  })

  // Mark completed mutation
  const completeMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/followups/${id}`, { status: 'completed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups-list'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      toast.show('Follow-up marked as completed', 'success')
    },
    onError: () => toast.show('Failed to complete follow-up', 'error'),
  })

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: ({ id, date, time, reason }: { id: number; date: string; time?: string; reason?: string }) =>
      api.patch(`/followups/${id}`, {
        followup_date: date,
        preferred_time: time,
        reason: reason,
        status: 'scheduled',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups-list'] })
      toast.show('Follow-up rescheduled', 'success')
      setRescheduleItem(null)
    },
    onError: () => toast.show('Failed to reschedule', 'error'),
  })

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Follow-Up Tasks"
          subtitle="Manage scheduled call-backs, reminders, and pending outreach tasks"
          action={
            <div className="flex items-center gap-2">
              {!isAdmin && (
                <span className="px-2.5 py-1 text-xs rounded-full bg-neutral-800 text-neutral-400 font-medium border border-neutral-700">
                  Viewer Mode (Read-Only)
                </span>
              )}
              <button
                onClick={() => refetch()}
                className="btn-secondary text-xs inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          }
        />

        {/* View Tabs */}
        <div className="flex border-b border-neutral-800 gap-2">
          <button
            onClick={() => setView('due_today')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeView === 'due_today'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Due Today
          </button>

          <button
            onClick={() => setView('overdue')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeView === 'overdue'
                ? 'border-rose-500 text-rose-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            Overdue
          </button>

          <button
            onClick={() => setView('upcoming')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeView === 'upcoming'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Upcoming
          </button>

          <button
            onClick={() => setView('all')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeView === 'all'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            All Scheduled
          </button>

          <button
            onClick={() => setView('completed')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeView === 'completed'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            Completed
          </button>
        </div>

        {/* Content list */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : followups.length === 0 ? (
          <div className="panel p-12 text-center space-y-3">
            <Calendar className="w-10 h-10 text-neutral-600 mx-auto" />
            <h3 className="text-sm font-semibold text-neutral-200">No follow-ups found</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              There are no tasks matching the selected filter ({activeView.replace('_', ' ')}).
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {followups.map((fu) => (
              <div
                key={fu.id}
                className={`panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 transition-all ${
                  fu.is_overdue
                    ? 'border-rose-500 bg-rose-500/5'
                    : fu.priority === 'high'
                    ? 'border-amber-500'
                    : 'border-neutral-700'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Link
                      to={`/contacts/${fu.contact_id}`}
                      className="text-sm font-bold text-neutral-100 hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5"
                    >
                      {fu.contact_name || `Contact #${fu.contact_id}`}
                      <ArrowUpRight className="w-3.5 h-3.5 text-neutral-500" />
                    </Link>

                    {fu.is_overdue && (
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        OVERDUE
                      </span>
                    )}

                    <span className={`text-2xs font-semibold px-2 py-0.5 rounded uppercase font-mono ${
                      fu.priority === 'high'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {fu.priority}
                    </span>

                    {fu.preferred_time && (
                      <span className="text-2xs text-neutral-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {fu.preferred_time}
                      </span>
                    )}

                    {fu.contact_phone && (
                      <a
                        href={`tel:${fu.contact_phone}`}
                        className="text-2xs text-emerald-400 hover:text-emerald-300 font-mono inline-flex items-center gap-1 ml-1"
                      >
                        <Phone className="w-3 h-3" />
                        {fu.contact_phone}
                      </a>
                    )}

                    {fu.contact_organization && (
                      <span className="text-2xs text-neutral-400">
                        • {fu.contact_organization}
                      </span>
                    )}
                  </div>

                  {fu.reason && (
                    <p className="text-xs text-neutral-300">
                      {fu.reason}
                    </p>
                  )}

                  <div className="text-2xs text-neutral-500 flex items-center gap-4">
                    <span>Scheduled for: <strong className="text-neutral-300 font-mono">{formatDate(fu.followup_date)}</strong></span>
                    <span>Assigned: <strong className="text-neutral-300">{fu.assigned_to?.name || 'Unassigned'}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Link
                    to={`/contacts/${fu.contact_id}`}
                    className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Open Contact
                  </Link>

                  {isAdmin && fu.status === 'scheduled' && (
                    <>
                      <button
                        onClick={() => completeMutation.mutate(fu.id)}
                        disabled={completeMutation.isPending}
                        className="btn-secondary text-xs py-1.5 px-3 text-emerald-400 hover:text-emerald-300"
                        title="Mark Done"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setRescheduleItem(fu)}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        Reschedule
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reschedule Modal */}
        <Modal
          isOpen={!!rescheduleItem}
          onClose={() => setRescheduleItem(null)}
          title="Reschedule Follow-Up"
        >
          {rescheduleItem && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const dt = fd.get('followup_date') as string
                rescheduleMutation.mutate({
                  id: rescheduleItem.id,
                  date: new Date(dt).toISOString(),
                  time: (fd.get('preferred_time') as string) || undefined,
                  reason: (fd.get('reason') as string) || undefined,
                })
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="text-neutral-300 block mb-1 font-medium">New Date & Time</label>
                <input
                  type="datetime-local"
                  name="followup_date"
                  required
                  className="input-text w-full"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Preferred Time Window</label>
                <input
                  type="text"
                  name="preferred_time"
                  defaultValue={rescheduleItem.preferred_time || ''}
                  className="input-text w-full"
                  placeholder="e.g. Morning, 10-12 AM"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Updated Reason / Notes</label>
                <textarea
                  name="reason"
                  rows={3}
                  defaultValue={rescheduleItem.reason || ''}
                  className="input-text w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setRescheduleItem(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={rescheduleMutation.isPending} className="btn-primary">
                  {rescheduleMutation.isPending ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      </div>
    </AppLayout>
  )
}
