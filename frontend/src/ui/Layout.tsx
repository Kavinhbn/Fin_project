import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { cx } from './cx'

// ─── SplitPane: master/detail, shared by every list that needs one ───
// `natural` lets both panes grow with their own content instead of stretching to match the
// taller sibling (the default flex behaviour) — and pins the right pane in view (desktop only)
// so a result stays visible while a long left-hand form scrolls past it.
export function SplitPane({ left, right, leftWidth = 'w-[420px]', natural = false }: { left: ReactNode; right: ReactNode; leftWidth?: string; natural?: boolean }) {
  return (
    <div className={cx('flex flex-col gap-5 lg:flex-row', natural ? 'lg:items-start' : 'min-h-0 flex-1')}>
      <section className={cx('flex shrink-0 flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]', !natural && 'min-h-0 overflow-auto', leftWidth, 'max-lg:w-full')}>{left}</section>
      <section className={cx('flex min-w-0 flex-1 flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]', natural ? 'lg:sticky lg:top-0' : 'min-h-0 overflow-auto')}>{right}</section>
    </div>
  )
}

// ─── Tabs: folder tabs, active merges into the panel ───
export interface TabDef<K extends string> { key: K; label: string }

export function Tabs<K extends string>({ tabs, active, onChange }: { tabs: readonly TabDef<K>[]; active: K; onChange: (k: K) => void }) {
  const refs = useRef<Partial<Record<K, HTMLButtonElement | null>>>({})

  const onKeyDown = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.key === active)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next < 0) return
    e.preventDefault()
    const k = tabs[next]!.key
    onChange(k)
    refs.current[k]?.focus()
  }

  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto" onKeyDown={onKeyDown}>
      {tabs.map((t) => {
        const on = t.key === active
        return (
          <button
            key={t.key}
            ref={(el) => { refs.current[t.key] = el }}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={on}
            aria-controls={on ? `panel-${t.key}` : undefined}
            tabIndex={on ? 0 : -1}
            type="button"
            onClick={() => onChange(t.key)}
            className={cx(
              'mb-[-1px] shrink-0 rounded-t-[var(--radius-md)] border border-b-0 px-4 py-2 text-[12px] font-semibold transition-colors duration-100',
              on
                ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                : 'border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]',
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Archetype A: card shell with tabs (single scroll container below the header) ───
export function TabShell({ header, tabs, children, bare = false }: { header: ReactNode; tabs: ReactNode; children: ReactNode; bare?: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className={cx('flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-surface)]', !bare && 'border border-[var(--color-border)]')}>
        <div className="border-b border-[var(--color-border)] px-6 pt-6">
          {header}
          <div className="mt-4">{tabs}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--color-bg-subtle)]">{children}</div>
      </div>
    </div>
  )
}
