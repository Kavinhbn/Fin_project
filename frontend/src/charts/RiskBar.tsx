import type { Disease, DiseaseRisk } from '../api/types'
import { StatusBadge } from '../ui/StatusBadge'

// ─── RiskBar: name, monospace probability, plain bar, level badge (never colour alone) ───
export const DISEASE_LABEL: Record<Disease, string> = {
  diabetes: 'Diabetes',
  hypertension: 'Hypertension',
  cvd: 'Cardiovascular disease',
}

export function RiskRow({ disease, risk }: { disease: Disease; risk: DiseaseRisk }) {
  const pct = Math.round(risk.probability * 100)
  const interval = risk.ci ? risk.ci.map((v) => Math.round(v * 100)) : null
  return (
    <div className="flex flex-col gap-2 py-3" data-testid={`risk-${disease}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{DISEASE_LABEL[disease]}</span>
        <span className="flex items-center gap-1.5">
          <StatusBadge status={risk.level} />
          {risk.uncertain && risk.level !== 'uncertain' && <StatusBadge status="uncertain" />}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative h-2 flex-1 rounded-full bg-[var(--color-bg)]" role="img" aria-label={`${DISEASE_LABEL[disease]} probability ${pct} percent${interval ? `, interval ${interval[0]} to ${interval[1]} percent` : ""}`}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-brand)] transition-[width] duration-700 ease-[var(--ease-out)]" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono-fig w-12 text-right text-[14px] font-medium text-[var(--color-text-primary)]">{pct}%</span>
      </div>
      {interval && <div className="font-mono-fig text-[11px] text-[var(--color-text-secondary)]">Interval {interval[0]}–{interval[1]}%</div>}
    </div>
  )
}
