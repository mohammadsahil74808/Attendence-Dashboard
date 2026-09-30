import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Phone, Mail, MessageSquare, Calendar,
  Clock, CheckCircle, AlertCircle, Plus, Edit, Shield,
  ExternalLink, Building2, MapPin, Tag, Trash2, Trash, RotateCcw,
  GraduationCap,
} from 'lucide-react'
import { AppLayout } from '../components/layout/AppLayout'
import { ContactStatusBadge, RegistrationBadge } from '../components/ui/StatusBadges'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import api from '../lib/api'
import { formatDate } from '../lib/utils'
import type {
  Contact,
  ContactAttempt,
  Feedback,
  Registration,
  FollowUp,
  AuditLog,
  ContactStatus,
  RegistrationStatus,
  College,
  User,
} from '../types'
import {
  CONTACT_STATUS_LABELS,
  REGISTRATION_STATUS_LABELS,
  CONTACT_METHODS,
  ATTEMPT_OUTCOMES,
} from '../types'
import { SearchableMemberSelect } from '../components/ui/SearchableMemberSelect'

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const contactId = Number(id)
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()

  // Active tab state
  const [activeTab, setActiveTab] = useState<'timeline' | 'feedback' | 'registration' | 'followups' | 'audit'>('timeline')

  // Modals state
  const [attemptModalOpen, setAttemptModalOpen] = useState(false)
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false)
  const [followupModalOpen, setFollowupModalOpen] = useState(false)
  const [editInfoModalOpen, setEditInfoModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [permanentDeleteConfirmOpen, setPermanentDeleteConfirmOpen] = useState(false)

  const deleteContactMutation = useMutation({
    mutationFn: (permanent: boolean = false) =>
      api.delete(`/contacts/${contactId}${permanent ? '?permanent=true' : ''}`),
    onSuccess: (_, permanent) => {
      toast(permanent ? 'Contact permanently removed from database' : 'Contact moved to Trash', 'success')
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      navigate('/contacts')
    },
    onError: () => toast('Failed to delete contact', 'error'),
  })

  const restoreContactMutation = useMutation({
    mutationFn: () => api.post(`/contacts/${contactId}/restore`),
    onSuccess: () => {
      toast('Contact restored successfully', 'success')
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
    onError: () => toast('Failed to restore contact', 'error'),
  })

  // Fetch contact detail
  const { data: contact, isLoading: contactLoading, error: contactError } = useQuery<Contact>({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      const res = await api.get(`/contacts/${contactId}`)
      return res.data
    },
    enabled: !!contactId,
  })

  // Fetch colleges list for dropdown
  const { data: colleges = [] } = useQuery<College[]>({
    queryKey: ['colleges-all'],
    queryFn: async () => {
      const res = await api.get('/colleges/all')
      return res.data
    },
  })

  // Fetch users for assignment dropdown
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('/users/')
      return res.data
    },
    enabled: isAdmin,
  })

  const [editCollegeId, setEditCollegeId] = useState<number | null>(null)
  const [editOrgName, setEditOrgName] = useState<string>('')
  const [editAssignedToId, setEditAssignedToId] = useState<number | null>(null)
  const { data: attempts = [] } = useQuery<ContactAttempt[]>({
    queryKey: ['attempts', contactId],
    queryFn: async () => {
      const res = await api.get(`/contacts/${contactId}/attempts`)
      return res.data
    },
    enabled: !!contactId,
  })

  // Fetch feedback
  const { data: feedbacks = [] } = useQuery<Feedback[]>({
    queryKey: ['feedback', contactId],
    queryFn: async () => {
      const res = await api.get(`/contacts/${contactId}/feedback`)
      return res.data
    },
    enabled: !!contactId,
  })

  // Fetch registration
  const { data: registration } = useQuery<Registration>({
    queryKey: ['registration', contactId],
    queryFn: async () => {
      try {
        const res = await api.get(`/contacts/${contactId}/registration`)
        return res.data
      } catch (err: any) {
        if (err.response?.status === 404) return null
        throw err
      }
    },
    enabled: !!contactId,
  })

  // Fetch follow-ups
  const { data: followups = [] } = useQuery<FollowUp[]>({
    queryKey: ['followups', contactId],
    queryFn: async () => {
      const res = await api.get(`/contacts/${contactId}/followups`)
      return res.data
    },
    enabled: !!contactId,
  })

  // Fetch audit logs
  const { data: auditLogs = [], isLoading: auditLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit', contactId],
    queryFn: async () => {
      const res = await api.get(`/contacts/${contactId}/audit`)
      return res.data
    },
    enabled: !!contactId && activeTab === 'audit',
  })

  // Mutations
  const updateContactMutation = useMutation({
    mutationFn: (data: Partial<Contact>) => api.patch(`/contacts/${contactId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.show('Contact updated successfully', 'success')
    },
    onError: () => toast.show('Failed to update contact', 'error'),
  })

  const createAttemptMutation = useMutation({
    mutationFn: (data: any) => api.post(`/contacts/${contactId}/attempts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attempts', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      queryClient.invalidateQueries({ queryKey: ['followups', contactId] })
      toast.show('Contact attempt logged', 'success')
      setAttemptModalOpen(false)
    },
    onError: () => toast.show('Failed to log attempt', 'error'),
  })

  const createFeedbackMutation = useMutation({
    mutationFn: (data: any) => api.post(`/contacts/${contactId}/feedback`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      queryClient.invalidateQueries({ queryKey: ['followups', contactId] })
      toast.show('Feedback recorded', 'success')
      setFeedbackModalOpen(false)
    },
    onError: () => toast.show('Failed to record feedback', 'error'),
  })

  const saveRegistrationMutation = useMutation({
    mutationFn: (data: any) => api.post(`/contacts/${contactId}/registration`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registration', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      toast.show('Registration status saved', 'success')
      setRegistrationModalOpen(false)
    },
    onError: () => toast.show('Failed to save registration', 'error'),
  })

  const createFollowupMutation = useMutation({
    mutationFn: (data: any) => api.post(`/contacts/${contactId}/followups`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      toast.show('Follow-up scheduled', 'success')
      setFollowupModalOpen(false)
    },
    onError: () => toast.show('Failed to schedule follow-up', 'error'),
  })

  const completeFollowupMutation = useMutation({
    mutationFn: (fuId: number) => api.patch(`/followups/${fuId}`, { status: 'completed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      toast.show('Follow-up marked as completed', 'success')
    },
    onError: () => toast.show('Failed to update follow-up', 'error'),
  })

  if (contactLoading) {
    return (
      <AppLayout>
        <div className="p-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96 lg:col-span-2" />
          </div>
        </div>
      </AppLayout>
    )
  }

  if (contactError || !contact) {
    return (
      <AppLayout>
        <div className="p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-semibold text-neutral-100">Contact Not Found</h2>
          <p className="text-neutral-400">The requested contact does not exist or you do not have permission to view it.</p>
          <button onClick={() => navigate('/contacts')} className="btn-secondary">
            Return to Contacts
          </button>
        </div>
      </AppLayout>
    )
  }

  const activeFollowup = followups.find((f) => f.status === 'scheduled')

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Navigation Breadcrumb & Back */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={() => navigate('/contacts')}
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contacts
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setAttemptModalOpen(true)}
              className="btn-primary text-xs sm:text-sm inline-flex items-center gap-1.5 py-1.5 px-3"
            >
              <Phone className="w-3.5 h-3.5" />
              Log Attempt
            </button>
            <button
              onClick={() => setFeedbackModalOpen(true)}
              className="btn-secondary text-xs sm:text-sm inline-flex items-center gap-1.5 py-1.5 px-3"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Feedback
            </button>
            <button
              onClick={() => setRegistrationModalOpen(true)}
              className="btn-secondary text-xs sm:text-sm inline-flex items-center gap-1.5 py-1.5 px-3"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Registration
            </button>
            <button
              onClick={() => setFollowupModalOpen(true)}
              className="btn-secondary text-xs sm:text-sm inline-flex items-center gap-1.5 py-1.5 px-3"
            >
              <Calendar className="w-3.5 h-3.5" />
              Follow-Up
            </button>
            {isAdmin && (
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="btn-danger text-xs sm:text-sm inline-flex items-center gap-1.5 py-1.5 px-3"
                title="Move Contact to Trash"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Trash Status Banner */}
        {contact.is_archived && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-rose-300 text-sm font-medium">
              <Trash2 className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>This contact is currently in Trash. You can restore it to the active list or permanently delete it to free space.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => restoreContactMutation.mutate()}
                disabled={restoreContactMutation.isPending}
                className="btn-secondary text-xs inline-flex items-center gap-1 text-emerald-400 border-emerald-500/30"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {restoreContactMutation.isPending ? 'Restoring...' : 'Restore Contact'}
              </button>
              <button
                onClick={() => setPermanentDeleteConfirmOpen(true)}
                className="btn-danger text-xs inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white"
              >
                <Trash className="w-3.5 h-3.5" />
                Delete Forever
              </button>
            </div>
          </div>
        )}

        {/* Top Header Card */}
        <div className="panel p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 border-l-4 border-indigo-500">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">{contact.name}</h1>
              <ContactStatusBadge status={contact.contact_status} />
              {contact.registration_status && (
                <RegistrationBadge status={contact.registration_status as RegistrationStatus} />
              )}
              {contact.is_overdue && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Overdue
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-2 text-sm text-neutral-400 flex-wrap">
              {contact.organization && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-neutral-500" />
                  {contact.organization}
                  {contact.designation && <span className="text-neutral-500">({contact.designation})</span>}
                </span>
              )}
              {contact.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-neutral-500" />
                  {contact.city}
                </span>
              )}
              {contact.source && (
                <span className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-neutral-500" />
                  Source: {contact.source}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-neutral-300">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Assigned: <strong className="text-neutral-100">{contact.assigned_to?.name || 'Unassigned'}</strong>
              </span>
            </div>
          </div>

          {/* Inline Status & Assignment Controls */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-400 block">Contact Status</label>
              <select
                value={contact.contact_status}
                disabled={!isAdmin}
                onChange={(e) => updateContactMutation.mutate({ contact_status: e.target.value as ContactStatus })}
                className={`input-select text-xs py-1.5 px-2.5 bg-neutral-900 border-neutral-700 text-neutral-200 ${!isAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {Object.entries(CONTACT_STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>


          </div>
        </div>

        {/* Main Grid: Details Sidebar + Tabbed Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Contact Data & Active Follow-up */}
          <div className="space-y-6">
            {/* Contact Info Panel */}
            <div className="panel p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">Contact Details</h3>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditCollegeId(contact.college_id || null)
                      setEditOrgName(contact.organization || '')
                      setEditAssignedToId(contact.assigned_to_id || null)
                      setEditInfoModalOpen(true)
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-neutral-500 text-xs block">Phone</span>
                  {contact.phone ? (
                    <a href={`tel:${contact.phone}`} className="text-neutral-200 hover:text-indigo-400 font-mono flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-neutral-400" />
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </div>

                <div>
                  <span className="text-neutral-500 text-xs block">WhatsApp</span>
                  {contact.whatsapp ? (
                    <a
                      href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:underline font-mono flex items-center gap-2"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {contact.whatsapp}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </div>

                <div>
                  <span className="text-neutral-500 text-xs block">Email</span>
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="text-neutral-200 hover:text-indigo-400 font-mono flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-neutral-400" />
                      {contact.email}
                    </a>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </div>


                {contact.notes && (
                  <div>
                    <span className="text-neutral-500 text-xs block">Notes</span>
                    <p className="text-neutral-300 text-xs mt-1 bg-neutral-900/60 p-2.5 rounded border border-neutral-800 whitespace-pre-wrap">
                      {contact.notes}
                    </p>
                  </div>
                )}

                {contact.custom_fields && Object.keys(contact.custom_fields).length > 0 && (
                  <div className="pt-2 border-t border-neutral-800">
                    <span className="text-neutral-500 text-xs block mb-1">Custom Fields</span>
                    <div className="space-y-1 text-xs">
                      {Object.entries(contact.custom_fields).map(([k, v]) => (
                        <div key={k} className="flex justify-between py-0.5">
                          <span className="text-neutral-400">{k}:</span>
                          <span className="text-neutral-200 font-mono">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Active Follow-Up Card */}
            <div className={`panel p-5 border-l-4 ${activeFollowup ? 'border-amber-500 bg-amber-500/5' : 'border-neutral-700'}`}>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  Scheduled Follow-Up
                </span>
                {activeFollowup && (
                  <span className="text-xs font-mono text-amber-400">
                    {activeFollowup.is_overdue ? 'OVERDUE' : 'DUE'}
                  </span>
                )}
              </div>

              {activeFollowup ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-base font-semibold text-neutral-100">
                      {formatDate(activeFollowup.followup_date)}
                    </div>
                    {activeFollowup.preferred_time && (
                      <div className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> Preferred time: {activeFollowup.preferred_time}
                      </div>
                    )}
                  </div>

                  {activeFollowup.reason && (
                    <div className="text-xs text-neutral-300 bg-neutral-900/80 p-2 rounded border border-neutral-800">
                      {activeFollowup.reason}
                    </div>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => completeFollowupMutation.mutate(activeFollowup.id)}
                        disabled={completeFollowupMutation.isPending}
                        className="btn-primary text-xs py-1.5 px-3 flex-1 inline-flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Mark Complete
                      </button>
                      <button
                        onClick={() => setFollowupModalOpen(true)}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        Reschedule
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs text-neutral-500">No active follow-up scheduled.</p>
                  {isAdmin && (
                    <button
                      onClick={() => setFollowupModalOpen(true)}
                      className="btn-secondary text-xs py-1 px-3 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Schedule Now
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Tabbed Activity View */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tabs Header */}
            <div className="flex border-b border-neutral-800 gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'timeline'
                    ? 'border-indigo-500 text-indigo-400 font-semibold'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                Contact Attempts ({attempts.length})
              </button>

              <button
                onClick={() => setActiveTab('feedback')}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'feedback'
                    ? 'border-indigo-500 text-indigo-400 font-semibold'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Feedback ({feedbacks.length})
              </button>

              <button
                onClick={() => setActiveTab('registration')}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'registration'
                    ? 'border-indigo-500 text-indigo-400 font-semibold'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Registration
              </button>

              <button
                onClick={() => setActiveTab('followups')}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'followups'
                    ? 'border-indigo-500 text-indigo-400 font-semibold'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Follow-Ups History ({followups.length})
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'audit'
                    ? 'border-indigo-500 text-indigo-400 font-semibold'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Audit Trail
              </button>
            </div>

            {/* Tab 1: Contact Attempts Timeline */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">Chronological history of outreach attempts</span>
                  {isAdmin && (
                    <button
                      onClick={() => setAttemptModalOpen(true)}
                      className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Log Attempt
                    </button>
                  )}
                </div>

                {attempts.length === 0 ? (
                  <div className="panel p-8 text-center space-y-3">
                    <Phone className="w-8 h-8 text-neutral-600 mx-auto" />
                    <p className="text-sm text-neutral-400">No contact attempts recorded yet.</p>
                    {isAdmin && (
                      <button
                        onClick={() => setAttemptModalOpen(true)}
                        className="btn-secondary text-xs inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Log First Outreach Attempt
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attempts.map((attempt) => (
                      <div
                        key={attempt.id}
                        className={`panel p-4 space-y-2 border-l-2 ${
                          attempt.outcome === 'reached'
                            ? 'border-emerald-500'
                            : attempt.outcome === 'no_answer'
                            ? 'border-rose-500'
                            : 'border-amber-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-semibold">
                              Attempt #{attempt.attempt_number}
                            </span>
                            <span className="text-xs font-medium text-neutral-200 capitalize">
                              {attempt.method.replace('_', ' ')}
                            </span>
                            <span className="text-neutral-500">•</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              attempt.outcome === 'reached'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : attempt.outcome === 'no_answer'
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {attempt.outcome.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-neutral-500" />
                            {formatDate(attempt.occurred_at)}
                          </div>
                        </div>

                        {attempt.notes && (
                          <p className="text-xs text-neutral-300 bg-neutral-900/60 p-2.5 rounded border border-neutral-800">
                            {attempt.notes}
                          </p>
                        )}

                        <div className="text-xs text-neutral-500 flex items-center justify-between pt-1">
                          <span>Logged by: {attempt.performed_by?.name || 'System'}</span>
                          {attempt.is_voided && (
                            <span className="text-rose-400 italic">Voided: {attempt.void_reason}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Feedback Records */}
            {activeTab === 'feedback' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">Captured feedback and responses</span>
                  {isAdmin && (
                    <button
                      onClick={() => setFeedbackModalOpen(true)}
                      className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Record Feedback
                    </button>
                  )}
                </div>

                {feedbacks.length === 0 ? (
                  <div className="panel p-8 text-center space-y-3">
                    <MessageSquare className="w-8 h-8 text-neutral-600 mx-auto" />
                    <p className="text-sm text-neutral-400">No feedback entries recorded.</p>
                    {isAdmin && (
                      <button
                        onClick={() => setFeedbackModalOpen(true)}
                        className="btn-secondary text-xs inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Feedback
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {feedbacks.map((fb) => (
                      <div key={fb.id} className="panel p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              fb.received_bool ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                            }`}>
                              {fb.received_bool ? 'Feedback Received' : 'No Direct Feedback'}
                            </span>
                            {fb.category && (
                              <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                                {fb.category}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-neutral-400">{formatDate(fb.feedback_date)}</span>
                        </div>

                        {fb.details && (
                          <p className="text-xs text-neutral-200 bg-neutral-900/60 p-3 rounded border border-neutral-800 whitespace-pre-wrap">
                            {fb.details}
                          </p>
                        )}

                        {fb.followup_required_bool && (
                          <div className="text-xs text-amber-400 flex items-center gap-2 pt-1 border-t border-neutral-800">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Follow-up required
                            {fb.next_followup_date && ` (Target: ${formatDate(fb.next_followup_date)})`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Registration Record */}
            {activeTab === 'registration' && (
              <div className="panel p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-100">Event / Registration Status</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Independent from outreach status — tracks whether contact is registered
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setRegistrationModalOpen(true)}
                      className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" /> Update Registration
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-900/60 rounded border border-neutral-800 space-y-1">
                    <span className="text-xs text-neutral-400 block">Current Status</span>
                    <div className="pt-1">
                      <RegistrationBadge status={(registration?.status as RegistrationStatus) || 'not_registered'} />
                    </div>
                  </div>

                  <div className="p-4 bg-neutral-900/60 rounded border border-neutral-800 space-y-1">
                    <span className="text-xs text-neutral-400 block">External Registration ID</span>
                    <span className="text-sm font-mono text-neutral-200">
                      {registration?.registration_id_external || '—'}
                    </span>
                  </div>

                  <div className="p-4 bg-neutral-900/60 rounded border border-neutral-800 space-y-1">
                    <span className="text-xs text-neutral-400 block">Registration Type</span>
                    <span className="text-sm text-neutral-200 capitalize">
                      {registration?.registration_type || '—'}
                    </span>
                  </div>

                  <div className="p-4 bg-neutral-900/60 rounded border border-neutral-800 space-y-1">
                    <span className="text-xs text-neutral-400 block">Payment Status</span>
                    <span className="text-sm text-neutral-200 uppercase font-mono">
                      {registration?.payment_status || 'N/A'}
                    </span>
                  </div>
                </div>

                {registration?.notes && (
                  <div className="space-y-1">
                    <span className="text-xs text-neutral-400 block">Registration Notes</span>
                    <p className="text-xs text-neutral-200 bg-neutral-900/60 p-3 rounded border border-neutral-800">
                      {registration.notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Follow-Ups History */}
            {activeTab === 'followups' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">All scheduled, completed, and superseded tasks</span>
                  <button
                    onClick={() => setFollowupModalOpen(true)}
                    className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Schedule Follow-Up
                  </button>
                </div>

                {followups.length === 0 ? (
                  <div className="panel p-8 text-center space-y-3">
                    <Calendar className="w-8 h-8 text-neutral-600 mx-auto" />
                    <p className="text-sm text-neutral-400">No follow-ups recorded.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {followups.map((fu) => (
                      <div key={fu.id} className="panel p-4 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              fu.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : fu.status === 'scheduled'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}>
                              {fu.status}
                            </span>
                            <span className="text-xs font-semibold text-neutral-200 font-mono">
                              {formatDate(fu.followup_date)}
                            </span>
                            {fu.preferred_time && (
                              <span className="text-xs text-neutral-400">({fu.preferred_time})</span>
                            )}
                          </div>
                          {fu.reason && <p className="text-xs text-neutral-300">{fu.reason}</p>}
                        </div>

                        {fu.status === 'scheduled' && (
                          <button
                            onClick={() => completeFollowupMutation.mutate(fu.id)}
                            className="btn-secondary text-xs py-1 px-3 whitespace-nowrap"
                          >
                            Mark Done
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: Audit Log */}
            {activeTab === 'audit' && (
              <div className="panel p-6 space-y-4">
                <div className="pb-3 border-b border-neutral-800">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">Audit History</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">Immutable record of all changes made to this contact</p>
                </div>

                {auditLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                  </div>
                ) : auditLogs.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-4 text-center">No audit records found.</p>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-neutral-900/60 rounded border border-neutral-800 text-xs flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-neutral-200 capitalize">{log.action}</span>
                          {log.field_changed && (
                            <span className="text-neutral-400 ml-2">
                              Field <span className="font-mono text-indigo-400">{log.field_changed}</span>: {log.old_value || 'none'} → {log.new_value}
                            </span>
                          )}
                          <div className="text-neutral-500 text-2xs">
                            By {log.changed_by?.name || `User #${log.changed_by_id}`}
                          </div>
                        </div>
                        <span className="text-neutral-500 font-mono text-2xs">{formatDate(log.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Modals ── */}

        {/* 1. Log Attempt Modal */}
        <Modal
          isOpen={attemptModalOpen}
          onClose={() => setAttemptModalOpen(false)}
          title="Log Contact Attempt"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              createAttemptMutation.mutate({
                method: fd.get('method'),
                outcome: fd.get('outcome'),
                notes: fd.get('notes'),
                next_followup_date: fd.get('next_followup_date') ? new Date(fd.get('next_followup_date') as string).toISOString() : null,
                followup_reason: fd.get('followup_reason') || null,
              })
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Method</label>
              <select name="method" className="input-select w-full" required>
                {CONTACT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Outcome</label>
              <select name="outcome" className="input-select w-full" required>
                {ATTEMPT_OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Notes & Summary</label>
              <textarea
                name="notes"
                rows={3}
                className="input-text w-full"
                placeholder="What was discussed or observed during the attempt..."
              />
            </div>

            <div className="pt-3 border-t border-neutral-800 space-y-3">
              <span className="text-neutral-400 font-medium block">Schedule Next Follow-Up (Optional)</span>
              <div>
                <label className="text-neutral-400 block mb-1">Target Date & Time</label>
                <input type="datetime-local" name="next_followup_date" className="input-text w-full" />
              </div>
              <div>
                <label className="text-neutral-400 block mb-1">Reason / Agenda</label>
                <input type="text" name="followup_reason" className="input-text w-full" placeholder="e.g. Call back after 2pm" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setAttemptModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={createAttemptMutation.isPending} className="btn-primary">
                {createAttemptMutation.isPending ? 'Logging...' : 'Save Attempt'}
              </button>
            </div>
          </form>
        </Modal>

        {/* 2. Record Feedback Modal */}
        <Modal
          isOpen={feedbackModalOpen}
          onClose={() => setFeedbackModalOpen(false)}
          title="Record Contact Feedback"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              createFeedbackMutation.mutate({
                received_bool: fd.get('received_bool') === 'true',
                category: fd.get('category'),
                details: fd.get('details'),
                followup_required_bool: fd.get('followup_required') === 'true',
                next_followup_date: fd.get('next_followup_date') ? new Date(fd.get('next_followup_date') as string).toISOString() : null,
              })
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Was Feedback Provided?</label>
              <select name="received_bool" className="input-select w-full" defaultValue="true">
                <option value="true">Yes — Person gave feedback / opinion</option>
                <option value="false">No — No response or feedback withheld</option>
              </select>
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Category</label>
              <select name="category" className="input-select w-full">
                <option value="General Interest">General Interest</option>
                <option value="Pricing / Fee Objection">Pricing / Fee Objection</option>
                <option value="Timing / Schedule Conflict">Timing / Schedule Conflict</option>
                <option value="Needs Decision Maker Approval">Needs Approval</option>
                <option value="Already Registered">Already Registered</option>
                <option value="Not Relevant">Not Relevant</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Feedback Details</label>
              <textarea
                name="details"
                rows={4}
                className="input-text w-full"
                placeholder="Specific comments, questions asked, or objections raised..."
                required
              />
            </div>

            <div className="pt-3 border-t border-neutral-800 space-y-3">
              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Does this require further follow-up?</label>
                <select name="followup_required" className="input-select w-full" defaultValue="false">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Target Date & Time (if required)</label>
                <input type="datetime-local" name="next_followup_date" className="input-text w-full" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setFeedbackModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={createFeedbackMutation.isPending} className="btn-primary">
                {createFeedbackMutation.isPending ? 'Saving...' : 'Save Feedback'}
              </button>
            </div>
          </form>
        </Modal>

        {/* 3. Update Registration Modal */}
        <Modal
          isOpen={registrationModalOpen}
          onClose={() => setRegistrationModalOpen(false)}
          title="Update Registration Status"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              saveRegistrationMutation.mutate({
                status: fd.get('status'),
                registration_id_external: fd.get('registration_id_external') || null,
                registration_type: fd.get('registration_type') || null,
                payment_status: fd.get('payment_status') || 'na',
                notes: fd.get('notes') || null,
              })
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Registration Status</label>
              <select
                name="status"
                defaultValue={registration?.status || 'not_registered'}
                className="input-select w-full"
                required
              >
                {Object.entries(REGISTRATION_STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">External Registration ID / Ticket Number</label>
              <input
                type="text"
                name="registration_id_external"
                defaultValue={registration?.registration_id_external || ''}
                className="input-text w-full"
                placeholder="e.g. TICKET-9821"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Type / Tier</label>
                <input
                  type="text"
                  name="registration_type"
                  defaultValue={registration?.registration_type || ''}
                  className="input-text w-full"
                  placeholder="e.g. Student / General"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Payment Status</label>
                <select
                  name="payment_status"
                  defaultValue={registration?.payment_status || 'na'}
                  className="input-select w-full"
                >
                  <option value="na">N/A (Free)</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Registration Notes</label>
              <textarea
                name="notes"
                rows={2}
                defaultValue={registration?.notes || ''}
                className="input-text w-full"
                placeholder="Additional registration context..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setRegistrationModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saveRegistrationMutation.isPending} className="btn-primary">
                {saveRegistrationMutation.isPending ? 'Saving...' : 'Update Registration'}
              </button>
            </div>
          </form>
        </Modal>

        {/* 4. Schedule Follow-Up Modal */}
        <Modal
          isOpen={followupModalOpen}
          onClose={() => setFollowupModalOpen(false)}
          title="Schedule Follow-Up Task"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const dt = fd.get('followup_date') as string
              createFollowupMutation.mutate({
                followup_date: new Date(dt).toISOString(),
                preferred_time: fd.get('preferred_time') || null,
                reason: fd.get('reason'),
                priority: fd.get('priority') || 'normal',
              })
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Follow-Up Date & Time</label>
              <input
                type="datetime-local"
                name="followup_date"
                required
                className="input-text w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Preferred Time Window</label>
                <input
                  type="text"
                  name="preferred_time"
                  className="input-text w-full"
                  placeholder="e.g. Afternoon, 3-5 PM"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Priority</label>
                <select name="priority" className="input-select w-full" defaultValue="normal">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High (Urgent)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Reason / Goal</label>
              <textarea
                name="reason"
                rows={3}
                required
                className="input-text w-full"
                placeholder="What is the objective of this follow-up?"
              />
            </div>



            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setFollowupModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={createFollowupMutation.isPending} className="btn-primary">
                {createFollowupMutation.isPending ? 'Scheduling...' : 'Save Follow-Up'}
              </button>
            </div>
          </form>
        </Modal>

        {/* 5. Edit Contact Info Modal */}
        <Modal
          isOpen={editInfoModalOpen}
          onClose={() => setEditInfoModalOpen(false)}
          title="Edit Contact Info"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const payload: any = {
                name: fd.get('name') as string,
                organization: editOrgName !== '' ? editOrgName : (contact.organization || null),
                college_id: editCollegeId !== null ? editCollegeId : (contact.college_id || null),
                designation: (fd.get('designation') as string) || null,
                phone: (fd.get('phone') as string) || null,
                whatsapp: (fd.get('whatsapp') as string) || null,
                email: (fd.get('email') as string) || null,
                city: (fd.get('city') as string) || null,
                notes: (fd.get('notes') as string) || null,
              }
              if (isAdmin) {
                payload.assigned_to_id = editAssignedToId
              }
              updateContactMutation.mutate(payload)
              setEditInfoModalOpen(false)
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Full Name</label>
              <input type="text" name="name" defaultValue={contact.name} required className="input-text w-full" />
            </div>

            {/* College Selector */}
            <div className="space-y-1.5 p-3 rounded-lg border border-neutral-800 bg-neutral-900/40">
              <div className="flex items-center justify-between">
                <label className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                  College / Institution
                </label>
                <Link
                  to="/colleges"
                  target="_blank"
                  className="text-2xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  View Colleges
                </Link>
              </div>
              <select
                className="input-select w-full"
                value={editCollegeId ?? (contact.college_id || '')}
                onChange={(e) => {
                  const cid = e.target.value ? Number(e.target.value) : null
                  setEditCollegeId(cid)
                  const found = colleges.find((c) => c.id === cid)
                  if (found) {
                    setEditOrgName(found.name)
                  }
                }}
              >
                <option value="">-- Select College (or enter custom below) --</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.city ? `(${c.city})` : ''} {c.is_registered ? '★ Registered' : ''}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name="organization"
                value={editOrgName !== '' ? editOrgName : (contact.organization || '')}
                onChange={(e) => setEditOrgName(e.target.value)}
                placeholder="Or type custom college / org"
                className="input-text w-full"
              />
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Designation</label>
              <input type="text" name="designation" defaultValue={contact.designation || ''} className="input-text w-full" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Phone</label>
                <input type="text" name="phone" defaultValue={contact.phone || ''} className="input-text w-full font-mono" />
              </div>
              <div>
                <label className="text-neutral-300 block mb-1 font-medium">WhatsApp</label>
                <input type="text" name="whatsapp" defaultValue={contact.whatsapp || ''} className="input-text w-full font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Email</label>
                <input type="email" name="email" defaultValue={contact.email || ''} className="input-text w-full font-mono" />
              </div>
              <div>
                <label className="text-neutral-300 block mb-1 font-medium">City</label>
                <input type="text" name="city" defaultValue={contact.city || ''} className="input-text w-full" />
              </div>
            </div>

            {/* Assigned To Field */}
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Assigned To</label>
              {isAdmin ? (
                <SearchableMemberSelect
                  users={users}
                  value={editAssignedToId}
                  onChange={(id) => setEditAssignedToId(id)}
                  name="assigned_to_id"
                  placeholder="Search member to assign..."
                />
              ) : (
                <div className="p-2.5 rounded border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-300">
                  Assigned to: <strong className="text-neutral-100">{contact.assigned_to?.name || 'Unassigned'}</strong> (Admin only can reassign)
                </div>
              )}
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">General Notes</label>
              <textarea name="notes" rows={3} defaultValue={contact.notes || ''} className="input-text w-full" />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setEditInfoModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={updateContactMutation.isPending} className="btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        </Modal>

        {/* Delete / Move to Trash Confirm Dialog */}
        <ConfirmDialog
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={() => deleteContactMutation.mutate(false)}
          title="Move Contact to Trash"
          message={`Are you sure you want to move "${contact.name}" to Trash? You can restore it anytime from the Trash view.`}
          confirmLabel="Move to Trash"
          isDanger={true}
        />

        {/* Permanent Delete Confirm Dialog */}
        <ConfirmDialog
          isOpen={permanentDeleteConfirmOpen}
          onClose={() => setPermanentDeleteConfirmOpen(false)}
          onConfirm={() => deleteContactMutation.mutate(true)}
          title="Permanently Delete from Database?"
          message={`⚠️ DANGER: Are you sure you want to permanently delete "${contact.name}" from Supabase? All associated follow-ups, feedbacks, and attempts will also be removed. This frees up database space and CANNOT be undone.`}
          confirmLabel="Delete Forever"
          isDanger={true}
        />
      </div>
    </AppLayout>
  )
}
