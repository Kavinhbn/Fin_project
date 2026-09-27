import type { CvdPathways, DiseaseExplanation, Driver } from '../api/types'

// ─── ShapBars: top positive / negative drivers; direction is stated in text, not only colour ───
function DriverRow({ driver, max }: { driver: Driver; max: number }) {
  const up = driver.contribution > 0
  const width = max === 0 ? 0 : (Math.abs(driver.contribution) / max) * 100
  return (
    <li className="grid grid-cols-[minmax(150px,1fr)_2fr_100px] items-center gap-3 py-1.5 text-[12px]">
      <div className="min-w-0">
        <div className="truncate font-medium text-[var(--color-text-primary)]">{driver.feature}</div>
        <div className="font-mono-fig truncate text-[11px] text-[var(--color-text-secondary)]">{driver.value}</div>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-bg)]" aria-hidden>
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, background: up ? 'var(--color-brand)' : 'var(--color-border-strong)' }}
        />
      </div>
      <div className="font-mono-fig whitespace-nowrap text-right text-[var(--color-text-primary)]">{up ? 'raises ' : 'lowers '}{Math.abs(driver.contribution).toFixed(1)} pts</div>
    </li>
  )
}

export function ShapBars({ explanation }: { explanation: DiseaseExplanation }) {
  const all = [...explanation.positive, ...explanation.negative]
  const max = Math.max(0, ...all.map((d) => Math.abs(d.contribution)))
  return (
    <div>
    <p className="mb-3 text-[11px] text-[var(--color-text-secondary)]">Contribution to the estimated probability, in percentage points (pts), versus a typical adult. Only inputs you provided are listed.</p>
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="eyebrow mb-1">Raises risk (top 3)</div>
        {explanation.positive.length ? <ul>{explanation.positive.map((d) => <DriverRow key={d.feature} driver={d} max={max} />)}</ul> : <p className="py-2 text-[12px] text-[var(--color-text-secondary)]">No factor raises this risk.</p>}
      </div>
      <div>
        <div className="eyebrow mb-1">Lowers risk (top 3)</div>
        {explanation.negative.length ? <ul>{explanation.negative.map((d) => <DriverRow key={d.feature} driver={d} max={max} />)}</ul> : <p className="py-2 text-[12px] text-[var(--color-text-secondary)]">No factor lowers this risk.</p>}
      </div>
    </div>
    </div>
  )
}

// ─── Pathway split for CVD: direct vs via diabetes vs via hypertension (model-based) ───
const PATHS = [
  { key: 'direct', label: 'Direct', fill: 'var(--color-brand-dark)' },
  { key: 'via_diabetes', label: 'Through diabetes', fill: 'var(--color-brand)' },
  { key: 'via_hypertension', label: 'Through hypertension', fill: 'var(--color-sky)' },
] as const

export function PathwayBar({ pathways }: { pathways: CvdPathways }) {
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-bg)]" role="img" aria-label={PATHS.map((p) => `${p.label} ${Math.round(pathways[p.key] * 100)} percent`).join(', ')}>
        {PATHS.map((p) => <div key={p.key} style={{ width: `${pathways[p.key] * 100}%`, background: p.fill }} />)}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
        {PATHS.map((p) => (
          <li key={p.key} className="flex items-center gap-2 text-[var(--color-text-primary)]">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: p.fill }} />
            {p.label}
            <span className="font-mono-fig text-[var(--color-text-secondary)]">{Math.round(pathways[p.key] * 100)}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">Model-based decomposition of the CVD estimate, not proof of causation.</p>
    </div>
  )
}
