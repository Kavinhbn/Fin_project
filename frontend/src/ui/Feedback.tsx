import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

// ─── Toast + Confirm providers (never use alert()/confirm()) ───
type ToastKind = 'info' | 'error'
interface ToastItem { id: number; kind: ToastKind; message: string }
interface ConfirmOptions { title: string; body: string; confirmLabel: string; danger?: boolean }

interface FeedbackApi {
  toast: (message: string, kind?: ToastKind) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackApi | null>(null)

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider')
  return ctx
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const t = timers.current
    return () => { t.forEach((h) => clearTimeout(h)); t.clear() }
  }, [])

  const dismiss = useCallback((id: number) => {
    const h = timers.current.get(id)
    if (h) clearTimeout(h)
    timers.current.delete(id)
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++nextId.current
    setToasts((t) => [...t, { id, kind, message }])
    timers.current.set(id, setTimeout(() => dismiss(id), 5000))
  }, [dismiss])

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  )

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm])
  const close = (ok: boolean) => { pending?.resolve(ok); setPending(null) }

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {/* No aria-live on the container: each toast carries its own role, so it is announced once. */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="anim-fade pointer-events-auto flex max-w-sm items-start gap-3 rounded-[var(--radius-md)] py-2.5 pl-4 pr-2 text-[12px] font-medium text-white shadow-[var(--shadow-lg)]"
            style={{ background: 'var(--color-text-primary)' }}
          >
            <span className="min-w-0 flex-1 pt-0.5">{t.message}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="shrink-0 rounded-[var(--radius-sm)] p-1 hover:bg-white/15">
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
      <Modal
        open={pending !== null}
        onClose={() => close(false)}
        title={pending?.title ?? ''}
        footer={
          <>
            <Button size="sm" onClick={() => close(false)}>Cancel</Button>
            <Button size="sm" variant={pending?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{pending?.confirmLabel}</Button>
          </>
        }
      >
        <p className="px-6 py-5 text-[13px] text-[var(--color-text-secondary)]">{pending?.body}</p>
      </Modal>
    </FeedbackContext.Provider>
  )
}
