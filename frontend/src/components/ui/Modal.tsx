import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: ReactNode
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus trap & Escape key handler (PRD §21, Accessibility Director)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    // Focus first element on open
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('input, button, select, textarea')?.focus()
    })

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size]

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={cn('modal-box w-full', sizeClass)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header - pinned at top */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-1 rounded-t-xl sticky top-0 z-10">
          <h2 id="modal-title" className="text-base font-semibold text-text-primary">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="btn-ghost btn-icon"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body - scrolls smoothly inside modal */}
        <div className="modal-body">{children}</div>

        {/* Footer - pinned at bottom if provided */}
        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-surface-1 rounded-b-xl sticky bottom-0 z-10">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  isDanger?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  isDanger = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className={isDanger ? 'btn-danger' : 'btn-primary'}
            onClick={() => { onConfirm(); onClose() }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">{message}</p>
    </Modal>
  )
}
