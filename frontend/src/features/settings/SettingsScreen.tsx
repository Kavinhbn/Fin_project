import { useState } from 'react'
import { api } from '../../api/client'
import type { Role } from '../../api/types'
import { PageHeader } from '../../app/PageHeader'
import { PRODUCT_NAME, useApp } from '../../app/context'
import { Button } from '../../ui/Button'
import { Dropdown } from '../../ui/Dropdown'
import type { Option } from '../../ui/Dropdown'
import { useFeedback } from '../../ui/Feedback'

// ─── Settings: who you are, what mode you're in, and (dev only) a way to switch identity ───
const ROLE_OPTIONS: readonly Option<Role>[] = [
  { value: 'clinician', label: 'Clinician — can assess patients and write notes' },
  { value: 'viewer', label: 'Viewer — read-only (examiners, mentors)' },
  { value: 'admin', label: 'Admin — also sees the audit log' },
]

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] py-3 text-[13px] last:border-0">
      <div>
        <div className="text-[var(--color-text-secondary)]">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{hint}</div>}
      </div>
      <div className="font-mono-fig text-right font-medium text-[var(--color-text-primary)]">{value}</div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="font-display mb-1 text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function SettingsScreen() {
  const { me, setMe, mode, authMode, isMock, disclaimer, go } = useApp()
  const { toast } = useFeedback()
  const [name, setName] = useState(me.name)
  const [role, setRole] = useState<Role>(me.role)
  const [saving, setSaving] = useState(false)

  const switchable = authMode === 'dev' || isMock

  const save = async () => {
    setSaving(true)
    try {
      const next = await api.devLogin(name, role)
      setMe(next)
      toast(`Signed in as ${next.name} (${next.role}).`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not switch identity', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-6">
      <PageHeader title="Settings" subtitle="Your account, the current mode, and what this deployment is." showMode={false} />
      <div className="grid max-w-3xl gap-6">
        <Card title="Signed in as">
          <Row label="Name" value={me.name} />
          <Row label="Email" value={me.email} />
          <Row label="Role" value={me.role} hint="Determines what you can do: viewers can't create assessments or generate notes; only admins see the audit log." />
          <Row label="Login method" value={authMode === 'dev' ? 'Dev mode (no real login)' : authMode === 'mock' ? 'Demo data (no login)' : 'Google sign-in (IAP)'} />
        </Card>

        <Card title="Current view">
          <Row label="Feature mode" value={mode === 'strict' ? 'Strict (leakage-free)' : 'Full features'}
               hint="Strict mode never uses a lab value to predict the condition that lab defines (e.g. glucose isn't used to predict diabetes). Full mode uses everything, for comparison. Change it from any page's header." />
          <Row label="Data source" value={isMock ? 'Demo data (not a real model)' : 'Live — connected to the trained model'} />
        </Card>

        {switchable && (
          <Card title="Switch who you're signed in as">
            <p className="mb-4 text-[12px] text-[var(--color-text-secondary)]">
              {authMode === 'dev'
                ? 'This is a development server: there is no real login. Pick a name and role to see the app as that user — useful for checking what a viewer or an admin sees.'
                : 'This is the demo. Pick a role to see how the app looks for a viewer or an admin.'}
            </p>
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="settings-name" className="eyebrow">Name</label>
                <input id="settings-name" value={name} onChange={(e) => setName(e.target.value)}
                       className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[13px]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="eyebrow">Role</span>
                <Dropdown label="Role" value={role} options={ROLE_OPTIONS} onChange={setRole} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="primary" loading={saving} onClick={() => void save()}>Switch</Button>
            </div>
          </Card>
        )}

        <Card title="About this deployment">
          <Row label="Product" value={PRODUCT_NAME} />
          <p className="border-t border-[var(--color-border)] py-3 text-[12px] text-[var(--color-text-secondary)]">{disclaimer}</p>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            New here?{' '}
            <button type="button" className="text-[var(--color-brand)] underline" onClick={() => go('help')}>
              Help &amp; glossary
            </button>{' '}
            explains every input, every badge and every metric in this app in plain language.
          </p>
        </Card>
      </div>
    </div>
  )
}
