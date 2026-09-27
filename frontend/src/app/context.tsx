import { createContext, useContext } from 'react'
import type { FeatureMode, Me } from '../api/types'

// ─── App-wide context: identity (server claims), feature mode, navigation ───
export type Screen = 'assess' | 'assessments' | 'evidence' | 'audit'

export interface AppState {
  me: Me
  mode: FeatureMode
  setMode: (m: FeatureMode) => void
  disclaimer: string
  isMock: boolean
  screen: Screen
  go: (s: Screen) => void
  openId: string | null
  openAssessment: (id: string | null) => void
  canWrite: boolean
}

export const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppContext.Provider')
  return ctx
}

export const PRODUCT_NAME = 'Triad'
export const PRODUCT_TAGLINE = 'Comorbidity risk intelligence'
