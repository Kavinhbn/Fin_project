import { useState } from 'react'
import { api } from '../../api/client'
import { RANGES, validateInput } from '../../api/ranges'
import { ApiError, EDUCATION_OPTIONS, RACE_ETHNICITY_OPTIONS } from '../../api/types'
import type { Assessment, Disease, FeatureMode, PatientInput } from '../../api/types'
import { invalidate } from '../../api/cache'
import { PageHeader } from '../../app/PageHeader'
import { useApp } from '../../app/context'
import { DISEASE_LABEL, RiskRow } from '../../charts/RiskBar'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import type { FieldSchema } from '../../ui/Field'
import { useFeedback } from '../../ui/Feedback'
import { SplitPane } from '../../ui/Layout'
import { EmptyState, RoleNotice, SkeletonRows } from '../../ui/States'

// ─── Form schema (one generic renderer) ───
const range = (k: keyof typeof RANGES): string => `${RANGES[k][0]}–${RANGES[k][1]}`

// Every `help` string here is the short, plain-language explanation also shown in full (with
// a "why it matters" line) on the Help & glossary page — see features/help/content.ts.
const SCHEMA: readonly FieldSchema[] = [
  { kind: 'number', name: 'age', label: 'Age', unit: 'years', hint: range('age'), required: true },
  { kind: 'radio', name: 'sex', label: 'Sex', required: true, options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] },
  { kind: 'number', name: 'bmi', label: 'BMI', unit: 'kg/m²', hint: range('bmi'), required: true, help: 'Body Mass Index — a simple number from weight and height that estimates body fat.' },
  { kind: 'number', name: 'sbp', label: 'Systolic BP', unit: 'mmHg', hint: range('sbp'), help: 'The top (higher) number in a blood pressure reading — the pressure when the heart beats.' },
  { kind: 'number', name: 'dbp', label: 'Diastolic BP', unit: 'mmHg', hint: range('dbp'), help: 'The bottom (lower) number in a blood pressure reading — the pressure when the heart rests between beats.' },
  { kind: 'number', name: 'fasting_glucose', label: 'Fasting glucose', unit: 'mg/dL', hint: range('fasting_glucose'), help: 'Blood sugar level measured after not eating for several hours (usually overnight).' },
  { kind: 'number', name: 'hba1c', label: 'HbA1c', unit: '%', hint: range('hba1c'), help: 'A blood test showing average blood sugar over the past 2–3 months, not just right now.' },
  { kind: 'number', name: 'total_cholesterol', label: 'Total cholesterol', unit: 'mg/dL', hint: range('total_cholesterol'), help: 'The overall amount of cholesterol (a fat-like substance) in the blood.' },
  { kind: 'number', name: 'hdl', label: 'HDL', unit: 'mg/dL', hint: range('hdl'), help: 'The "good" cholesterol — it helps clear other cholesterol out of the blood. Low HDL raises risk.' },
  { kind: 'number', name: 'ldl', label: 'LDL', unit: 'mg/dL', hint: range('ldl'), help: 'The "bad" cholesterol — the kind that builds up in artery walls.' },
  { kind: 'number', name: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', hint: range('triglycerides'), help: 'Another type of fat carried in the blood, separate from cholesterol.' },
  { kind: 'radio', name: 'smoker', label: 'Smoking', options: [{ value: 'yes', label: 'Current or former smoker' }, { value: 'no', label: 'Never smoked' }, { value: '', label: 'Unknown' }] },
]

// Optional fields not part of a routine checkup, but that measurably improve model accuracy
// when available (see PROJECT_PLAN.md). Never required.
const OPTIONAL_SCHEMA: readonly FieldSchema[] = [
  { kind: 'radio', name: 'race_ethnicity', label: 'Race / ethnicity', help: 'From the checkup record. Including it measurably improves the model\'s accuracy on the population it was trained on.', options: [{ value: '', label: 'Prefer not to say' }, ...RACE_ETHNICITY_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))] },
  { kind: 'radio', name: 'education', label: 'Education', help: 'Highest level of school completed. Correlates with lifestyle and healthcare-access patterns linked to risk.', options: [{ value: '', label: 'Prefer not to say' }, ...EDUCATION_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))] },
  { kind: 'number', name: 'income_ratio', label: 'Income-to-poverty ratio', hint: `${RANGES.income_ratio[0]}–${RANGES.income_ratio[1]}, higher is wealthier`, help: 'Household income compared to the poverty line — 1.0 means exactly at the line, higher means wealthier. Capped at 5.' },
  { kind: 'radio', name: 'vigorous_activity', label: 'Regular vigorous activity', help: 'Regularly doing hard exercise — the kind that gets you breathing heavily (running, heavy lifting, fast cycling).', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: '', label: 'Unknown' }] },
  { kind: 'radio', name: 'alcohol_12plus', label: 'Regular alcohol use (12+ drinks/year)', help: 'Whether the patient has had 12 or more alcoholic drinks in the past year.', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: '', label: 'Unknown' }] },
]

type FormValues = Record<string, string>
const ALL_SCHEMA: readonly FieldSchema[] = [...SCHEMA, ...OPTIONAL_SCHEMA]
const EMPTY: FormValues = Object.fromEntries(ALL_SCHEMA.map((f) => [f.name, '']))
const int = (s: string | undefined): number | null => (s === undefined || s.trim() === '' ? null : Number.parseInt(s, 10))
const bool3 = (s: string | undefined): boolean | null => (s === 'yes' ? true : s === 'no' ? false : null)

const num = (s: string | undefined): number | null => (s === undefined || s.trim() === '' ? null : Number(s))

function toInput(v: FormValues): PatientInput {
  return {
    age: num(v.age) ?? Number.NaN,
    sex: v.sex === 'male' ? 'male' : 'female',
    bmi: num(v.bmi) ?? Number.NaN,
    sbp: num(v.sbp), dbp: num(v.dbp), fasting_glucose: num(v.fasting_glucose), hba1c: num(v.hba1c),
    total_cholesterol: num(v.total_cholesterol), hdl: num(v.hdl), ldl: num(v.ldl), triglycerides: num(v.triglycerides),
    smoker: bool3(v.smoker),
    race_ethnicity: int(v.race_ethnicity), education: int(v.education), income_ratio: num(v.income_ratio),
    vigorous_activity: bool3(v.vigorous_activity), alcohol_12plus: bool3(v.alcohol_12plus),
  }
}

const DISEASES: readonly Disease[] = ['diabetes', 'hypertension', 'cvd']

// ─── Screen ───
export function AssessScreen() {
  const { mode, canWrite, me, openAssessment } = useApp()
  const { toast } = useFeedback()
  const [values, setValues] = useState<FormValues>({ ...EMPTY, sex: 'female' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [stored, setResult] = useState<{ assessment: Assessment; mode: FeatureMode } | undefined>()
  // A result is only shown while it still matches the selected mode; any input edit clears it.
  const result = stored && stored.mode === mode ? stored.assessment : undefined

  const onChange = (name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== name)))
    setResult(undefined)
  }

  const submit = async () => {
    const input = toInput(values)
    const found = validateInput(input)
    if (Object.keys(found).length) { setErrors(found); return }
    setLoading(true)
    try {
      const a = await api.createAssessment(input, mode)
      invalidate('assessments:')
      invalidate('audit')
      setResult({ assessment: a, mode })
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrors(e.fieldErrors)
      else toast(e instanceof Error ? e.message : 'Could not create the assessment', 'error')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setValues({ ...EMPTY, sex: 'female' }); setErrors({}); setResult(undefined) }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-6">
      <PageHeader title="New assessment" subtitle="Enter routine checkup values to estimate diabetes, hypertension and CVD risk together." />
      {!canWrite && <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]"><RoleNotice>Signed in as {me.email} with a read-only role. You can review existing assessments but not create new ones.</RoleNotice></div>}
      <div className="flex shrink-0 flex-col">
        <SplitPane
          natural
          left={
            <form className="flex flex-col" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate aria-label="Patient values">
              <div className="border-b border-[var(--color-border)] px-6 py-4">
                <h2 className="font-display text-[16px] font-semibold">Patient values</h2>
                <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Optional labs may be left blank. In strict mode, glucose and blood pressure are not used to predict their own condition.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
                {SCHEMA.map((f) => <Field key={f.name} schema={f} value={values[f.name] ?? ''} error={errors[f.name]} disabled={!canWrite || loading} onChange={onChange} />)}
              </div>
              <div className="border-t border-[var(--color-border)] px-6 py-4">
                <h2 className="font-display text-[13px] font-semibold">Optional: socioeconomic and lifestyle</h2>
                <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Not part of a routine checkup, but measurably improve the model&apos;s accuracy when available. Leave blank if unknown.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 px-6 pb-5 sm:grid-cols-2">
                {OPTIONAL_SCHEMA.map((f) => <Field key={f.name} schema={f} value={values[f.name] ?? ''} error={errors[f.name]} disabled={!canWrite || loading} onChange={onChange} />)}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-6 py-3">
                <Button type="button" onClick={reset} disabled={loading}>Clear</Button>
                <Button type="submit" variant="primary" loading={loading} disabled={!canWrite}>Estimate risk</Button>
              </div>
            </form>
          }
          right={
            <div className="flex flex-col">
              <div className="border-b border-[var(--color-border)] px-6 py-4">
                <h2 className="font-display text-[16px] font-semibold">Estimated risk</h2>
                <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Joint estimate for the three conditions. Mode: {(result ? stored?.mode : mode) === 'strict' ? 'Strict (leakage-free)' : 'Full features'}.</p>
              </div>
              {loading ? <SkeletonRows rows={5} /> : !result ? (
                <EmptyState title="No estimate yet" hint="Fill in the patient values and select Estimate risk." />
              ) : (
                <div className="anim-fade px-6 py-2">
                  <div className="divide-y divide-[var(--color-border)]">
                    {DISEASES.map((d) => <RiskRow key={d} disease={d} risk={result.risks[d]} />)}
                  </div>
                  <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                    <div className="eyebrow mb-2">Strongest driver per condition</div>
                    <ul className="flex flex-col gap-1 text-[12px]">
                      {DISEASES.map((d) => {
                        const top = result.explanation[d].positive[0]
                        return <li key={d} className="flex justify-between gap-3"><span className="text-[var(--color-text-secondary)]">{DISEASE_LABEL[d]}</span><span className="font-medium">{top ? `${top.feature} (${top.value})` : 'None'}</span></li>
                      })}
                    </ul>
                  </div>
                  <div className="flex justify-end py-4">
                    <Button variant="primary" onClick={() => openAssessment(result.id)}>Open full assessment</Button>
                  </div>
                </div>
              )}
            </div>
          }
        />
      </div>
    </div>
  )
}
