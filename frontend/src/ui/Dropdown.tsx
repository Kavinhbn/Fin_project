import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { cx } from './cx'

// ─── Dropdown (shared; never use a bare <select>) ───
export interface Option<V extends string> { value: V; label: string }

interface DropdownProps<V extends string> {
  label: string
  value: V
  options: readonly Option<V>[]
  onChange: (value: V) => void
  className?: string
}

export function Dropdown<V extends string>({ label, value, options, onChange, className }: DropdownProps<V>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const choose = (v: V) => { onChange(v); setOpen(false) }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setActive(Math.max(0, options.findIndex((o) => o.value === value))); setOpen(true); return }
      setActive((i) => (e.key === 'ArrowDown' ? Math.min(options.length - 1, i + 1) : Math.max(0, i - 1)))
    } else if ((e.key === 'Home' || e.key === 'End') && open) {
      e.preventDefault()
      setActive(e.key === 'Home' ? 0 : options.length - 1)
    } else if (e.key === 'Tab' && open) {
      setOpen(false)
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault()
      const opt = options[active]
      if (opt) choose(opt.value)
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className={cx('relative', className)}
      onBlur={(e) => { if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false) }}
    >
      <button
        type="button"
        role="combobox"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => { setActive(Math.max(0, options.findIndex((o) => o.value === value))); setOpen((o) => !o) }}
        onKeyDown={onKey}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="anim-fade absolute z-20 mt-1 max-h-60 w-full min-w-[160px] overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-md)]"
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(o.value) }}
              className={cx(
                'cursor-pointer px-3 py-1.5 text-[13px]',
                i === active && 'bg-[var(--color-bg)]',
                o.value === value ? 'font-semibold text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]',
              )}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
