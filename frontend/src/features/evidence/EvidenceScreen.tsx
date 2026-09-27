import type { ColumnDef } from '@tanstack/react-table'
import { api } from '../../api/client'
import { useResource } from '../../api/cache'
import type { BaselineRow, ModelCard, SubgroupRow } from '../../api/types'
import { PageHeader } from '../../app/PageHeader'
import { useApp } from '../../app/context'
import { CalibrationChart } from '../../charts/CalibrationChart'
import { KpiCard } from '../../ui/KpiCard'
import { ErrorState, SkeletonRows } from '../../ui/States'
import { DataTable } from '../../ui/Table'

// ─── Model & evidence ───
const f2 = (v: number): string => v.toFixed(2)

const SUBGROUP_COLS: ColumnDef<SubgroupRow, unknown>[] = [
  { id: 'group', header: 'Subgroup', size: 140, accessorFn: (r) => r.group },
  { id: 'n', header: 'N', size: 80, accessorFn: (r) => r.n, cell: (c) => <span className="font-mono-fig">{c.getValue<number>().toLocaleString('en-GB')}</span> },
  { id: 'auroc', header: 'AUROC', size: 80, accessorFn: (r) => r.auroc, cell: (c) => <span className="font-mono-fig">{f2(c.getValue<number>())}</span> },
  { id: 'ece', header: 'ECE', size: 80, accessorFn: (r) => r.ece, cell: (c) => <span className="font-mono-fig">{c.getValue<number>().toFixed(3)}</span> },
]

const BASELINE_COLS: ColumnDef<BaselineRow, unknown>[] = [
  { id: 'model', header: 'Model', size: 180, accessorFn: (r) => r.model },
  { id: 'diabetes', header: 'Diabetes AUROC', size: 110, accessorFn: (r) => r.diabetes, cell: (c) => <span className="font-mono-fig">{f2(c.getValue<number>())}</span> },
  { id: 'hypertension', header: 'Hypertension AUROC', size: 130, accessorFn: (r) => r.hypertension, cell: (c) => <span className="font-mono-fig">{f2(c.getValue<number>())}</span> },
  { id: 'cvd', header: 'CVD AUROC', size: 100, accessorFn: (r) => r.cvd, cell: (c) => <span className="font-mono-fig">{f2(c.getValue<number>())}</span> },
]

export function EvidenceScreen() {
  const { mode, isMock } = useApp()
  const res = useResource<ModelCard>(`model:${mode}`, () => api.modelCard(mode))
  const card = res.data

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-6">
      <PageHeader title="Model & evidence" subtitle={`Performance, calibration and subgroup results for the ${mode === 'strict' ? 'strict (leakage-free)' : 'full-feature'} model.`} />
      {res.loading && !card ? <SkeletonRows rows={6} /> : res.error || !card ? (
        <ErrorState message={res.error?.message ?? 'No model card available'} onRetry={res.reload} />
      ) : (
        <div className="anim-fade flex flex-col gap-6">
          <p className="text-[12px] text-[var(--color-text-secondary)]">
            Model version <span className="font-mono-fig">{card.model_version}</span>.{isMock ? ' Placeholder values for the interface demo.' : ' Every metric is shown with a 95% confidence interval.'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {card.metrics.map((m) => (
              <KpiCard key={m.label} label={m.label} value={f2(m.value)} sub={`95% CI ${f2(m.ci[0])}–${f2(m.ci[1])}`} progress={m.label === 'Calibration error (ECE)' ? undefined : m.value} />
            ))}
          </div>
          <section aria-labelledby="cal" className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 id="cal" className="font-display mb-3 text-[16px] font-semibold">Calibration</h2>
            <CalibrationChart points={card.calibration} />
          </section>
          <section aria-labelledby="base" className="flex min-h-[220px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <h2 id="base" className="font-display px-5 py-4 text-[16px] font-semibold">Comparison with baselines</h2>
            <DataTable label="Baselines" data={card.baselines} columns={BASELINE_COLS} minWidth={560} emptyTitle="No baselines" emptyHint="Baseline results appear after training." />
          </section>
          <section aria-labelledby="sub" className="flex min-h-[260px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <h2 id="sub" className="font-display px-5 py-4 text-[16px] font-semibold">Subgroup performance</h2>
            <DataTable label="Subgroups" data={card.subgroups} columns={SUBGROUP_COLS} minWidth={460} emptyTitle="No subgroup results" emptyHint="Subgroup results appear after evaluation." />
          </section>
        </div>
      )}
    </div>
  )
}
