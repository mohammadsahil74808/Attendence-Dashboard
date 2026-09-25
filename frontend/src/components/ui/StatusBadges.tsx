import type {
  ContactStatus,
  RegistrationStatus,
  FeedbackStatus,
} from '../../types'
import {
  CONTACT_STATUS_LABELS,
  REGISTRATION_STATUS_LABELS,
  FEEDBACK_STATUS_LABELS,
} from '../../types'
import {
  contactStatusClass,
  registrationStatusClass,
  feedbackStatusClass,
  followupUrgencyClass,
  formatDate,
} from '../../lib/utils'

interface ContactStatusBadgeProps {
  status: ContactStatus
}
export function ContactStatusBadge({ status }: ContactStatusBadgeProps) {
  return (
    <span className={`badge ${contactStatusClass(status)}`} aria-label={`Contact status: ${CONTACT_STATUS_LABELS[status]}`}>
      <span className="badge-dot" style={{ backgroundColor: 'currentColor' }} aria-hidden="true" />
      {CONTACT_STATUS_LABELS[status]}
    </span>
  )
}

interface RegistrationBadgeProps {
  status: RegistrationStatus | null | undefined
}
export function RegistrationBadge({ status }: RegistrationBadgeProps) {
  if (!status) return <span className="badge badge-not-registered">Not Registered</span>
  return (
    <span className={`badge ${registrationStatusClass(status)}`} aria-label={`Registration: ${REGISTRATION_STATUS_LABELS[status]}`}>
      {REGISTRATION_STATUS_LABELS[status]}
    </span>
  )
}

interface FeedbackBadgeProps {
  status: FeedbackStatus | null | undefined
}
export function FeedbackBadge({ status }: FeedbackBadgeProps) {
  if (!status) return null
  return (
    <span className={`badge ${feedbackStatusClass(status)}`} aria-label={`Feedback: ${FEEDBACK_STATUS_LABELS[status]}`}>
      {FEEDBACK_STATUS_LABELS[status]}
    </span>
  )
}

interface FollowUpBadgeProps {
  date: string | null | undefined
}
export function FollowUpBadge({ date }: FollowUpBadgeProps) {
  if (!date) return <span className="text-text-muted text-xs">—</span>
  const cls = followupUrgencyClass(date)
  return (
    <span className={`badge ${cls}`} aria-label={`Follow-up scheduled: ${formatDate(date)}`}>
      {formatDate(date)}
    </span>
  )
}
