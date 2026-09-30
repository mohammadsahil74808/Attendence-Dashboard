// All TypeScript types mirroring the backend Pydantic schemas

export type UserRole = 'admin' | 'member'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export type ContactStatus =
  | 'not_contacted'
  | 'contacted'
  | 'no_response'
  | 'call_back_later'
  | 'follow_up_required'
  | 'interested'
  | 'not_interested'
  | 'registered'
  | 'closed'

export type RegistrationStatus =
  | 'not_registered'
  | 'registration_pending'
  | 'registered'
  | 'registration_cancelled'

export type FeedbackStatus =
  | 'no_feedback_yet'
  | 'feedback_received'
  | 'feedback_received_followup_pending'

export type FollowUpStatus = 'scheduled' | 'completed' | 'superseded' | 'cancelled'

export interface ContactListItem {
  id: number
  name: string
  organization: string | null
  phone: string | null
  email: string | null
  contact_status: ContactStatus
  college_id?: number | null
  assigned_to_id: number | null
  assigned_to_name: string | null
  registration_status: RegistrationStatus | null
  next_followup_date: string | null
  last_attempt_date: string | null
  feedback_status: FeedbackStatus | null
  is_overdue: boolean
  created_at: string
}

export interface Contact extends ContactListItem {
  designation: string | null
  whatsapp: string | null
  city: string | null
  source: string | null
  notes: string | null
  assigned_to: User | null
  import_batch_id: number | null
  custom_fields: Record<string, unknown> | null
  is_archived: boolean
  updated_at: string
}

export interface College {
  id: number
  name: string
  code: string | null
  university: string | null
  city: string | null
  state: string | null
  address: string | null
  website: string | null
  email: string | null
  phone: string | null
  contact_person: string | null
  contact_person_designation: string | null
  status: 'active' | 'registered' | 'prospective' | 'inactive'
  is_registered: boolean
  notes: string | null
  created_by_id: number | null
  created_by?: User | null
  contacts_count: number
  registered_contacts_count: number
  created_at: string
  updated_at: string
}

export interface PaginatedColleges {
  items: College[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PaginatedContacts {
  items: ContactListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ContactAttempt {
  id: number
  contact_id: number
  attempt_number: number
  occurred_at: string
  method: string
  performed_by_id: number
  performed_by: User | null
  outcome: string
  notes: string | null
  is_voided: boolean
  void_reason: string | null
  created_at: string
}

export interface Feedback {
  id: number
  contact_id: number
  contact_attempt_id: number | null
  received_bool: boolean
  feedback_date: string
  category: string | null
  details: string | null
  followup_required_bool: boolean
  next_followup_date: string | null
  created_at: string
}

export interface Registration {
  id: number
  contact_id: number
  status: RegistrationStatus
  registration_date: string | null
  registration_id_external: string | null
  registration_type: string | null
  payment_status: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FollowUp {
  id: number
  contact_id: number
  followup_date: string
  preferred_time: string | null
  reason: string | null
  assigned_to_id: number | null
  assigned_to: User | null
  status: FollowUpStatus
  reminder_status: string
  priority: string
  created_from_type: string | null
  created_from_id: number | null
  is_overdue: boolean
  created_at: string
  contact_name: string | null
  contact_phone?: string | null
  contact_organization?: string | null
  contact_status?: string | null
  registration_status?: string | null
}

export interface DashboardSummary {
  total_contacts: number
  not_contacted: number
  contacted: number
  no_response: number
  follow_up_required: number
  interested: number
  not_interested: number
  status_registered: number
  closed: number
  registered: number
  not_registered: number
  overdue_follow_ups: number
  due_today: number
  completed_today: number
  feedback_received: number
  feedback_pending: number
}

export interface AuditLog {
  id: number
  entity_type: string
  entity_id: number
  changed_by_id: number
  changed_by: User | null
  field_changed: string | null
  old_value: string | null
  new_value: string | null
  action: string
  timestamp: string
}

export interface ImportPreviewRow {
  row_index: number
  data: Record<string, string>
  validation_errors: string[]
  duplicate_match: {
    id: number
    name: string
    phone: string | null
    email: string | null
    contact_status: string | null
  } | null
}

export interface ImportPreview {
  batch_id: string
  filename: string
  total_rows: number
  columns: string[]
  preview_rows: ImportPreviewRow[]
  valid_count: number
  error_count: number
  duplicate_count: number
}

export interface AuthState {
  user: User | null
  token: string | null
}

// Filter params for contacts list
export interface ContactFilters {
  search?: string
  contact_status?: ContactStatus
  registration_status?: RegistrationStatus
  feedback_status?: FeedbackStatus
  assigned_to_id?: number
  college_id?: number
  organization?: string
  import_batch_id?: number
  overdue_only?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  not_contacted: 'Not Contacted',
  contacted: 'Contacted',
  no_response: 'No Response',
  call_back_later: 'Call Back Later',
  follow_up_required: 'Follow-Up Required',
  interested: 'Interested',
  not_interested: 'Not Interested',
  registered: 'Registered',
  closed: 'Closed',
}

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  not_registered: 'Not Registered',
  registration_pending: 'Pending',
  registered: 'Registered ✓',
  registration_cancelled: 'Cancelled',
}

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  no_feedback_yet: 'No Feedback',
  feedback_received: 'Received',
  feedback_received_followup_pending: 'Follow-Up Pending',
}

export const CONTACT_METHODS = [
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'in_person', label: 'In Person' },
  { value: 'other', label: 'Other' },
]

export const ATTEMPT_OUTCOMES = [
  { value: 'reached', label: 'Reached' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'switched_off', label: 'Switched Off' },
  { value: 'requested_callback', label: 'Requested Callback' },
  { value: 'declined', label: 'Declined' },
  { value: 'other', label: 'Other' },
]
