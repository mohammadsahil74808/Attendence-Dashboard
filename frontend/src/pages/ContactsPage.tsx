import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  Search, X, Download, ChevronUp, ChevronDown,
  ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Upload,
  CheckSquare, Square, Trash2, Plus, RotateCcw, Trash, GraduationCap,
} from 'lucide-react'
import { AppLayout, PageHeader } from '../components/layout/AppLayout'
import { ContactStatusBadge, RegistrationBadge, FollowUpBadge } from '../components/ui/StatusBadges'
import { TableSkeleton } from '../components/ui/Skeleton'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import api from '../lib/api'
import { timeAgo } from '../lib/utils'
import type { ContactListItem, ContactFilters, ContactStatus, RegistrationStatus, College, User } from '../types'
import { CONTACT_STATUS_LABELS, REGISTRATION_STATUS_LABELS } from '../types'
import { SearchableMemberSelect } from '../components/ui/SearchableMemberSelect'

const PAGE_SIZE = 50

export default function ContactsPage() {
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Derive filters from URL (shareable state)
  const filters: ContactFilters = {
    search: searchParams.get('search') || undefined,
    contact_status: (searchParams.get('contact_status') as ContactStatus) || undefined,
    registration_status: (searchParams.get('registration_status') as RegistrationStatus) || undefined,
    assigned_to_id: searchParams.get('assigned_to_id') ? Number(searchParams.get('assigned_to_id')) : undefined,
    college_id: searchParams.get('college_id') ? Number(searchParams.get('college_id')) : undefined,
    organization: searchParams.get('organization') || undefined,
    overdue_only: searchParams.get('overdue_only') === 'true',
    page: Number(searchParams.get('page') || '1'),
    page_size: PAGE_SIZE,
    sort_by: searchParams.get('sort_by') || 'created_at',
    sort_order: (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc',
  }

  const [showTrash, setShowTrash] = useState(false)
  const [contactToDelete, setContactToDelete] = useState<{ id: number; name: string; permanent: boolean } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [bulkAction, setBulkAction] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createStatus, setCreateStatus] = useState('not_contacted')
  const [showExportMenu, setShowExportMenu] = useState(false)

  // College & user prefill states
  const [selectedCollegeId, setSelectedCollegeId] = useState<number | null>(null)
  const [selectedOrgName, setSelectedOrgName] = useState<string>('')
  const [cityVal, setCityVal] = useState<string>('')
  const [isCustomOrg, setIsCustomOrg] = useState(false)
  const [createAssignedToId, setCreateAssignedToId] = useState<number | null>(user?.id ?? null)

  // Fetch all colleges for dropdown
  const { data: colleges = [] } = useQuery<College[]>({
    queryKey: ['colleges-all'],
    queryFn: async () => {
      const res = await api.get('/colleges/all')
      return res.data
    },
  })

  // Fetch all users for assignment selection
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('/users/')
      return res.data
    },
  })

  // Auto-open modal if navigated from Colleges with ?add=true
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setCreateModalOpen(true)
      if (searchParams.get('college_id')) {
        const cid = Number(searchParams.get('college_id'))
        setSelectedCollegeId(cid)
      }
      if (searchParams.get('college_name')) {
        setSelectedOrgName(searchParams.get('college_name') || '')
      }
    }
  }, [searchParams])

  const createContactMutation = useMutation({
    mutationFn: (data: any) => api.post('/contacts/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
      queryClient.invalidateQueries({ queryKey: ['colleges-all'] })
      queryClient.invalidateQueries({ queryKey: ['followups-list'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      toast.show('Contact created successfully', 'success')
      setCreateModalOpen(false)
      setCreateStatus('not_contacted')
      setSelectedCollegeId(null)
      setSelectedOrgName('')
      setCityVal('')
      setIsCustomOrg(false)
      setCreateAssignedToId(user?.id ?? null)
    },
    onError: (err: any) => {
      toast.show(err.response?.data?.detail || 'Failed to create contact', 'error')
    },
  })

  function setFilter(key: string, val: string | undefined) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (val) next.set(key, val)
      else next.delete(key)
      next.set('page', '1')  // reset pagination on filter change
      return next
    })
  }

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', filters, showTrash],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.contact_status) params.set('contact_status', filters.contact_status)
      if (filters.registration_status) params.set('registration_status', filters.registration_status)
      if (filters.assigned_to_id) params.set('assigned_to_id', String(filters.assigned_to_id))
      if (filters.college_id) params.set('college_id', String(filters.college_id))
      if (filters.organization) params.set('organization', filters.organization)
      if (filters.overdue_only) params.set('overdue_only', 'true')
      if (showTrash) params.set('is_archived', 'true')
      params.set('page', String(filters.page))
      params.set('page_size', String(PAGE_SIZE))
      params.set('sort_by', filters.sort_by || 'created_at')
      params.set('sort_order', filters.sort_order || 'desc')
      return api.get(`/contacts?${params}`).then((r) => r.data)
    },
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, permanent }: { id: number; permanent?: boolean }) =>
      api.delete(`/contacts/${id}${permanent ? '?permanent=true' : ''}`),
    onSuccess: (_, vars) => {
      toast(vars.permanent ? 'Contact permanently deleted from database' : 'Contact moved to Trash', 'success')
      setContactToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
    onError: () => toast('Failed to delete contact', 'error'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.post(`/contacts/${id}/restore`),
    onSuccess: () => {
      toast('Contact restored to active list', 'success')
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
    onError: () => toast('Failed to restore contact', 'error'),
  })

  const bulkMutation = useMutation({
    mutationFn: (payload: { action: string; contact_ids: number[]; value?: string }) =>
      api.post('/contacts/bulk', payload),
    onSuccess: (_, vars) => {
      const msg =
        vars.action === 'archive' ? `${vars.contact_ids.length} contacts moved to Trash`
        : vars.action === 'restore' ? `${vars.contact_ids.length} contacts restored to active list`
        : vars.action === 'delete_permanent' ? `${vars.contact_ids.length} contacts permanently deleted from database`
        : `${vars.contact_ids.length} contacts updated`
      toast(msg, 'success')
      setSelectedIds(new Set())
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
    onError: () => toast('Bulk action failed', 'error'),
  })

  async function handleExport(exportFormat: 'xlsx' | 'csv' = 'xlsx') {
    setShowExportMenu(false)
    try {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.contact_status) params.set('contact_status', filters.contact_status)
      params.set('format', exportFormat)

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
      toast(`Export (.${exportFormat.toUpperCase()}) downloaded successfully`, 'success')
    } catch (err) {
      toast('Failed to download export', 'error')
    }
  }

  // TanStack Table setup
  const sorting: SortingState = [{ id: filters.sort_by!, desc: filters.sort_order === 'desc' }]

  const baseColumns: ColumnDef<ContactListItem>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-text-primary text-sm">{row.original.name}</p>
          {row.original.organization && (
            <p className="text-xs text-text-muted">{row.original.organization}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-text-secondary">{row.original.phone || '—'}</span>
      ),
    },
    {
      accessorKey: 'contact_status',
      header: 'Contact Status',
      cell: ({ row }) => <ContactStatusBadge status={row.original.contact_status} />,
    },
    {
      accessorKey: 'registration_status',
      header: 'Registration',
      cell: ({ row }) => <RegistrationBadge status={row.original.registration_status} />,
    },
    {
      accessorKey: 'next_followup_date',
      header: 'Next Follow-Up',
      cell: ({ row }) => (
        <FollowUpBadge date={row.original.next_followup_date} />
      ),
    },
    {
      accessorKey: 'last_attempt_date',
      header: 'Last Attempt',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-text-muted">{timeAgo(row.original.last_attempt_date)}</span>
      ),
    },
    {
      accessorKey: 'assigned_to_name',
      header: 'Assigned To',
      cell: ({ row }) => (
        <span className="text-xs text-text-secondary inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          {row.original.assigned_to_name || <span className="text-neutral-500 italic">Unassigned</span>}
        </span>
      ),
    },
    ...(isAdmin ? [{
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: { row: { original: ContactListItem } }) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {!showTrash ? (
            <button
              onClick={() => setContactToDelete({ id: row.original.id, name: row.original.name, permanent: false })}
              className="p-1.5 rounded hover:bg-surface-2 text-text-muted hover:text-rose-400 transition-colors"
              title="Move to Trash"
              aria-label={`Delete ${row.original.name}`}
            >
              <Trash2 size={14} />
            </button>
          ) : (
            <>
              <button
                onClick={() => restoreMutation.mutate(row.original.id)}
                disabled={restoreMutation.isPending}
                className="p-1.5 rounded hover:bg-surface-2 text-text-muted hover:text-emerald-400 transition-colors"
                title="Restore to Active"
                aria-label={`Restore ${row.original.name}`}
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => setContactToDelete({ id: row.original.id, name: row.original.name, permanent: true })}
                className="p-1.5 rounded hover:bg-surface-2 text-text-muted hover:text-rose-500 transition-colors"
                title="Delete Permanently from Database (Free Space)"
                aria-label={`Permanently Delete ${row.original.name}`}
              >
                <Trash size={14} />
              </button>
            </>
          )}
        </div>
      ),
      size: 90,
    }] : []),
  ]

  const columns: ColumnDef<ContactListItem>[] = isAdmin
    ? [
        {
          id: 'select',
          header: () => (
            <button
              onClick={() =>
                setSelectedIds(
                  selectedIds.size === data?.items.length
                    ? new Set()
                    : new Set(data?.items.map((c: ContactListItem) => c.id) ?? [])
                )
              }
              className="btn-ghost btn-icon btn-sm"
              aria-label={selectedIds.size === data?.items.length ? 'Deselect all' : 'Select all'}
            >
              {selectedIds.size === data?.items.length && data?.items.length > 0 ? (
                <CheckSquare size={14} />
              ) : (
                <Square size={14} />
              )}
            </button>
          ),
          cell: ({ row }) => (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedIds((prev) => {
                  const next = new Set(prev)
                  next.has(row.original.id) ? next.delete(row.original.id) : next.add(row.original.id)
                  return next
                })
              }}
              className="btn-ghost btn-icon btn-sm"
              aria-label={`${selectedIds.has(row.original.id) ? 'Deselect' : 'Select'} ${row.original.name}`}
              aria-pressed={selectedIds.has(row.original.id)}
            >
              {selectedIds.has(row.original.id) ? <CheckSquare size={14} /> : <Square size={14} />}
            </button>
          ),
          size: 40,
        },
        ...baseColumns,
      ]
    : baseColumns

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: data?.total_pages ?? -1,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      if (next.length > 0) {
        setFilter('sort_by', next[0].id)
        setFilter('sort_order', next[0].desc ? 'desc' : 'asc')
      }
    },
  })

  const activeFilterCount = [
    filters.search,
    filters.contact_status,
    filters.registration_status,
    filters.overdue_only,
  ].filter(Boolean).length

  return (
    <AppLayout>
      {/* Page Header */}
      <PageHeader
        title="Contacts"
        subtitle={data ? `${data.total.toLocaleString()} contacts` : undefined}
        actions={
          <>
            {isAdmin && (
              <button
                className="btn-secondary btn-sm"
                onClick={() => navigate('/contacts/import')}
              >
                <Upload size={14} />
                Import
              </button>
            )}
            <button className="btn-primary btn-sm" onClick={() => setCreateModalOpen(true)}>
              <Plus size={14} />
              Add Contact
            </button>
            <div className="relative">
              <button
                className="btn-secondary btn-sm flex items-center gap-1.5"
                onClick={() => setShowExportMenu((v) => !v)}
                title="Export contacts"
              >
                <Download size={14} />
                <span>Export</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>
              {showExportMenu && (
                <div
                  className="absolute right-0 mt-1 w-36 bg-surface-1 border border-border rounded-lg shadow-2xl z-50 py-1"
                  onMouseLeave={() => setShowExportMenu(false)}
                >
                  <button
                    className="w-full text-left px-3 py-2 text-xs hover:bg-surface-2 text-text-primary flex items-center gap-2"
                    onClick={() => handleExport('xlsx')}
                  >
                    <span className="font-semibold text-emerald-400">Excel</span> (.xlsx)
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-xs hover:bg-surface-2 text-text-primary flex items-center gap-2"
                    onClick={() => handleExport('csv')}
                  >
                    <span className="font-semibold text-blue-400">CSV</span> (.csv)
                  </button>
                </div>
              )}
            </div>
            {isAdmin && (
              <button
                className={`btn-sm flex items-center gap-1.5 transition-colors ${
                  showTrash
                    ? 'bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-md'
                    : 'btn-secondary text-neutral-300 hover:text-neutral-100'
                }`}
                onClick={() => {
                  setShowTrash((v) => !v)
                  setSelectedIds(new Set())
                }}
                title={showTrash ? 'Switch to Active Contacts' : 'View Trash / Deleted Contacts'}
              >
                <Trash2 size={14} className={showTrash ? 'text-white' : 'text-rose-400'} />
                <span>{showTrash ? 'Active Contacts' : 'Trash'}</span>
              </button>
            )}
          </>
        }
      />

      {/* ── Trash Mode Banner ────────────────────────────────────────── */}
      {showTrash && (
        <div className="px-6 py-2.5 bg-rose-950/40 border-b border-rose-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-rose-300 text-xs sm:text-sm font-medium">
            <Trash2 size={16} className="text-rose-400 flex-shrink-0" />
            <span>Trash View — Yahan deleted contacts hain. Aap inhe Restore kar sakte hain ya database se permanently delete karke space free kar sakte hain.</span>
          </div>
          <button
            onClick={() => { setShowTrash(false); setSelectedIds(new Set()) }}
            className="text-xs text-rose-300 hover:text-white underline font-medium whitespace-nowrap self-start sm:self-auto"
          >
            ← Back to Active Contacts
          </button>
        </div>
      )}

      {/* ── Filter Bar ───────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-3 border-b border-border bg-surface-0 flex flex-col sm:flex-row flex-wrap sm:items-center gap-2.5">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            type="search"
            placeholder="Search name, phone, email…"
            value={filters.search || ''}
            onChange={(e) => setFilter('search', e.target.value || undefined)}
            className="input pl-9 h-8 text-sm w-full"
            aria-label="Search contacts"
          />
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Contact Status filter */}
          <select
            value={filters.contact_status || ''}
            onChange={(e) => setFilter('contact_status', e.target.value || undefined)}
            className="select h-8 text-sm flex-1 sm:w-40 sm:flex-none"
            aria-label="Filter by contact status"
          >
            <option value="">All statuses</option>
            {Object.entries(CONTACT_STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          {/* Registration Status filter */}
          <select
            value={filters.registration_status || ''}
            onChange={(e) => setFilter('registration_status', e.target.value || undefined)}
            className="select h-8 text-sm flex-1 sm:w-40 sm:flex-none"
            aria-label="Filter by registration status"
          >
            <option value="">All registrations</option>
            {Object.entries(REGISTRATION_STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          {/* College filter */}
          <select
            value={filters.college_id ? String(filters.college_id) : (filters.organization || '')}
            onChange={(e) => {
              const val = e.target.value
              if (!val) {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.delete('college_id')
                  next.delete('organization')
                  next.set('page', '1')
                  return next
                })
              } else if (!isNaN(Number(val))) {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.set('college_id', val)
                  next.delete('organization')
                  next.set('page', '1')
                  return next
                })
              } else {
                setFilter('organization', val)
              }
            }}
            className="select h-8 text-sm flex-1 sm:w-44 sm:flex-none"
            aria-label="Filter by College"
          >
            <option value="">All Colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.is_registered ? '★' : ''}
              </option>
            ))}
          </select>

          {/* Overdue toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none px-2 py-1 bg-surface-1 sm:bg-transparent rounded">
            <input
              type="checkbox"
              checked={filters.overdue_only || false}
              onChange={(e) => setFilter('overdue_only', e.target.checked ? 'true' : undefined)}
              className="w-3.5 h-3.5 accent-brand-500"
              aria-label="Show overdue follow-ups only"
            />
            <span className="text-xs sm:text-sm text-text-secondary whitespace-nowrap">Overdue only</span>
          </label>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              className="btn-ghost btn-sm text-red-400 hover:text-red-300"
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              <X size={13} />
              Clear ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Bulk Action Bar ───────────────────────────────────────── */}
      {isAdmin && selectedIds.size > 0 && (
        <div
          className={`px-6 py-2 border-b flex items-center gap-3 ${
            showTrash ? 'bg-rose-950/40 border-rose-800/40' : 'bg-brand-900/30 border-brand-700/40'
          }`}
          role="status"
          aria-live="polite"
        >
          <span className={`text-sm font-medium ${showTrash ? 'text-rose-300' : 'text-brand-300'}`}>
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {!showTrash ? (
              <>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => { setBulkAction('mark_not_interested'); setShowBulkConfirm(true) }}
                >
                  Mark Not Interested
                </button>
                <button
                  className="btn-danger btn-sm flex items-center gap-1.5"
                  onClick={() => { setBulkAction('archive'); setShowBulkConfirm(true) }}
                >
                  <Trash2 size={13} />
                  Move to Trash
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-secondary btn-sm flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 border-emerald-500/30"
                  onClick={() => { setBulkAction('restore'); setShowBulkConfirm(true) }}
                >
                  <RotateCcw size={13} />
                  Restore Selected
                </button>
                <button
                  className="btn-danger btn-sm flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white"
                  onClick={() => { setBulkAction('delete_permanent'); setShowBulkConfirm(true) }}
                >
                  <Trash size={13} />
                  Delete Forever (From Database)
                </button>
              </>
            )}
            <button
              className="btn-ghost btn-sm"
              onClick={() => setSelectedIds(new Set())}
              aria-label="Clear selection"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="overflow-x-auto w-full">
        <table className="fms-table min-w-[650px]" aria-label="Contacts list">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sortDir = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      className={canSort ? 'sortable' : ''}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      aria-sort={
                        sortDir === 'asc' ? 'ascending'
                        : sortDir === 'desc' ? 'descending'
                        : undefined
                      }
                      style={{ width: header.column.getSize() }}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && sortDir === 'asc' && <ChevronUp size={12} aria-hidden />}
                        {canSort && sortDir === 'desc' && <ChevronDown size={12} aria-hidden />}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          {isLoading ? (
            <TableSkeleton rows={10} cols={columns.length} />
          ) : (
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-16 text-text-muted">
                    No contacts found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/contacts/${row.original.id}`)}
                    className={selectedIds.has(row.original.id) ? 'bg-brand-900/20' : ''}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          )}
        </table>
      </div>

      {/* ── Pagination ───────────────────────────────────────────── */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border">
          <p className="text-xs text-text-muted">
            Page {data.page} of {data.total_pages} — {data.total.toLocaleString()} total
          </p>
          <div className="flex items-center gap-1">
            <button
              className="btn-ghost btn-icon btn-sm"
              disabled={data.page <= 1}
              onClick={() => setFilter('page', '1')}
              aria-label="First page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              className="btn-ghost btn-icon btn-sm"
              disabled={data.page <= 1}
              onClick={() => setFilter('page', String(data.page - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 text-sm text-text-secondary font-mono">{data.page}</span>
            <button
              className="btn-ghost btn-icon btn-sm"
              disabled={data.page >= data.total_pages}
              onClick={() => setFilter('page', String(data.page + 1))}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              className="btn-ghost btn-icon btn-sm"
              disabled={data.page >= data.total_pages}
              onClick={() => setFilter('page', String(data.total_pages))}
              aria-label="Last page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bulk confirm dialog */}
      <ConfirmDialog
        isOpen={showBulkConfirm}
        onClose={() => setShowBulkConfirm(false)}
        onConfirm={() => {
          if (!bulkAction) return
          bulkMutation.mutate({
            action: bulkAction,
            contact_ids: Array.from(selectedIds),
            value: bulkAction === 'mark_not_interested' ? 'not_interested' : undefined,
          })
        }}
        title={
          bulkAction === 'archive' ? 'Move to Trash'
          : bulkAction === 'restore' ? 'Restore Contacts'
          : bulkAction === 'delete_permanent' ? 'Permanently Delete From Database?'
          : 'Mark as Not Interested'
        }
        message={
          bulkAction === 'archive'
            ? `Move ${selectedIds.size} selected contact(s) to Trash? You can restore them anytime.`
            : bulkAction === 'restore'
            ? `Restore ${selectedIds.size} selected contact(s) back to the active list?`
            : bulkAction === 'delete_permanent'
            ? `⚠️ DANGER: Permanently delete ${selectedIds.size} selected contact(s) from Supabase? This will free up database space and CANNOT be recovered.`
            : `Are you sure you want to mark ${selectedIds.size} contact(s) as Not Interested?`
        }
        confirmLabel={
          bulkAction === 'delete_permanent' ? 'Delete Forever'
          : bulkAction === 'restore' ? 'Restore'
          : bulkAction === 'archive' ? 'Move to Trash'
          : 'Confirm'
        }
        isDanger={bulkAction === 'archive' || bulkAction === 'delete_permanent'}
      />

      {/* Single contact delete / permanent delete dialog */}
      <ConfirmDialog
        isOpen={!!contactToDelete}
        onClose={() => setContactToDelete(null)}
        onConfirm={() => {
          if (contactToDelete) {
            deleteMutation.mutate({ id: contactToDelete.id, permanent: contactToDelete.permanent })
          }
        }}
        title={contactToDelete?.permanent ? 'Permanently Delete from Database?' : 'Move to Trash'}
        message={
          contactToDelete?.permanent
            ? `Are you sure you want to permanently delete "${contactToDelete?.name}" from Supabase? This will free up database space and cannot be undone.`
            : `Move "${contactToDelete?.name}" to Trash? You can view or restore it anytime from the Trash tab.`
        }
        confirmLabel={contactToDelete?.permanent ? 'Delete Forever' : 'Move to Trash'}
        isDanger={true}
      />

      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Contact"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const phone = ((fd.get('phone') as string) || '').trim()
            const email = ((fd.get('email') as string) || '').trim()
            if (!phone && !email) {
              toast.show('Please provide at least a Phone number or an Email', 'error')
              return
            }
            const st = (fd.get('contact_status') as string) || 'not_contacted'
            const fuDateRaw = fd.get('followup_date') as string
            const followup_date = fuDateRaw ? new Date(fuDateRaw).toISOString() : (st === 'follow_up_required' ? new Date().toISOString() : null)
            const assignedId = isAdmin
              ? (createAssignedToId ?? (fd.get('assigned_to_id') ? Number(fd.get('assigned_to_id')) : null))
              : user?.id
            
            const orgValue = isCustomOrg 
              ? ((fd.get('organization') as string) || '').trim() || null
              : selectedOrgName || null

            createContactMutation.mutate({
              name: fd.get('name') as string,
              organization: orgValue,
              college_id: !isCustomOrg ? (selectedCollegeId || null) : null,
              designation: (fd.get('designation') as string) || null,
              phone: phone || null,
              whatsapp: (fd.get('whatsapp') as string) || null,
              email: email || null,
              city: cityVal || null,
              notes: (fd.get('notes') as string) || null,
              assigned_to_id: assignedId,
              contact_status: st,
              followup_date,
              preferred_time: (fd.get('preferred_time') as string) || null,
              followup_reason: (fd.get('followup_reason') as string) || null,
            })
          }}
          className="space-y-3.5 text-xs"
        >
          {/* Full Name */}
          <div>
            <label className="text-neutral-300 block mb-1 font-medium">Full Name <span className="text-rose-500">*</span></label>
            <input type="text" name="name" required className="input-text w-full" placeholder="e.g. Rahul Sharma" />
          </div>

          {/* Phone & WhatsApp */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Phone Number</label>
              <input type="text" name="phone" className="input-text w-full font-mono" placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">WhatsApp Number</label>
              <input type="text" name="whatsapp" className="input-text w-full font-mono" placeholder="+91 98765 43210" />
            </div>
          </div>

          {/* Email & Designation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Email Address</label>
              <input type="email" name="email" className="input-text w-full font-mono" placeholder="rahul@example.com" />
            </div>
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Designation / Role</label>
              <input type="text" name="designation" placeholder="e.g. Student, Professor, TPO" className="input-text w-full" />
            </div>
          </div>
          <p className="text-neutral-500 text-2xs italic -mt-2">Note: At least one of phone or email is required.</p>

          {/* College / Institution Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-neutral-300 font-medium flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                <span>College / Institution</span>
              </label>
              <div className="flex items-center gap-2 text-2xs">
                {isCustomOrg ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomOrg(false)
                      setSelectedOrgName('')
                    }}
                    className="text-indigo-400 hover:text-indigo-300 underline font-medium"
                  >
                    ← Select from Colleges list
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomOrg(true)
                      setSelectedCollegeId(null)
                      setSelectedOrgName('')
                    }}
                    className="text-neutral-400 hover:text-neutral-200 underline font-medium"
                  >
                    + Enter custom name
                  </button>
                )}
                <span className="text-neutral-700">|</span>
                <Link
                  to="/colleges"
                  target="_blank"
                  className="text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  + Add New College
                </Link>
              </div>
            </div>

            {isCustomOrg ? (
              <input
                type="text"
                name="organization"
                value={selectedOrgName}
                onChange={(e) => setSelectedOrgName(e.target.value)}
                placeholder="Enter custom College or Organization name..."
                className="input-text w-full"
                autoFocus
              />
            ) : (
              <div className="space-y-1.5">
                <select
                  className="input-select w-full"
                  value={selectedCollegeId || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '__custom__') {
                      setIsCustomOrg(true)
                      setSelectedCollegeId(null)
                      setSelectedOrgName('')
                      return
                    }
                    const id = val ? Number(val) : null
                    setSelectedCollegeId(id)
                    const found = colleges.find((c) => c.id === id)
                    if (found) {
                      setSelectedOrgName(found.name)
                      if (found.city) setCityVal(found.city)
                    } else {
                      setSelectedOrgName('')
                    }
                  }}
                >
                  <option value="">-- Choose from Colleges list --</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.city ? `(${c.city})` : ''} {c.is_registered ? '★ Registered' : ''}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter custom College / Organization name...</option>
                </select>

                {selectedCollegeId && (
                  <div className="flex items-center justify-between text-2xs px-2.5 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Linked College: <strong className="text-neutral-100">{selectedOrgName}</strong>
                      {cityVal && <span className="text-neutral-400">({cityVal})</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCollegeId(null)
                        setSelectedOrgName('')
                      }}
                      className="text-neutral-400 hover:text-neutral-200 underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Auto-populated City from selected College */}
          <input type="hidden" name="city" value={cityVal} />

          {/* Assigned To Member & Initial Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Assigned To Member</label>
              {isAdmin ? (
                <SearchableMemberSelect
                  users={users}
                  value={createAssignedToId}
                  onChange={(id) => setCreateAssignedToId(id)}
                  name="assigned_to_id"
                  currentUserId={user?.id}
                  placeholder="Search member to assign..."
                />
              ) : (
                <div className="p-2 rounded border border-neutral-800 bg-neutral-900/60 flex items-center justify-between text-xs text-neutral-300 h-[34px]">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{user?.name}</span>
                  </span>
                  <span className="text-2xs font-medium px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 shrink-0">
                    Your Lead
                  </span>
                  <input type="hidden" name="assigned_to_id" value={user?.id || ''} />
                </div>
              )}
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Initial Status</label>
              <select
                name="contact_status"
                className="input-select w-full"
                value={createStatus}
                onChange={(e) => setCreateStatus(e.target.value)}
              >
                {Object.entries(CONTACT_STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {createStatus === 'follow_up_required' && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-3">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                <span>Schedule Follow-Up Task</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-300 block mb-1 font-medium">Follow-Up Date & Time</label>
                  <input
                    type="datetime-local"
                    name="followup_date"
                    defaultValue={new Date().toISOString().slice(0, 16)}
                    className="input-text w-full font-mono"
                  />
                </div>
                <div>
                  <label className="text-neutral-300 block mb-1 font-medium">Preferred Time Window</label>
                  <input
                    type="text"
                    name="preferred_time"
                    placeholder="e.g. Afternoon, 2-4 PM"
                    className="input-text w-full"
                  />
                </div>
              </div>
              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Follow-Up Reason / Goal</label>
                <input
                  type="text"
                  name="followup_reason"
                  placeholder="e.g. Discuss course syllabus & pricing"
                  className="input-text w-full"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-neutral-300 block mb-1 font-medium">General Notes</label>
            <textarea name="notes" rows={2} className="input-text w-full" placeholder="Any specific requirements or notes about this contact..." />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => {
                setCreateModalOpen(false)
                setCreateStatus('not_contacted')
                setSelectedCollegeId(null)
                setSelectedOrgName('')
                setCityVal('')
                setIsCustomOrg(false)
                setCreateAssignedToId(user?.id ?? null)
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={createContactMutation.isPending} className="btn-primary">
              {createContactMutation.isPending ? 'Creating...' : 'Create Contact'}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}
