import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { FeatureMode, Me } from '../api/types'
import { AssessScreen } from '../features/assess/AssessScreen'
import { AssessmentsScreen } from '../features/assessments/AssessmentsScreen'
import { AuditScreen } from '../features/audit/AuditScreen'
import { EvidenceScreen } from '../features/evidence/EvidenceScreen'
import { FeedbackProvider } from '../ui/Feedback'
import { ErrorState, SkeletonRows } from '../ui/States'
import { TooltipProvider } from '../ui/Tooltip'
import { AppContext } from './context'
import type { AppState, Screen } from './context'
import { Sidebar } from './Sidebar'

// ─── App shell ───
export function App() {
  const [me, setMe] = useState<Me | undefined>()
  const [disclaimer, setDisclaimer] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | undefined>()
  const [mode, setMode] = useState<FeatureMode>('strict')
  const [screen, setScreen] = useState<Screen>('assess')
  const [openId, setOpenId] = useState<string | null>(null)

  const boot = () => {
    setError(undefined)
    Promise.all([api.me(), api.disclaimer(), api.notice()])
      .then(([m, d, n]) => { setMe(m); setDisclaimer(d); setNotice(n) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not reach the service'))
  }
  useEffect(boot, [])

  const state = useMemo<AppState | undefined>(() => {
    if (!me) return undefined
    return {
      me, mode, setMode, disclaimer, isMock: api.isMock, screen,
      go: (s) => { setScreen(s); if (s !== 'assessments') setOpenId(null) },
      openId, openAssessment: (id) => { setOpenId(id); if (id) setScreen('assessments') },
      canWrite: me.role !== 'viewer',
    }
  }, [me, mode, disclaimer, screen, openId])

  if (error) return <div className="flex h-full items-center justify-center"><ErrorState message={error} onRetry={boot} /></div>
  if (!state) return <div className="mx-auto max-w-3xl pt-16"><SkeletonRows rows={5} /></div>

  return (
    <AppContext.Provider value={state}>
      <TooltipProvider>
        <FeedbackProvider>
          <div className="flex h-full">
            <Sidebar />
            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
              {(state.isMock || notice) && (
                <div
                  title={state.isMock ? 'Demo data: risks come from a placeholder heuristic and all evidence figures are placeholders. They are not model results.' : (notice ?? undefined)}
                  className="truncate border-b border-[var(--color-border)] bg-[var(--color-muted-bg)] px-3 py-1 text-[10px] text-[var(--color-text-secondary)] sm:whitespace-normal sm:px-6 sm:py-1.5 sm:text-[11px]"
                >
                  {state.isMock
                    ? 'Demo data: risks come from a placeholder heuristic and all evidence figures are placeholders. They are not model results.'
                    : notice}
                </div>
              )}
              <div role="note" className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[10px] font-medium text-[var(--color-text-primary)] sm:px-6 sm:py-1.5 sm:text-[11px]">
                {state.disclaimer}
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                {state.screen === 'assess' && <AssessScreen />}
                {state.screen === 'assessments' && <AssessmentsScreen />}
                {state.screen === 'evidence' && <EvidenceScreen />}
                {state.screen === 'audit' && <AuditScreen />}
              </div>
            </main>
          </div>
        </FeedbackProvider>
      </TooltipProvider>
    </AppContext.Provider>
  )
}
