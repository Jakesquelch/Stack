import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * A panel that slides up from the bottom of the screen. Tapping outside closes it.
 * Rendered into <body> so it isn't faded or clipped by whatever opened it.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="w-full max-w-md rounded-t-3xl bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** "Are you sure?" with a red button */
export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep it',
  pending,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="mb-5 text-slate-300">{message}</p>
      <div className="grid gap-2">
        <button className="btn-danger" disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button className="btn-secondary" onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </Sheet>
  )
}
