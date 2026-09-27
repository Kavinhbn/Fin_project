// ─── MOCK API ───
// Demo data only: risks are a fixed heuristic, NOT a trained model, and every metric on the
// Model & Evidence page is a placeholder. The UI shows a "Demo data" banner in this mode.
// Role can be switched for testing with ?role=viewer|admin|clinician.
import { validateInput } from './ranges'
import { ApiError } from './types'
import type {
  Api, Assessment, AuditEntry, Disease, DiseaseExplanation, DiseaseRisk, Driver, FeatureMode,
  Level, Me, ModelCard, Note, PatientInput, Role,
} from './types'

const DISCLAIMER =
  'This output comes from an assistive Decision Support Tool. It is not a diagnosis and requires review and sign-off by a licensed physician.'
const MODEL_VERSION = 'demo-0.0.0'
const LATENCY_MS = 250

const wait = (ms = LATENCY_MS): Promise<void> => new Promise((r) => setTimeout(r, ms))
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x))

// ─── Heuristic scoring (mock only; the backend decides real levels) ───
interface Term { feature: string; weight: number; read: (i: PatientInput) => number | null; fmt: (v: number) => string; ref: number }

const TERMS: Record<Disease, Term[]> = {
  diabetes: [
    { feature: 'BMI', weight: 0.09, read: (i) => i.bmi, fmt: (v) => `${v} kg/m²`, ref: 26 },
    { feature: 'Age', weight: 0.03, read: (i) => i.age, fmt: (v) => `${v} y`, ref: 45 },
    { feature: 'HbA1c', weight: 1.4, read: (i) => i.hba1c, fmt: (v) => `${v}%`, ref: 5.4 },
    { feature: 'Fasting glucose', weight: 0.03, read: (i) => i.fasting_glucose, fmt: (v) => `${v} mg/dL`, ref: 95 },
    { feature: 'Triglycerides', weight: 0.004, read: (i) => i.triglycerides, fmt: (v) => `${v} mg/dL`, ref: 130 },
    { feature: 'HDL cholesterol', weight: -0.03, read: (i) => i.hdl, fmt: (v) => `${v} mg/dL`, ref: 50 },
  ],
  hypertension: [
    { feature: 'Age', weight: 0.045, read: (i) => i.age, fmt: (v) => `${v} y`, ref: 45 },
    { feature: 'BMI', weight: 0.08, read: (i) => i.bmi, fmt: (v) => `${v} kg/m²`, ref: 26 },
    { feature: 'Systolic BP', weight: 0.05, read: (i) => i.sbp, fmt: (v) => `${v} mmHg`, ref: 120 },
    { feature: 'Diastolic BP', weight: 0.05, read: (i) => i.dbp, fmt: (v) => `${v} mmHg`, ref: 80 },
    { feature: 'LDL cholesterol', weight: 0.006, read: (i) => i.ldl, fmt: (v) => `${v} mg/dL`, ref: 110 },
  ],
  cvd: [
    { feature: 'Age', weight: 0.06, read: (i) => i.age, fmt: (v) => `${v} y`, ref: 45 },
    { feature: 'Smoking', weight: 0.9, read: (i) => (i.smoker === null ? null : i.smoker ? 1 : 0), fmt: (v) => (v ? 'Current/former' : 'Never'), ref: 0 },
    { feature: 'Total cholesterol', weight: 0.006, read: (i) => i.total_cholesterol, fmt: (v) => `${v} mg/dL`, ref: 190 },
    { feature: 'HDL cholesterol', weight: -0.03, read: (i) => i.hdl, fmt: (v) => `${v} mg/dL`, ref: 50 },
    { feature: 'BMI', weight: 0.05, read: (i) => i.bmi, fmt: (v) => `${v} kg/m²`, ref: 26 },
  ],
}
const INTERCEPT: Record<Disease, number> = { diabetes: -1.6, hypertension: -1.2, cvd: -3.0 }
const STRICT_HIDDEN: Record<Disease, string[]> = {
  diabetes: ['HbA1c', 'Fasting glucose'],
  hypertension: ['Systolic BP', 'Diastolic BP'],
  cvd: [],
}

function levelFor(p: number): Level {
  if (Math.abs(p - 0.5) < 0.06) return 'uncertain'
  if (p < 0.2) return 'low'
  if (p < 0.5) return 'moderate'
  return 'high'
}

function score(disease: Disease, input: PatientInput, mode: FeatureMode, dmP = 0, htnP = 0) {
  const hidden = mode === 'strict' ? STRICT_HIDDEN[disease] : []
  let logit = INTERCEPT[disease] + (input.sex === 'male' ? 0.25 : 0)
  const drivers: Driver[] = []
  for (const term of TERMS[disease]) {
    if (hidden.includes(term.feature)) continue
    const raw = term.read(input)
    if (raw === null) continue
    const contribution = term.weight * (raw - term.ref)
    logit += contribution
    drivers.push({ feature: term.feature, value: term.fmt(raw), contribution: Number(contribution.toFixed(3)) })
  }
  if (disease === 'cvd') {
    const dm = 1.1 * dmP
    const htn = 0.9 * htnP
    logit += dm + htn
    drivers.push({ feature: 'Diabetes (predicted)', value: `${Math.round(dmP * 100)}%`, contribution: Number(dm.toFixed(3)) })
    drivers.push({ feature: 'Hypertension (predicted)', value: `${Math.round(htnP * 100)}%`, contribution: Number(htn.toFixed(3)) })
  }
  const p = Number(sigmoid(logit).toFixed(3))
  const half = 0.06
  const risk: DiseaseRisk = {
    probability: p,
    ci: [Number(Math.max(0, p - half).toFixed(3)), Number(Math.min(1, p + half).toFixed(3))],
    level: levelFor(p),
  }
  const sorted = [...drivers].sort((a, b) => b.contribution - a.contribution)
  const explanation: DiseaseExplanation = {
    positive: sorted.filter((d) => d.contribution > 0).slice(0, 3),
    negative: sorted.filter((d) => d.contribution < 0).slice(-3).reverse(),
  }
  return { risk, explanation }
}

function buildAssessment(id: string, input: PatientInput, mode: FeatureMode, by: string, createdAt: string): Assessment {
  const dm = score('diabetes', input, mode)
  const htn = score('hypertension', input, mode)
  const cvd = score('cvd', input, mode, dm.risk.probability, htn.risk.probability)
  const dmShare = 1.1 * dm.risk.probability
  const htnShare = 0.9 * htn.risk.probability
  const directShare = Math.max(0.05, cvd.explanation.positive.filter((d) => !d.feature.includes('(predicted)')).reduce((s, d) => s + d.contribution, 0))
  const total = dmShare + htnShare + directShare
  return {
    id, version: 1, created_at: createdAt, created_by: by, mode, input,
    risks: { diabetes: dm.risk, hypertension: htn.risk, cvd: cvd.risk },
    explanation: { diabetes: dm.explanation, hypertension: htn.explanation, cvd: cvd.explanation },
    cvd_pathways: {
      direct: Number((directShare / total).toFixed(3)),
      via_diabetes: Number((dmShare / total).toFixed(3)),
      via_hypertension: Number((htnShare / total).toFixed(3)),
    },
    model_version: MODEL_VERSION, disclaimer: DISCLAIMER, note: null,
  }
}

function buildNote(a: Assessment): Note {
  const pct = (d: Disease): string => `${Math.round(a.risks[d].probability * 100)}%`
  const top = (d: Disease): string => a.explanation[d].positive.map((x) => `${x.feature} (${x.value})`).join(', ') || 'no dominant factor'
  const flagged = a.id.endsWith('3') ? [{ claim: 'Risk is driven mainly by smoking.', reason: 'Smoking is not among the top-3 positive contributors for CVD.' }] : []
  return {
    generated_at: new Date().toISOString(),
    reviewed_by: null,
    verifier: { checked: 9, passed: 9 - flagged.length, flagged },
    sections: [
      { title: 'Primary Clinical Assessment', body: `Estimated probabilities: diabetes ${pct('diabetes')}, hypertension ${pct('hypertension')}, cardiovascular disease ${pct('cvd')}. Findings are model estimates for physician review.` },
      { title: 'Identified Risk Catalysts', body: `Diabetes: ${top('diabetes')}. Hypertension: ${top('hypertension')}. CVD: ${top('cvd')}.` },
      { title: 'Cross-Disease Impact', body: `About ${Math.round(a.cvd_pathways.via_diabetes * 100)}% of the modelled CVD risk operates through predicted diabetes and ${Math.round(a.cvd_pathways.via_hypertension * 100)}% through predicted hypertension. This is a model-based decomposition, not proof of causation.` },
      { title: 'Recommended Next Steps', body: 'For physician consideration: confirm with fasting glucose or HbA1c and repeated blood-pressure readings, review the lipid panel, and discuss lifestyle measures. Treatment decisions rest with the clinician.' },
    ],
  }
}

// ─── In-memory state ───
const SEED_INPUTS: PatientInput[] = [
  { age: 62, sex: 'male', bmi: 31.2, sbp: 148, dbp: 92, fasting_glucose: 132, hba1c: 6.9, total_cholesterol: 232, hdl: 38, ldl: 150, triglycerides: 210, smoker: true, race_ethnicity: null, education: null, income_ratio: null, vigorous_activity: null, alcohol_12plus: null },
  { age: 34, sex: 'female', bmi: 22.4, sbp: 112, dbp: 72, fasting_glucose: 86, hba1c: 5.1, total_cholesterol: 170, hdl: 62, ldl: 92, triglycerides: 90, smoker: false, race_ethnicity: null, education: null, income_ratio: null, vigorous_activity: null, alcohol_12plus: null },
  { age: 55, sex: 'female', bmi: 29.8, sbp: 138, dbp: 86, fasting_glucose: 108, hba1c: 5.9, total_cholesterol: 205, hdl: 46, ldl: 128, triglycerides: 165, smoker: false, race_ethnicity: null, education: null, income_ratio: null, vigorous_activity: null, alcohol_12plus: null },
  { age: 71, sex: 'male', bmi: 27.5, sbp: 156, dbp: 88, fasting_glucose: 101, hba1c: 5.7, total_cholesterol: 198, hdl: 44, ldl: 122, triglycerides: 150, smoker: true, race_ethnicity: null, education: null, income_ratio: null, vigorous_activity: null, alcohol_12plus: null },
  { age: 47, sex: 'male', bmi: 34.6, sbp: 130, dbp: 84, fasting_glucose: 118, hba1c: 6.2, total_cholesterol: 215, hdl: 36, ldl: 138, triglycerides: 240, smoker: false, race_ethnicity: null, education: null, income_ratio: null, vigorous_activity: null, alcohol_12plus: null },
  { age: 29, sex: 'female', bmi: 24.1, sbp: 108, dbp: 68, fasting_glucose: 84, hba1c: 5.0, total_cholesterol: 160, hdl: 66, ldl: 84, triglycerides: 80, smoker: false, race_ethnicity: null, education: null, income_ratio: null, vigorous_activity: null, alcohol_12plus: null },
  { age: 66, sex: 'female', bmi: 26.9, sbp: 142, dbp: 82, fasting_glucose: 99, hba1c: 5.6, total_cholesterol: 224, hdl: 52, ldl: 140, triglycerides: 140, smoker: null, race_ethnicity: null, education: null, income_ratio: null, vigorous_activity: null, alcohol_12plus: null },
  { age: 58, sex: 'male', bmi: 30.4, sbp: 126, dbp: 80, fasting_glucose: 124, hba1c: 6.4, total_cholesterol: 240, hdl: 40, ldl: 160, triglycerides: 260, smoker: true, race_ethnicity: null, education: null, income_ratio: null, vigorous_activity: null, alcohol_12plus: null },
]

let counter = 0
const nextId = (): string => `A-${String(1000 + ++counter)}`
const db = new Map<string, Assessment>()
const auditLog: AuditEntry[] = []

function addAudit(a: Assessment, user: string, verifier: AuditEntry['verifier'] = 'not_run'): void {
  auditLog.unshift({
    id: `E-${auditLog.length + 1}`, timestamp: new Date().toISOString(), user,
    model_version: a.model_version, input_hash: hash(JSON.stringify(a.input) + a.mode), verifier,
  })
}

function hash(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(16).padStart(8, '0')
}

SEED_INPUTS.forEach((input, i) => {
  const mode: FeatureMode = i % 4 === 3 ? 'full' : 'strict'
  const created = new Date(Date.now() - (i + 1) * 3_600_000 * 7).toISOString()
  const a = buildAssessment(nextId(), input, mode, 'dr.rao@example.org', created)
  db.set(a.id, a)
  addAudit(a, 'dr.rao@example.org')
})

function currentRole(): Role {
  const r = new URLSearchParams(window.location.search).get('role')
  return r === 'viewer' || r === 'admin' ? r : 'clinician'
}

function requireWrite(): Me {
  const me = meNow()
  if (me.role === 'viewer') throw new ApiError(403, 'Your role is read-only.')
  return me
}

function meNow(): Me {
  const role = currentRole()
  return { email: `${role}@example.org`, name: role === 'admin' ? 'Admin User' : role === 'viewer' ? 'Examiner (read-only)' : 'Dr. A. Rao', role }
}

export const mockApi: Api = {
  isMock: true,
  async me() { await wait(120); return meNow() },
  async disclaimer() { return DISCLAIMER },
  async notice() { return null },
  async createAssessment(input, mode) {
    await wait()
    const me = requireWrite()
    const errors = validateInput(input)
    if (Object.keys(errors).length) throw new ApiError(422, 'Some fields are invalid', errors)
    const a = buildAssessment(nextId(), input, mode, me.email, new Date().toISOString())
    db.set(a.id, a)
    addAudit(a, me.email)
    return a
  },
  async listAssessments(mode) {
    await wait()
    return [...db.values()].filter((a) => a.mode === mode).sort((x, y) => y.created_at.localeCompare(x.created_at))
  },
  async getAssessment(id) {
    await wait(150)
    const a = db.get(id)
    if (!a) throw new ApiError(404, 'Assessment not found')
    return a
  },
  async generateNote(id) {
    await wait(700)
    const me = requireWrite()
    const a = db.get(id)
    if (!a) throw new ApiError(404, 'Assessment not found')
    const next: Assessment = { ...a, version: a.version + 1, note: buildNote(a) }
    db.set(id, next)
    addAudit(next, me.email, next.note && next.note.verifier.flagged.length ? 'flagged' : 'passed')
    return next
  },
  async markReviewed(id, version) {
    await wait(400)
    const me = requireWrite()
    const a = db.get(id)
    if (!a || !a.note) throw new ApiError(404, 'No note to review')
    if (a.version !== version) throw new ApiError(409, 'This assessment changed since you opened it. Reload and try again.')
    const next: Assessment = { ...a, version: a.version + 1, note: { ...a.note, reviewed_by: me.email } }
    db.set(id, next)
    return next
  },
  async modelCard(mode) {
    await wait()
    const bump = mode === 'full' ? 0.06 : 0
    const card: ModelCard = {
      model_version: MODEL_VERSION, mode,
      metrics: [
        { label: 'Macro AUROC', value: 0.8 + bump, ci: [0.77 + bump, 0.83 + bump] },
        { label: 'Macro F1', value: 0.6 + bump, ci: [0.56 + bump, 0.64 + bump] },
        { label: 'Calibration error (ECE)', value: 0.03, ci: [0.02, 0.045] },
        { label: 'Conformal coverage', value: 0.9, ci: [0.88, 0.92] },
      ],
      calibration: Array.from({ length: 10 }, (_, i) => ({ predicted: (i + 0.5) / 10, observed: Math.min(1, Math.max(0, (i + 0.5) / 10 + (i % 3 - 1) * 0.02)) })),
      subgroups: [
        { group: 'Female', n: 4210, auroc: 0.81 + bump, ece: 0.03 },
        { group: 'Male', n: 4098, auroc: 0.79 + bump, ece: 0.032 },
        { group: 'Age 18–39', n: 2650, auroc: 0.83 + bump, ece: 0.028 },
        { group: 'Age 40–64', n: 3902, auroc: 0.79 + bump, ece: 0.031 },
        { group: 'Age 65+', n: 1756, auroc: 0.74 + bump, ece: 0.041 },
      ],
      baselines: [
        { model: 'Independent XGBoost', diabetes: 0.80 + bump, hypertension: 0.78 + bump, cvd: 0.79 + bump },
        { model: 'Random Forest', diabetes: 0.79 + bump, hypertension: 0.77 + bump, cvd: 0.78 + bump },
        { model: 'Cascade (this system)', diabetes: 0.80 + bump, hypertension: 0.78 + bump, cvd: 0.82 + bump },
      ],
    }
    return card
  },
  async audit() {
    await wait()
    if (meNow().role !== 'admin') throw new ApiError(403, 'The audit log is available to administrators only.')
    return [...auditLog]
  },
}
