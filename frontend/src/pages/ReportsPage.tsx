import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Download, ArrowDownToLine
} from 'lucide-react'
import { AppLayout, PageHeader } from '../components/layout/AppLayout'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../contexts/ToastContext'
import api from '../lib/api'
import type { DashboardSummary, User } from '../types'
import { CONTACT_STATUS_LABELS } from '../types'

export default function ReportsPage() {
  const toast = useToast()

  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const [statusFilter, setStatusFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // Fetch summary metrics
  const { data: summary, isLoading: summaryLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary')
      return res.data
    },
  })

  // Fetch users for filter
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users/')
      return res.data
    },
  })

  async function handleExport() {
    try {
      setIsExporting(true)
      const params = new URLSearchParams()
      params.set('format', exportFormat)
      if (statusFilter) params.set('contact_status', statusFilter)
      if (assignedFilter) params.set('assigned_to_id', assignedFilter)

      const response = await api.get(`/contacts/export?${params.toString()}`, {
        responseType: 'blob',
      })

      const mimeType = exportFormat === 'csv'
        ? 'text/csv;charset=utf-8;'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const blob = new Blob([response.data], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contacts_export_${new Date().toISOString().slice(0, 10)}.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      toast.show(`Export downloaded as .${exportFormat}`, 'success')
    } catch (err) {
      toast.show('Failed to download export file', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <PageHeader
          title="Reports & Data Export"
          subtitle="Generate outreach reports, track team progress, and export filtered contact datasets"
        />

        {/* Export Data Panel */}
        <div className="panel p-4 sm:p-6 space-y-4 sm:space-y-6 border-l-4 border-emerald-500">
          <div>
            <h3 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-400" />
              Custom Contact Dataset Export
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Select filter criteria to export an audit-ready Excel or CSV spreadsheet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">File Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'xlsx' | 'csv')}
                className="input-select text-xs w-full"
              >
                <option value="xlsx">Excel Spreadsheet (.xlsx)</option>
                <option value="csv">Comma-Separated Values (.csv)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">Filter by Contact Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-select text-xs w-full"
              >
                <option value="">All Contact Statuses</option>
                {Object.entries(CONTACT_STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">Filter by Operator</label>
              <select
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                className="input-select text-xs w-full"
              >
                <option value="">All Team Members</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-2"
            >
              <ArrowDownToLine className="w-4 h-4" />
              {isExporting ? 'Generating File...' : `Download .${exportFormat.toUpperCase()}`}
            </button>
          </div>
        </div>

        {/* Operational Overview Metrics */}
        <div className="panel p-6 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
            System Operational Metrics
          </h3>

          {summaryLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : summary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-neutral-900/60 rounded border border-neutral-800">
                <span className="text-xs text-neutral-400 block">Total Pipeline</span>
                <span className="text-2xl font-bold font-mono text-neutral-100">{summary.total_contacts}</span>
                <span className="text-2xs text-neutral-500 block mt-1">Total imported contacts</span>
              </div>

              <div className="p-4 bg-neutral-900/60 rounded border border-neutral-800">
                <span className="text-xs text-emerald-400 block">Registered</span>
                <span className="text-2xl font-bold font-mono text-emerald-400">{summary.registered}</span>
                <span className="text-2xs text-neutral-500 block mt-1">
                  {summary.total_contacts > 0 ? ((summary.registered / summary.total_contacts) * 100).toFixed(1) : 0}% conversion
                </span>
              </div>

              <div className="p-4 bg-neutral-900/60 rounded border border-neutral-800">
                <span className="text-xs text-amber-400 block">Due Today</span>
                <span className="text-2xl font-bold font-mono text-amber-400">{summary.due_today}</span>
                <span className="text-2xs text-neutral-500 block mt-1">Scheduled for today</span>
              </div>

              <div className="p-4 bg-neutral-900/60 rounded border border-neutral-800">
                <span className="text-xs text-rose-400 block">Overdue Tasks</span>
                <span className="text-2xl font-bold font-mono text-rose-400">{summary.overdue_follow_ups}</span>
                <span className="text-2xs text-neutral-500 block mt-1">Requires immediate attention</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  )
}
