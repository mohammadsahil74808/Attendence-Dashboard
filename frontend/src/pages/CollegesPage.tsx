import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GraduationCap, Plus, Search, Building2, MapPin, Phone,
  Mail, Globe, User, CheckCircle2, ExternalLink,
  Edit2, Trash2, Users, RefreshCw
} from 'lucide-react'
import { AppLayout, PageHeader } from '../components/layout/AppLayout'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import type { College, PaginatedColleges } from '../types'

export default function CollegesPage() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Filters & pagination
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingCollege, setEditingCollege] = useState<College | null>(null)
  const [deletingCollege, setDeletingCollege] = useState<College | null>(null)

  // Fetch colleges
  const { data, isLoading, refetch } = useQuery<PaginatedColleges>({
    queryKey: ['colleges', page, search, statusFilter],
    queryFn: async () => {
      const params: Record<string, any> = { page, page_size: 24 }
      if (search) params.search = search
      if (statusFilter !== 'all') {
        if (statusFilter === 'registered') {
          params.is_registered = true
        } else {
          params.status = statusFilter
        }
      }
      const res = await api.get('/colleges/', { params })
      return res.data
    },
  })

  // Create college mutation
  const createMutation = useMutation({
    mutationFn: (payload: Partial<College>) => api.post('/colleges/', payload),
    onSuccess: () => {
      toast.show('College added successfully', 'success')
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
      queryClient.invalidateQueries({ queryKey: ['colleges-all'] })
      setIsAddModalOpen(false)
    },
    onError: (err: any) => {
      toast.show(err.response?.data?.detail || 'Failed to add college', 'error')
    },
  })

  // Update college mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<College> }) =>
      api.patch(`/colleges/${id}`, data),
    onSuccess: () => {
      toast.show('College updated successfully', 'success')
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
      queryClient.invalidateQueries({ queryKey: ['colleges-all'] })
      setEditingCollege(null)
    },
    onError: (err: any) => {
      toast.show(err.response?.data?.detail || 'Failed to update college', 'error')
    },
  })

  // Delete college mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/colleges/${id}`),
    onSuccess: () => {
      toast.show('College archived successfully', 'success')
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
      queryClient.invalidateQueries({ queryKey: ['colleges-all'] })
      setDeletingCollege(null)
    },
    onError: (err: any) => {
      toast.show(err.response?.data?.detail || 'Failed to delete college', 'error')
    },
  })

  const colleges = data?.items || []
  const totalCount = data?.total || 0
  const registeredCount = colleges.filter((c) => c.is_registered || c.status === 'registered').length
  const totalContactsCount = colleges.reduce((sum, c) => sum + (c.contacts_count || 0), 0)

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Colleges & Institutions"
          subtitle="Directory of colleges, institutional partners, and registration status"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                className="btn-secondary text-xs inline-flex items-center gap-1.5"
                title="Refresh colleges"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="btn-primary text-xs inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add College
              </button>
            </div>
          }
        />

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="panel p-4 flex flex-col justify-between">
            <span className="text-2xs uppercase tracking-wider text-neutral-400 font-medium">Total Colleges</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-neutral-100 font-mono">{totalCount}</span>
              <Building2 className="w-4 h-4 text-neutral-500" />
            </div>
          </div>

          <div className="panel p-4 flex flex-col justify-between border-l-4 border-l-emerald-500 bg-emerald-500/5">
            <span className="text-2xs uppercase tracking-wider text-emerald-400 font-medium">Registered Colleges</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-emerald-300 font-mono">{registeredCount}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          <div className="panel p-4 flex flex-col justify-between border-l-4 border-l-indigo-500 bg-indigo-500/5">
            <span className="text-2xs uppercase tracking-wider text-indigo-400 font-medium">Linked Contacts</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-indigo-300 font-mono">{totalContactsCount}</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
          </div>

          <div className="panel p-4 flex flex-col justify-between">
            <span className="text-2xs uppercase tracking-wider text-neutral-400 font-medium">Active Outreach</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-neutral-100 font-mono">
                {colleges.filter((c) => c.status === 'active' && !c.is_registered).length}
              </span>
              <GraduationCap className="w-4 h-4 text-neutral-500" />
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="panel p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search colleges by name, city, university, or contact person..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="input-text w-full pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="input-select text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="registered">Registered Colleges Only</option>
              <option value="active">Active Outreach</option>
              <option value="prospective">Prospective</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Colleges List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        ) : colleges.length === 0 ? (
          <div className="panel p-12 text-center space-y-3">
            <GraduationCap className="w-12 h-12 text-neutral-600 mx-auto" />
            <h3 className="text-sm font-semibold text-neutral-200">No colleges found</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search query or status filter.'
                : 'Get started by adding your first college or institutional partner.'}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add College
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {colleges.map((college) => {
              const isReg = college.is_registered || college.status === 'registered'
              return (
                <div
                  key={college.id}
                  className={`panel p-4 flex flex-col justify-between space-y-3 hover:border-neutral-700 transition-colors border-l-4 ${
                    isReg ? 'border-l-emerald-500' : 'border-l-indigo-500'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-neutral-100 line-clamp-1">
                            {college.name}
                          </h4>
                          {college.code && (
                            <span className="text-2xs font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                              {college.code}
                            </span>
                          )}
                        </div>
                        {college.university && (
                          <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5">
                            {college.university}
                          </p>
                        )}
                      </div>

                      {isReg ? (
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Registered
                        </span>
                      ) : (
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 uppercase">
                          {college.status}
                        </span>
                      )}
                    </div>

                    {/* Location & Website */}
                    <div className="space-y-1 text-xs text-neutral-400">
                      {(college.city || college.state) && (
                        <div className="flex items-center gap-1.5 text-neutral-300">
                          <MapPin className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                          <span>
                            {[college.city, college.state].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}

                      {college.contact_person && (
                        <div className="flex items-center gap-1.5 text-neutral-300">
                          <User className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                          <span>
                            {college.contact_person}
                            {college.contact_person_designation && (
                              <span className="text-neutral-500 ml-1">
                                ({college.contact_person_designation})
                              </span>
                            )}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-1 text-2xs">
                        {college.phone && (
                          <a
                            href={`tel:${college.phone}`}
                            className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-mono"
                          >
                            <Phone className="w-3 h-3" /> {college.phone}
                          </a>
                        )}
                        {college.email && (
                          <a
                            href={`mailto:${college.email}`}
                            className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" /> {college.email}
                          </a>
                        )}
                        {college.website && (
                          <a
                            href={college.website.startsWith('http') ? college.website : `https://${college.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-neutral-400 hover:text-neutral-200 inline-flex items-center gap-1"
                          >
                            <Globe className="w-3 h-3" /> Site <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer & Actions */}
                  <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                    <Link
                      to={`/contacts?organization=${encodeURIComponent(college.name)}`}
                      className="text-neutral-400 hover:text-indigo-400 inline-flex items-center gap-1.5 transition-colors font-medium text-2xs"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{college.contacts_count} Contacts</span>
                    </Link>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          // Navigate to Contacts with college preselected in query or action
                          navigate(`/contacts?college_id=${college.id}&add=true&college_name=${encodeURIComponent(college.name)}`)
                        }}
                        className="btn-secondary text-2xs py-1 px-2 text-indigo-300 hover:text-indigo-200"
                        title="Add Contact for this College"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Contact
                      </button>

                      <button
                        onClick={() => setEditingCollege(college)}
                        className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                        title="Edit College Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => setDeletingCollege(college)}
                          className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition-colors"
                          title="Archive College"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add College Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add New College / Institution"
        >
          <CollegeForm
            onSubmit={(formData) => createMutation.mutate(formData)}
            isPending={createMutation.isPending}
            onCancel={() => setIsAddModalOpen(false)}
          />
        </Modal>

        {/* Edit College Modal */}
        <Modal
          isOpen={!!editingCollege}
          onClose={() => setEditingCollege(null)}
          title="Edit College Details"
        >
          {editingCollege && (
            <CollegeForm
              initialData={editingCollege}
              onSubmit={(formData) =>
                updateMutation.mutate({ id: editingCollege.id, data: formData })
              }
              isPending={updateMutation.isPending}
              onCancel={() => setEditingCollege(null)}
            />
          )}
        </Modal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={!!deletingCollege}
          onClose={() => setDeletingCollege(null)}
          onConfirm={() => deletingCollege && deleteMutation.mutate(deletingCollege.id)}
          title="Archive College"
          message={`Are you sure you want to archive "${deletingCollege?.name}"? Contacts linked to this college will remain intact.`}
          confirmLabel="Archive College"
          isDanger={true}
        />
      </div>
    </AppLayout>
  )
}

interface CollegeFormProps {
  initialData?: College
  onSubmit: (data: Partial<College>) => void
  isPending: boolean
  onCancel: () => void
}

function CollegeForm({ initialData, onSubmit, isPending, onCancel }: CollegeFormProps) {
  const [isRegistered, setIsRegistered] = useState(
    initialData ? initialData.is_registered || initialData.status === 'registered' : false
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const rawStatus = isRegistered ? 'registered' : ((fd.get('status') as string) || 'active')
    onSubmit({
      name: (fd.get('name') as string).trim(),
      code: (fd.get('code') as string)?.trim() || null,
      university: (fd.get('university') as string)?.trim() || null,
      city: (fd.get('city') as string)?.trim() || null,
      state: (fd.get('state') as string)?.trim() || null,
      address: (fd.get('address') as string)?.trim() || null,
      website: (fd.get('website') as string)?.trim() || null,
      email: (fd.get('email') as string)?.trim() || null,
      phone: (fd.get('phone') as string)?.trim() || null,
      contact_person: (fd.get('contact_person') as string)?.trim() || null,
      contact_person_designation: (fd.get('contact_person_designation') as string)?.trim() || null,
      status: rawStatus as 'registered' | 'active' | 'prospective' | 'inactive',
      is_registered: isRegistered,
      notes: (fd.get('notes') as string)?.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      <div>
        <label className="text-neutral-300 block mb-1 font-medium">
          College / Institution Name <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          required
          defaultValue={initialData?.name}
          placeholder="e.g. Lingayas Vidyapeeth, Delhi Technical Campus"
          className="input-text w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-neutral-300 block mb-1 font-medium">Short Code / Acronym</label>
          <input
            type="text"
            name="code"
            defaultValue={initialData?.code || ''}
            placeholder="e.g. LV-01 or DTC"
            className="input-text w-full font-mono"
          />
        </div>
        <div>
          <label className="text-neutral-300 block mb-1 font-medium">Affiliated University / Board</label>
          <input
            type="text"
            name="university"
            defaultValue={initialData?.university || ''}
            placeholder="e.g. IP University, AICTE"
            className="input-text w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-neutral-300 block mb-1 font-medium">City</label>
          <input
            type="text"
            name="city"
            defaultValue={initialData?.city || ''}
            placeholder="e.g. Faridabad, Greater Noida"
            className="input-text w-full"
          />
        </div>
        <div>
          <label className="text-neutral-300 block mb-1 font-medium">State</label>
          <input
            type="text"
            name="state"
            defaultValue={initialData?.state || ''}
            placeholder="e.g. Haryana, Uttar Pradesh"
            className="input-text w-full"
          />
        </div>
      </div>

      <div>
        <label className="text-neutral-300 block mb-1 font-medium">Campus Address</label>
        <input
          type="text"
          name="address"
          defaultValue={initialData?.address || ''}
          placeholder="e.g. Nachauli, Jasana Road, Old Faridabad"
          className="input-text w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-neutral-300 block mb-1 font-medium">Key Contact Person / Dean / TPO</label>
          <input
            type="text"
            name="contact_person"
            defaultValue={initialData?.contact_person || ''}
            placeholder="e.g. Dr. Rajesh Kumar"
            className="input-text w-full"
          />
        </div>
        <div>
          <label className="text-neutral-300 block mb-1 font-medium">Designation</label>
          <input
            type="text"
            name="contact_person_designation"
            defaultValue={initialData?.contact_person_designation || ''}
            placeholder="e.g. Head of Placements, Director"
            className="input-text w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-neutral-300 block mb-1 font-medium">Contact Phone</label>
          <input
            type="text"
            name="phone"
            defaultValue={initialData?.phone || ''}
            placeholder="+91 98765 43210"
            className="input-text w-full font-mono"
          />
        </div>
        <div>
          <label className="text-neutral-300 block mb-1 font-medium">Contact Email</label>
          <input
            type="email"
            name="email"
            defaultValue={initialData?.email || ''}
            placeholder="tpo@college.edu.in"
            className="input-text w-full font-mono"
          />
        </div>
      </div>

      <div>
        <label className="text-neutral-300 block mb-1 font-medium">Official Website</label>
        <input
          type="text"
          name="website"
          defaultValue={initialData?.website || ''}
          placeholder="https://www.lingayasvidyapeeth.edu.in"
          className="input-text w-full"
        />
      </div>

      {/* Registration Checkbox & Status */}
      <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isRegistered}
            onChange={(e) => setIsRegistered(e.target.checked)}
            className="rounded border-neutral-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4 bg-neutral-900"
          />
          <span className="text-emerald-300 font-semibold text-xs">
            Mark this College as Registered / Enrolled
          </span>
        </label>
        <p className="text-2xs text-neutral-400 pl-6">
          Colleges marked as registered will automatically be categorized under Registered in Follow-Ups & Analytics.
        </p>
      </div>

      {!isRegistered && (
        <div>
          <label className="text-neutral-300 block mb-1 font-medium">Outreach Status</label>
          <select
            name="status"
            defaultValue={initialData?.status || 'active'}
            className="input-select w-full"
          >
            <option value="active">Active Outreach</option>
            <option value="prospective">Prospective</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      )}

      <div>
        <label className="text-neutral-300 block mb-1 font-medium">Notes & Remarks</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initialData?.notes || ''}
          placeholder="Add any additional context, key dates, or outreach background..."
          className="input-text w-full"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-neutral-800">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary"
        >
          {isPending ? 'Saving...' : initialData ? 'Update College' : 'Add College'}
        </button>
      </div>
    </form>
  )
}
