// ─── Domain types (mirror api/schemas.py in the Python backend) ───

export type Disease = 'diabetes' | 'hypertension' | 'cvd'
export type Level = 'low' | 'moderate' | 'high' | 'uncertain' | 'not_assessed'
export type Role = 'clinician' | 'viewer' | 'admin'
export type FeatureMode = 'strict' | 'full'
export type Sex = 'male' | 'female'

export interface Me {
  email: string
  name: string
  role: Role
}

export interface PatientInput {
  age: number
  sex: Sex
  bmi: number
  sbp: number | null
  dbp: number | null
  fasting_glucose: number | null
  hba1c: number | null
  total_cholesterol: number | null
  hdl: number | null
  ldl: number | null
  triglycerides: number | null
  smoker: boolean | null
  // Optional socioeconomic/lifestyle fields: improve accuracy when provided, never required.
  race_ethnicity: number | null
  education: number | null
  income_ratio: number | null
  vigorous_activity: boolean | null
  alcohol_12plus: boolean | null
}

export const RACE_ETHNICITY_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 1, label: 'Mexican American' },
  { value: 2, label: 'Other Hispanic' },
  { value: 3, label: 'Non-Hispanic White' },
  { value: 4, label: 'Non-Hispanic Black' },
  { value: 5, label: 'Other / multiracial' },
]

export const EDUCATION_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 1, label: 'Less than 9th grade' },
  { value: 2, label: '9th-11th grade' },
  { value: 3, label: 'High school graduate / GED' },
  { value: 4, label: 'Some college or AA degree' },
  { value: 5, label: 'College graduate or above' },
]

export interface DiseaseRisk {
  probability: number
  ci: [number, number] | null
  level: Level
  uncertain?: boolean
}

export interface Driver {
  feature: string
  value: string
  contribution: number
}

export interface DiseaseExplanation {
  positive: Driver[]
  negative: Driver[]
}

export interface CvdPathways {
  direct: number
  via_diabetes: number
  via_hypertension: number
}

export interface NoteSection {
  title: string
  body: string
}

export interface FlaggedClaim {
  claim: string
  reason: string
}

export interface Note {
  sections: NoteSection[]
  generated_at: string
  verifier: { checked: number; passed: number; flagged: FlaggedClaim[] }
  reviewed_by: string | null
}

export interface Assessment {
  id: string
  version: number
  created_at: string
  created_by: string
  mode: FeatureMode
  input: PatientInput
  risks: Record<Disease, DiseaseRisk>
  explanation: Record<Disease, DiseaseExplanation>
  cvd_pathways: CvdPathways
  model_version: string
  disclaimer: string
  note: Note | null
}

export interface Metric {
  label: string
  value: number
  ci: [number, number]
}

export interface SubgroupRow {
  group: string
  n: number
  auroc: number
  ece: number
}

export interface BaselineRow {
  model: string
  diabetes: number
  hypertension: number
  cvd: number
}

export interface ModelCard {
  model_version: string
  mode: FeatureMode
  metrics: Metric[]
  calibration: { predicted: number; observed: number }[]
  subgroups: SubgroupRow[]
  baselines: BaselineRow[]
}

export interface AuditEntry {
  id: string
  timestamp: string
  user: string
  model_version: string
  input_hash: string
  verifier: 'passed' | 'flagged' | 'not_run'
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export interface AuthConfig {
  mode: 'dev' | 'iap' | 'mock'
}

export interface Api {
  isMock: boolean
  me(): Promise<Me>
  authConfig(): Promise<AuthConfig>
  /** Dev mode only; the backend 404s this outside dev mode. */
  devLogin(name: string, role: Role): Promise<Me>
  disclaimer(): Promise<string>
  notice(): Promise<string | null>
  createAssessment(input: PatientInput, mode: FeatureMode): Promise<Assessment>
  listAssessments(mode: FeatureMode): Promise<Assessment[]>
  getAssessment(id: string): Promise<Assessment>
  generateNote(id: string): Promise<Assessment>
  markReviewed(id: string, version: number): Promise<Assessment>
  modelCard(mode: FeatureMode): Promise<ModelCard>
  audit(): Promise<AuditEntry[]>
}
