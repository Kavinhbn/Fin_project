import { useState } from 'react'
import { PageHeader } from '../../app/PageHeader'
import { useApp } from '../../app/context'
import { StatusBadge } from '../../ui/StatusBadge'
import { Tabs, TabShell } from '../../ui/Layout'
import type { TabDef } from '../../ui/Layout'
import { BADGE_GLOSSARY, EXPLANATION_GLOSSARY, FIELD_GLOSSARY, METRIC_GLOSSARY } from './content'
import type { Term } from './content'

// ─── Help & glossary: plain-language explanation of every input, badge and metric in the app ───
type TabKey = 'start' | 'fields' | 'results' | 'explanations' | 'metrics' | 'safety'
const TABS: readonly TabDef<TabKey>[] = [
  { key: 'start', label: 'Getting started' },
  { key: 'fields', label: 'Patient fields' },
  { key: 'results', label: 'Results & badges' },
  { key: 'explanations', label: 'Explanations' },
  { key: 'metrics', label: 'Model & evidence' },
  { key: 'safety', label: 'Safety & limits' },
]

function TermList({ terms }: { terms: readonly Term[] }) {
  return (
    <dl className="flex flex-col gap-5">
      {terms.map((t) => (
        <div key={t.name} className="border-b border-[var(--color-border)] pb-5 last:border-0 last:pb-0">
          <dt className="font-display text-[14px] font-semibold text-[var(--color-text-primary)]">{t.name}</dt>
          <dd className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-text-primary)]">{t.plain}</dd>
          {t.why && <dd className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-text-secondary)]"><span className="font-semibold">Why it matters: </span>{t.why}</dd>}
          {t.technical && <dd className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Also called: {t.technical}</dd>}
        </div>
      ))}
    </dl>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <div aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-light)] text-[12px] font-bold text-[var(--color-brand-dark)]">{n}</div>
      <div>
        <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">{title}</div>
        <div className="mt-0.5 text-[13px] text-[var(--color-text-secondary)]">{body}</div>
      </div>
    </li>
  )
}

export function HelpScreen() {
  const { go } = useApp()
  const [tab, setTab] = useState<TabKey>('start')

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 p-6">
      <PageHeader title="Help & glossary" subtitle="What every screen, field and number in this app means, in plain language." showMode={false} />
      <TabShell header={<div className="pb-1" />} tabs={<Tabs tabs={TABS} active={tab} onChange={setTab} />}>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="anim-fade max-w-3xl p-6">
          {tab === 'start' && (
            <div className="flex flex-col gap-8">
              <section>
                <h2 className="font-display mb-4 text-[16px] font-semibold">How to assess a patient</h2>
                <ol className="flex flex-col gap-5">
                  <Step n={1} title="New assessment" body="Enter the patient's routine checkup values. Only age, sex and BMI are required — everything else can be left blank if you don't have it, and the model will work with what you give it." />
                  <Step n={2} title="Estimate risk" body="You'll see three risk levels side by side — Diabetes, Hypertension and Cardiovascular disease — each with a percentage and a Low/Moderate/High/Uncertain badge." />
                  <Step n={3} title="Open full assessment" body="See exactly which factors drove each number up or down (Explanation tab), and generate a plain-English note a clinician can review and sign off on (Clinical note tab)." />
                  <Step n={4} title="Model & evidence" body="Check how accurate this model actually is — not just trust it. Real numbers on real patients the model never trained on." />
                </ol>
              </section>
              <section>
                <h2 className="font-display mb-3 text-[16px] font-semibold">What each screen is for</h2>
                <TermList terms={[
                  { name: 'New assessment', plain: 'Enter a patient and get an immediate risk estimate.' },
                  { name: 'Assessments', plain: 'Every assessment you\'ve created before, with filters, sortable columns and the same full detail you saw when you first ran it.' },
                  { name: 'Model & evidence', plain: 'The model\'s own report card — accuracy, calibration and fairness across groups.' },
                  { name: 'Audit log', plain: 'Admins only: a record of every prediction made, for accountability. It stores a fingerprint of the inputs, never the raw patient data.' },
                  { name: 'Settings', plain: 'Who you\'re signed in as and what mode the app is in.' },
                ]} />
              </section>
            </div>
          )}

          {tab === 'fields' && (
            <div>
              <p className="mb-6 text-[13px] text-[var(--color-text-secondary)]">Everything you can enter on the New assessment screen, explained.</p>
              <TermList terms={FIELD_GLOSSARY} />
            </div>
          )}

          {tab === 'results' && (
            <div>
              <p className="mb-6 text-[13px] text-[var(--color-text-secondary)]">The badges and labels you'll see on a risk result or a clinical note.</p>
              <div className="mb-6 flex flex-wrap gap-2">
                <StatusBadge status="low" /><StatusBadge status="moderate" /><StatusBadge status="high" /><StatusBadge status="uncertain" />
                <StatusBadge status="ai_generated" /><StatusBadge status="passed" /><StatusBadge status="flagged" />
                <StatusBadge status="awaiting_review" /><StatusBadge status="reviewed" />
              </div>
              <TermList terms={BADGE_GLOSSARY} />
            </div>
          )}

          {tab === 'explanations' && (
            <div>
              <p className="mb-6 text-[13px] text-[var(--color-text-secondary)]">How to read the Explanation tab on a full assessment.</p>
              <TermList terms={EXPLANATION_GLOSSARY} />
            </div>
          )}

          {tab === 'metrics' && (
            <div>
              <p className="mb-6 text-[13px] text-[var(--color-text-secondary)]">Every number and chart on the Model &amp; evidence page.</p>
              <TermList terms={METRIC_GLOSSARY} />
            </div>
          )}

          {tab === 'safety' && (
            <div className="flex flex-col gap-6">
              <section>
                <h2 className="font-display mb-2 text-[16px] font-semibold">This is a decision-support tool, not a diagnosis</h2>
                <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                  Every screen in this app carries a line saying its output requires review and sign-off by a licensed physician. That's not boilerplate —
                  the model can be wrong, and a "High" result is a prompt to investigate further, not a diagnosis on its own.
                </p>
              </section>
              <section>
                <h2 className="font-display mb-2 text-[16px] font-semibold">Known limits, stated plainly</h2>
                <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                  <li>This is a research prototype trained on a US national health survey (NHANES, 2005–2018) — it has not been validated for clinical use in any specific hospital or population.</li>
                  <li>The heart-disease label in the training data is self-reported by patients, not confirmed by a doctor's record.</li>
                  <li>In "Strict" mode, the model never uses a lab value to predict the exact condition that lab defines. "Full" mode does, and looks more accurate as a result — but that's partly an artefact, not proof of a better model. Strict mode is the honest comparison.</li>
                  <li>Roughly a third to a half of patients get marked "Uncertain" on any one disease — that's the model being honest about the accuracy it actually has, not a bug.</li>
                </ul>
              </section>
              <section>
                <p className="text-[13px] text-[var(--color-text-secondary)]">
                  Still confused about something? Head back to <button type="button" onClick={() => go('settings')} className="text-[var(--color-brand)] underline">Settings</button> to see what mode you're in, or re-read this page — every tab covers a different part of the app.
                </p>
              </section>
            </div>
          )}
        </div>
      </TabShell>
    </div>
  )
}
