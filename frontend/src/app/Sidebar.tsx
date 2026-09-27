import { CircleHelp, ClipboardList, PanelLeftClose, PanelLeftOpen, Scale, ScrollText, Settings, Stethoscope } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cx } from '../ui/cx'
import { PRODUCT_NAME, PRODUCT_TAGLINE, useApp } from './context'
import type { Screen } from './context'
import type { Role } from '../api/types'

// ─── Sidebar ───
interface NavItem { screen: Screen; label: string; icon: LucideIcon; roles?: readonly Role[] }
interface NavGroup { title: string; items: readonly NavItem[] }

const NAV: readonly NavGroup[] = [
  { title: '01 Clinical', items: [
    { screen: 'assess', label: 'New assessment', icon: Stethoscope },
    { screen: 'assessments', label: 'Assessments', icon: ClipboardList },
  ] },
  { title: '02 Governance', items: [
    { screen: 'evidence', label: 'Model & evidence', icon: Scale },
    { screen: 'audit', label: 'Audit log', icon: ScrollText, roles: ['admin'] },
  ] },
  { title: '03 Account', items: [
    { screen: 'settings', label: 'Settings', icon: Settings },
    { screen: 'help', label: 'Help & glossary', icon: CircleHelp },
  ] },
]

export function Sidebar() {
  const { screen, go, me } = useApp()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const apply = () => { if (mq.matches) setCollapsed(true) }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return (
    <nav
      aria-label="Primary"
      className="flex shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-[400ms] ease-[var(--ease-out)]"
      style={{ width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)' }}
    >
      <div className="flex h-[var(--topbar-h)] items-center gap-3 border-b border-[var(--color-border)] px-5">
        <div aria-hidden className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand)] text-[15px] font-bold text-white">T</div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display truncate text-[15px] font-bold leading-tight text-[var(--color-text-primary)]">{PRODUCT_NAME}</div>
            <div className="truncate text-[10px] text-[var(--color-text-secondary)]">{PRODUCT_TAGLINE}</div>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-3 py-4">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.roles || i.roles.includes(me.role))
          if (items.length === 0) return null
          return (
            <div key={group.title} className="flex flex-col gap-1">
              {!collapsed && <div className="eyebrow px-3 pb-1">{group.title}</div>}
              {items.map(({ screen: s, label, icon: Icon }) => {
                const active = s === screen
                return (
                  <button
                    key={s}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    aria-label={collapsed ? label : undefined}
                    title={collapsed ? label : undefined}
                    onClick={() => go(s)}
                    className={cx(
                      'flex h-10 items-center gap-3 rounded-[var(--radius-md)] px-3 text-left text-[12px] font-extrabold transition-colors duration-100',
                      collapsed && 'justify-center px-0',
                      active ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]',
                    )}
                  >
                    <Icon size={20} strokeWidth={1.75} aria-hidden />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="border-t border-[var(--color-border)] p-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-9 w-full items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"
        >
          {collapsed ? <PanelLeftOpen size={16} aria-hidden /> : <PanelLeftClose size={16} aria-hidden />}
        </button>
      </div>
    </nav>
  )
}
