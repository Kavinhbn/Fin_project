// ─── Plausible clinical ranges ───
// Copied from common/config.py CLINICAL_RANGES. Keep in sync: the backend is authoritative
// and re-validates every request; these only give instant feedback.
import type { PatientInput } from './types'

export const RANGES = {
  age: [18, 110],
  bmi: [10, 80],
  sbp: [60, 260],
  dbp: [30, 150],
  fasting_glucose: [30, 600],
  hba1c: [3, 20],
  total_cholesterol: [50, 500],
  hdl: [10, 150],
  ldl: [10, 400],
  triglycerides: [20, 2000],
  income_ratio: [0, 5],
} as const satisfies Record<string, readonly [number, number]>

export type RangedField = keyof typeof RANGES

export function validateInput(input: PatientInput): Record<string, string> {
  const errors: Record<string, string> = {}
  const values: Record<RangedField, number | null> = {
    age: input.age, bmi: input.bmi, sbp: input.sbp, dbp: input.dbp,
    fasting_glucose: input.fasting_glucose, hba1c: input.hba1c,
    total_cholesterol: input.total_cholesterol, hdl: input.hdl, ldl: input.ldl,
    triglycerides: input.triglycerides, income_ratio: input.income_ratio,
  }
  for (const key of Object.keys(RANGES) as RangedField[]) {
    const value = values[key]
    const [low, high] = RANGES[key]
    if (value === null || Number.isNaN(value)) {
      if (key === 'age' || key === 'bmi') errors[key] = 'Required'
      continue
    }
    if (value < low || value > high) errors[key] = `Must be between ${low} and ${high}`
  }
  if (input.sbp !== null && input.dbp !== null && input.sbp <= input.dbp) {
    errors.sbp = 'sbp must be greater than dbp'
  }
  return errors
}
