import type { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { api } from '../../api/client'
import { useResource } from '../../api/cache'
import type { Assessment, Disease, Level } from '../../api/types'
import { PageHeader } from '../../app/PageHeader'
import { useApp } from '../../app/context'
import { Dropdown } from '../../ui/Dropdown'
import type { Option } from '../../ui/Dropdown'
import { ErrorState, SkeletonRows } from '../../ui/States'
import { StatusBadge } from '../../ui/StatusBadge'
import { DataTable } from '../../ui/Table'
import { DetailDrawer } from './DetailDrawer'
import { formatDate } from './format'

// ─── Filters ───
type DiseaseFilter = Disease | 'any'
type LevelFilter = Level | 'any'

const DISEASE_OPTIONS: readonly Option<DiseaseFilter>[] = [
  { value: 'any', label: 'Any condition' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'hypertension', label: 'Hypertension' },
  { value: 'cvd', label: 'Cardiovascular disease' },
]
const LEVEL_OPTIONS: readonly Option<LevelFilter>[] = [
  { value: 'any', label: 'Any risk level' },
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'uncertain', label: 'Uncertain' },
]

function riskCell(a: Assessment, d: Disease) {
  const r = a.risks[d]
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono-fig w-9 text-right">{Math.round(r.probability * 100)}%</span>
      <StatusBadge status={r.level} />
      {r.uncertain && r.level !== 'uncertain' && <StatusBadge status="uncertain" />}
    </div>
  )
}

const COLUMNS: ColumnDef<Assessment, unknown>[] = [
  { id: 'id', header: 'ID', size: 90, accessorFn: (a) => a.id, cell: (c) => <span className="font-mono-fig">{c.getValue<string>()}</span> },
  { id: 'created', header: 'Created', size: 150, accessorFn: (a) => a.created_at, cell: (c) => formatDate(c.getValue<string>()) },
  { id: 'patient', header: 'Patient', size: 110, accessorFn: (a) => a.input.age, cell: (c) => `${c.row.original.input.age} y, ${c.row.original.input.sex === 'male' ? 'Male' : 'Female'}` },
  { id: 'diabetes', header: 'Diabetes', size: 160, accessorFn: (a) => a.risks.diabetes.probability, cell: (c) => riskCell(c.row.original, 'diabetes') },
  { id: 'hypertension', header: 'Hypertension', size: 160, accessorFn: (a) => a.risks.hypertension.probability, cell: (c) => riskCell(c.row.original, 'hypertension') },
  { id: 'cvd', header: 'CVD', size: 160, accessorFn: (a) => a.risks.cvd.probability, cell: (c) => riskCell(c.row.original, 'cvd') },
  {
    id: 'note', header: 'Note', size: 130, enableSorting: false,
    cell: (c) => {
      const n = c.row.original.note
      return n ? <StatusBadge status={n.reviewed_by ? 'reviewed' : 'awaiting_review'} /> : <span className="text-[var(--color-text-secondary)]">None</span>
    },
  },
]

// ─── Screen ───
export function AssessmentsScreen() {
  const { mode, openId, openAssessment } = useApp()
  const list = useResource<Assessment[]>(`assessments:${mode}`, () => api.listAssessments(mode))
  const [disease, setDisease] = useState<DiseaseFilter>('any')
  const [level, setLevel] = useState<LevelFilter>('any')

  const rows = useMemo(() => {
    const all = list.data ?? []
    return all.filter((a) => {
      if (level === 'any') return true
      const diseases: readonly Disease[] = disease === 'any' ? ['diabetes', 'hypertension', 'cvd'] : [disease]
      return diseases.some((d) => a.risks[d].level === level || (level === 'uncertain' && a.risks[d].uncertain === true))
    })
  }, [list.data, disease, level])

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 p-6">
      <PageHeader title="Assessments" subtitle={`Previous risk assessments (${mode === 'strict' ? 'strict, leakage-free' : 'full features'} mode). Select a row to open it.`} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="grid grid-cols-1 gap-4 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-[repeat(2,minmax(0,220px))]">
          <div className="flex flex-col gap-1"><span className="eyebrow">Condition</span><Dropdown label="Condition filter" value={disease} options={DISEASE_OPTIONS} onChange={setDisease} /></div>
          <div className="flex flex-col gap-1"><span className="eyebrow">Risk level</span><Dropdown label="Risk level filter" value={level} options={LEVEL_OPTIONS} onChange={setLevel} /></div>
        </div>
        {list.loading && !list.data ? <SkeletonRows /> : list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : (
          <DataTable
            label="Assessments"
            data={rows}
            columns={COLUMNS}
            onRowClick={(a) => openAssessment(a.id)}
            emptyTitle={(list.data ?? []).length === 0 ? 'No assessments yet' : 'No assessments match these filters'}
            emptyHint={(list.data ?? []).length === 0 ? 'Create one from New assessment.' : 'Change the condition or risk-level filter.'}
          />
        )}
      </div>
      <DetailDrawer id={openId} onClose={() => openAssessment(null)} />
    </div>
  )
}
