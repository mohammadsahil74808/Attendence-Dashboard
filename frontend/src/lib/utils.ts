import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns'
import type { ContactStatus, RegistrationStatus, FeedbackStatus } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  try {
    return format(new Date(date), 'dd MMM yyyy')
  } catch {
    return '—'
  }
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  try {
    return format(new Date(date), 'dd MMM yyyy, h:mm a')
  } catch {
    return '—'
  }
}

export function timeAgo(date: string | null | undefined): string {
  if (!date) return '—'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return '—'
  }
}

export function isOverdue(date: string | null | undefined): boolean {
  if (!date) return false
  return isPast(new Date(date)) && !isToday(new Date(date))
}

export function isDueToday(date: string | null | undefined): boolean {
  if (!date) return false
  return isToday(new Date(date))
}

// ─── Status → CSS class mappings ─────────────────────────────────────────────

export function contactStatusClass(status: ContactStatus): string {
  const map: Record<ContactStatus, string> = {
    not_contacted: 'badge-not-contacted',
    contacted: 'badge-contacted',
    no_response: 'badge-no-response',
    call_back_later: 'badge-call-back-later',
    follow_up_required: 'badge-follow-up-required',
    interested: 'badge-interested',
    not_interested: 'badge-not-interested',
    registered: 'badge-registered',
    closed: 'badge-closed',
  }
  return map[status] ?? 'badge-not-contacted'
}

export function registrationStatusClass(status: RegistrationStatus | null | undefined): string {
  if (!status) return 'badge-not-registered'
  const map: Record<RegistrationStatus, string> = {
    not_registered: 'badge-not-registered',
    registration_pending: 'badge-registration-pending',
    registered: 'badge-reg-registered',
    registration_cancelled: 'badge-registration-cancelled',
  }
  return map[status] ?? 'badge-not-registered'
}

export function feedbackStatusClass(status: FeedbackStatus | null | undefined): string {
  if (!status) return 'badge-not-contacted'
  return status === 'no_feedback_yet' ? 'badge-not-contacted'
    : status === 'feedback_received' ? 'badge-interested'
    : 'badge-follow-up-required'
}

export function followupUrgencyClass(date: string | null | undefined): string {
  if (!date) return ''
  if (isOverdue(date)) return 'badge-overdue'
  if (isDueToday(date)) return 'badge-due-today'
  return 'badge-upcoming'
}

// ─── URL search params helpers ────────────────────────────────────────────────

export function buildQueryString(params: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      sp.set(key, String(val))
    }
  }
  return sp.toString()
}
