import type { ReactNode } from 'react'
import type { FeatureMode } from '../api/types'
import { Dropdown } from '../ui/Dropdown'
import { useApp } from './context'

// ─── PageHeader: title + subtitle left; mode switch, actions slot, identity right ───
const MODES = [
  { value: 'strict', label: 'Strict (leakage-free)' },
  { value: 'full', label: 'Full features' },
] as const satisfies readonly { value: FeatureMode; label: string }[]

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

export function PageHeader({ title, subtitle, actions, showMode = true }: { title: string; subtitle: string; actions?: ReactNode; showMode?: boolean }) {
  const { me, mode, setMode } = useApp()
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-[var(--color-text-primary)]">{title}</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        {showMode && <Dropdown label="Feature mode" value={mode} options={MODES} onChange={setMode} className="w-[190px]" />}
        {actions}
        <div className="flex items-center gap-2.5 pl-1">
          <div aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-light)] text-[11px] font-bold text-[var(--color-brand-dark)]">{initials(me.name)}</div>
          <div className="hidden text-left sm:block">
            <div className="text-[12px] font-semibold leading-tight text-[var(--color-text-primary)]">{me.name}</div>
            <div className="text-[11px] capitalize text-[var(--color-text-secondary)]">{me.role}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
