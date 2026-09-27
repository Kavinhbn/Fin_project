import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { invalidate, useResource } from '../../api/cache'
import { EDUCATION_OPTIONS, RACE_ETHNICITY_OPTIONS } from '../../api/types'
import type { Assessment, Disease, PatientInput } from '../../api/types'
import { useApp } from '../../app/context'
import { ComorbidityGraph } from '../../charts/ComorbidityGraph'
import { DISEASE_LABEL, RiskRow } from '../../charts/RiskBar'
import { PathwayBar, ShapBars } from '../../charts/ShapBars'
import { Button } from '../../ui/Button'
import { useFeedback } from '../../ui/Feedback'
import { Drawer } from '../../ui/Modal'
import { TabShell, Tabs } from '../../ui/Layout'
import type { TabDef } from '../../ui/Layout'
import { EmptyState, ErrorState, RoleNotice, SkeletonRows } from '../../ui/States'
import { StatusBadge } from '../../ui/StatusBadge'
import { formatDate } from './format'

// ─── Detail drawer: Summary / Explanation / Note ───
type TabKey = 'summary' | 'explanation' | 'note'
const TABS: readonly TabDef<TabKey>[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'explanation', label: 'Explanation' },
  { key: 'note', label: 'Clinical note' },
]
const DISEASES: readonly Disease[] = ['diabetes', 'hypertension', 'cvd']

export function DetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { disclaimer } = useApp()
  return (
    <Drawer open={id !== null} onClose={onClose} title={id ? `Assessment ${id}` : 'Assessment'} wide>
      {/* The drawer covers the page strips, so the sign-off disclaimer is repeated here on every tab. */}
      <div role="note" className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-1.5 text-[11px] font-medium text-[var(--color-text-primary)]">{disclaimer}</div>
      {id && <DetailBody id={id} />}
    </Drawer>
  )
}

function DetailBody({ id }: { id: string }) {
  const { canWrite, me } = useApp()
  const res = useResource<Assessment>(`assessment:${id}`, () => api.getAssessment(id))
  const [tab, setTab] = useState<TabKey>('summary')

  if (res.loading && !res.data) return <SkeletonRows rows={7} />
  if (res.error || !res.data) return <ErrorState message={res.error?.message ?? 'Assessment not found'} onRetry={res.reload} />
  const a = res.data

  return (
    <TabShell
      bare
      header={
        <div className="pb-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--color-text-secondary)]">
            <span>Created {formatDate(a.created_at)} by {a.created_by}</span>
            <span className="font-mono-fig">Model {a.model_version}</span>
            <span>{a.mode === 'strict' ? 'Strict (leakage-free)' : 'Full features'}</span>
          </div>
          {!canWrite && <div className="-mx-6 mt-3"><RoleNotice>Signed in as {me.email} with a read-only role. Notes cannot be generated or reviewed.</RoleNotice></div>}
        </div>
      }
      tabs={<Tabs tabs={TABS} active={tab} onChange={setTab} />}
    >
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="anim-fade p-6">
        {tab === 'summary' && <SummaryTab a={a} />}
        {tab === 'explanation' && <ExplanationTab a={a} />}
        {tab === 'note' && <NoteTab a={a} onChange={res.setData} />}
      </div>
    </TabShell>
  )
}

// ─── Summary ───
const BOOLEAN_LABELS: Partial<Record<keyof PatientInput, [string, string]>> = {
  smoker: ['Current or former smoker', 'Never smoked'],
  vigorous_activity: ['Yes', 'No'],
  alcohol_12plus: ['Yes', 'No'],
}

const INPUT_ROWS: readonly { key: keyof PatientInput; label: string; unit: string; options?: readonly { value: number; label: string }[] }[] = [
  { key: 'age', label: 'Age', unit: 'y' }, { key: 'sex', label: 'Sex', unit: '' }, { key: 'bmi', label: 'BMI', unit: 'kg/m²' },
  { key: 'sbp', label: 'Systolic BP', unit: 'mmHg' }, { key: 'dbp', label: 'Diastolic BP', unit: 'mmHg' },
  { key: 'fasting_glucose', label: 'Fasting glucose', unit: 'mg/dL' }, { key: 'hba1c', label: 'HbA1c', unit: '%' },
  { key: 'total_cholesterol', label: 'Total cholesterol', unit: 'mg/dL' }, { key: 'hdl', label: 'HDL', unit: 'mg/dL' },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL' }, { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL' }, { key: 'smoker', label: 'Smoking', unit: '' },
  { key: 'race_ethnicity', label: 'Race / ethnicity', unit: '', options: RACE_ETHNICITY_OPTIONS },
  { key: 'education', label: 'Education', unit: '', options: EDUCATION_OPTIONS },
  { key: 'income_ratio', label: 'Income-to-poverty ratio', unit: '' },
  { key: 'vigorous_activity', label: 'Vigorous activity', unit: '' },
  { key: 'alcohol_12plus', label: 'Regular alcohol use', unit: '' },
]

function showValue(key: keyof PatientInput, v: PatientInput[keyof PatientInput], unit: string, options?: readonly { value: number; label: string }[]): string {
  if (v === null) return 'Not provided'
  if (typeof v === 'boolean') {
    const [yes, no] = BOOLEAN_LABELS[key] ?? ['Yes', 'No']
    return v ? yes : no
  }
  if (options && typeof v === 'number') return options.find((o) => o.value === v)?.label ?? String(v)
  return unit ? `${v} ${unit}` : String(v)
}

function SummaryTab({ a }: { a: Assessment }) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="sum-risk">
        <h3 id="sum-risk" className="eyebrow mb-1">Estimated risk</h3>
        <div className="divide-y divide-[var(--color-border)]">{DISEASES.map((d) => <RiskRow key={d} disease={d} risk={a.risks[d]} />)}</div>
      </section>
      <section aria-labelledby="sum-cascade">
        <h3 id="sum-cascade" className="eyebrow mb-3">Disease cascade</h3>
        <ComorbidityGraph pathways={a.cvd_pathways} />
      </section>
      <section aria-labelledby="sum-input">
        <h3 id="sum-input" className="eyebrow mb-3">Inputs</h3>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          {INPUT_ROWS.map((r) => (
            <div key={r.key} className="flex justify-between gap-4 border-b border-[var(--color-border)] py-1.5 text-[12px]">
              <dt className="text-[var(--color-text-secondary)]">{r.label}</dt>
              <dd className="font-mono-fig text-[var(--color-text-primary)]">{showValue(r.key, a.input[r.key], r.unit, r.options)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

// ─── Explanation ───
function ExplanationTab({ a }: { a: Assessment }) {
  return (
    <div className="flex flex-col gap-8">
      {DISEASES.map((d) => (
        <section key={d} aria-labelledby={`exp-${d}`} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 id={`exp-${d}`} className="font-display mb-3 text-[16px] font-semibold">{DISEASE_LABEL[d]}</h3>
          <ShapBars explanation={a.explanation[d]} />
          {d === 'cvd' && (
            <div className="mt-6 border-t border-[var(--color-border)] pt-4">
              <div className="eyebrow mb-3">Where the CVD estimate comes from</div>
              <PathwayBar pathways={a.cvd_pathways} />
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

// ─── Note ───
function NoteTab({ a, onChange }: { a: Assessment; onChange: (next: Assessment) => void }) {
  const { canWrite } = useApp()
  const { toast, confirm } = useFeedback()
  const [busy, setBusy] = useState<'note' | 'review' | null>(null)
  const articleRef = useRef<HTMLElement>(null)
  const focusArticle = useRef(false)

  // The action buttons unmount when the note appears / is reviewed; move focus to the note.
  useEffect(() => {
    if (focusArticle.current && articleRef.current) {
      focusArticle.current = false
      articleRef.current.focus()
    }
  })

  const generate = async () => {
    setBusy('note')
    try {
      const next = await api.generateNote(a.id)
      invalidate('assessments:')
      invalidate('audit')
      focusArticle.current = true
      onChange(next)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not generate the note', 'error')
    } finally {
      setBusy(null)
    }
  }

  const review = async () => {
    if (!a.note) return
    const ok = await confirm({
      title: 'Mark note as reviewed?',
      body: 'This records that a licensed physician has reviewed the note. It does not change the estimates.',
      confirmLabel: 'Mark reviewed',
    })
    if (!ok) return
    // Pending state: the badge stays "Awaiting review" and the button shows loading until the server confirms.
    setBusy('review')
    try {
      const next = await api.markReviewed(a.id, a.version)
      invalidate('assessments:')
      invalidate('audit')
      focusArticle.current = true
      onChange(next)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the review', 'error')
    } finally {
      setBusy(null)
    }
  }

  if (!a.note) {
    return (
      <EmptyState
        title="No clinical note yet"
        hint={canWrite ? 'Generate a draft note from the estimates and the strongest drivers. Every claim is checked against the model output.' : 'Notes can be generated by clinicians. Your role is read-only.'}
        action={canWrite ? <Button variant="primary" loading={busy === 'note'} onClick={() => void generate()}>Generate note</Button> : undefined}
      />
    )
  }
  const { note } = a
  return (
    <article ref={articleRef} tabIndex={-1} aria-label="Clinical note" className="flex flex-col gap-6 outline-none">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status="ai_generated" />
        <StatusBadge status={note.verifier.flagged.length ? 'flagged' : 'passed'} />
        <StatusBadge status={note.reviewed_by ? 'reviewed' : 'awaiting_review'} />
        <span className="font-mono-fig text-[11px] text-[var(--color-text-secondary)]">{note.verifier.passed} of {note.verifier.checked} claims verified · {formatDate(note.generated_at)}</span>
      </div>
      {note.verifier.flagged.length > 0 && (
        <section role="alert" aria-labelledby="flagged" className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-4">
          <h3 id="flagged" className="text-[12px] font-bold text-[var(--color-text-primary)]">Claims that did not match the model output</h3>
          <ul className="mt-2 flex flex-col gap-2 text-[12px] text-[var(--color-text-primary)]">
            {note.verifier.flagged.map((f) => <li key={f.claim}><span className="font-medium">“{f.claim}”</span> {f.reason}</li>)}
          </ul>
        </section>
      )}
      {note.sections.map((s) => (
        <section key={s.title} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="eyebrow mb-2">{s.title}</h3>
          <p className="text-[13px] leading-relaxed text-[var(--color-text-primary)]">{s.body}</p>
        </section>
      ))}
      <p className="text-[11px] text-[var(--color-text-secondary)]">{a.disclaimer}</p>
      <div className="flex items-center justify-end gap-3">
        {note.reviewed_by && <span className="text-[12px] text-[var(--color-text-secondary)]">Reviewed by {note.reviewed_by}</span>}
        {canWrite && !note.reviewed_by && <Button variant="primary" loading={busy === 'review'} onClick={() => void review()}>Mark reviewed</Button>}
      </div>
    </article>
  )
}
