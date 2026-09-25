import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  MessageSquare, ArrowUpRight, Search, Clock
} from 'lucide-react'
import { AppLayout, PageHeader } from '../components/layout/AppLayout'
import { Skeleton } from '../components/ui/Skeleton'
import api from '../lib/api'
import { formatDate } from '../lib/utils'

export default function FeedbackPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // We fetch contacts with feedback status or we query contacts list
  const { data, isLoading } = useQuery({
    queryKey: ['contacts-feedback-list', search, categoryFilter],
    queryFn: async () => {
      const res = await api.get('/contacts/', {
        params: {
          search: search || undefined,
          page_size: 100,
        },
      })
      return res.data
    },
  })

  const contactsWithFeedback = (data?.items || []).filter(
    (c: any) => c.feedback_status && c.feedback_status !== 'no_feedback_yet'
  )

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Outreach Feedback Tracker"
          subtitle="Consolidated view of customer responses, objections, and feedback notes"
        />

        {/* Filter bar */}
        <div className="flex items-center gap-3 panel p-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search contact name, org..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-text text-xs pl-9 w-full"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input-select text-xs max-w-xs"
          >
            <option value="all">All Feedback Statuses</option>
            <option value="feedback_received">Feedback Received</option>
            <option value="feedback_received_followup_pending">Follow-Up Pending</option>
          </select>
        </div>

        {/* List of Contacts with feedback */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : contactsWithFeedback.length === 0 ? (
          <div className="panel p-12 text-center space-y-3">
            <MessageSquare className="w-10 h-10 text-neutral-600 mx-auto" />
            <h3 className="text-sm font-semibold text-neutral-200">No feedback entries found</h3>
            <p className="text-xs text-neutral-400">
              When operators record feedback during calls, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {contactsWithFeedback.map((c: any) => (
              <div
                key={c.id}
                className="panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 border-indigo-500"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/contacts/${c.id}`}
                      className="text-sm font-bold text-neutral-100 hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5"
                    >
                      {c.name}
                      <ArrowUpRight className="w-3.5 h-3.5 text-neutral-500" />
                    </Link>
                    <span className="text-xs text-neutral-400 font-mono">
                      {c.organization}
                    </span>
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                      {c.feedback_status === 'feedback_received_followup_pending'
                        ? 'Follow-Up Pending'
                        : 'Feedback Received'}
                    </span>
                  </div>

                  <div className="text-2xs text-neutral-500 flex items-center gap-4">
                    <span>Assigned to: <strong className="text-neutral-300">{c.assigned_to_name || 'Unassigned'}</strong></span>
                    {c.next_followup_date && (
                      <span className="flex items-center gap-1 text-amber-400">
                        <Clock className="w-3 h-3" />
                        Next Follow-Up: {formatDate(c.next_followup_date)}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <Link
                    to={`/contacts/${c.id}`}
                    className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    View Details & Feedback
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
