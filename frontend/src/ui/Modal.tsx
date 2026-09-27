import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { cx } from './cx'

// ─── Layer stack: only the topmost layer handles Esc and Tab ───
const layerStack: symbol[] = []

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

// ─── Layer: the one overlay implementation shared by Modal and Drawer ───
interface LayerProps {
  open: boolean
  onClose: () => void
  title: string
  variant: 'modal' | 'drawer'
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

function Layer({ open, onClose, title, variant, children, footer, wide }: LayerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const me = Symbol('layer')
    layerStack.push(me)
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (layerStack[layerStack.length - 1] !== me) return
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) { e.preventDefault(); panel.focus(); return }
      const first = items[0]!
      const last = items[items.length - 1]!
      const active = document.activeElement
      if (!panel.contains(active) || active === panel) { e.preventDefault(); (e.shiftKey ? last : first).focus() }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const i = layerStack.indexOf(me)
      if (i >= 0) layerStack.splice(i, 1)
      if (previous && document.contains(previous)) previous.focus()
    }
  }, [open])

  if (!open) return null
  const isDrawer = variant === 'drawer'
  return createPortal(
    <div className={cx('fixed inset-0 z-50 flex', isDrawer ? 'justify-end' : 'items-center justify-center p-4')}>
      <div className="anim-fade absolute inset-0 bg-[var(--color-scrim)]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'relative flex min-h-0 flex-col bg-[var(--color-surface)] shadow-[var(--shadow-xl)] outline-none',
          isDrawer
            ? cx('anim-drawer h-full w-full', wide ? 'max-w-[880px]' : 'max-w-[560px]')
            : 'anim-modal max-h-[90vh] w-full max-w-md rounded-[var(--radius-lg)]',
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="font-display text-[16px] font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose} icon={<X size={16} />} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Modal(props: Omit<LayerProps, 'variant' | 'wide'>) {
  return <Layer {...props} variant="modal" />
}

export function Drawer(props: Omit<LayerProps, 'variant'>) {
  return <Layer {...props} variant="drawer" />
}
