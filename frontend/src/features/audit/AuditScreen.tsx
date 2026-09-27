import type { ColumnDef } from '@tanstack/react-table'
import { api } from '../../api/client'
import { useResource } from '../../api/cache'
import { ApiError } from '../../api/types'
import type { AuditEntry } from '../../api/types'
import { PageHeader } from '../../app/PageHeader'
import { useApp } from '../../app/context'
import { ErrorState, RoleNotice, SkeletonRows } from '../../ui/States'
import { StatusBadge } from '../../ui/StatusBadge'
import { DataTable } from '../../ui/Table'
import { formatDate } from '../assessments/format'

// ─── Audit log (admin only; role enforced by the server) ───
const COLUMNS: ColumnDef<AuditEntry, unknown>[] = [
  { id: 'time', header: 'Time', size: 150, accessorFn: (e) => e.timestamp, cell: (c) => formatDate(c.getValue<string>()) },
  { id: 'user', header: 'User', size: 180, accessorFn: (e) => e.user },
  { id: 'model', header: 'Model version', size: 120, accessorFn: (e) => e.model_version, cell: (c) => <span className="font-mono-fig">{c.getValue<string>()}</span> },
  { id: 'hash', header: 'Input hash', size: 120, accessorFn: (e) => e.input_hash, cell: (c) => <span className="font-mono-fig">{c.getValue<string>()}</span> },
  { id: 'verifier', header: 'Verifier', size: 110, accessorFn: (e) => e.verifier, cell: (c) => <StatusBadge status={c.row.original.verifier} /> },
]

export function AuditScreen() {
  const { me } = useApp()
  const res = useResource<AuditEntry[]>('audit', () => api.audit())
  const forbidden = res.error instanceof ApiError && res.error.status === 403

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 p-6">
      <PageHeader title="Audit log" subtitle="Every prediction with its model version, input hash and verifier result. No patient identifiers are stored." showMode={false} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        {forbidden ? (
          <RoleNotice>The audit log is available to administrators only. You are signed in as {me.email} ({me.role}).</RoleNotice>
        ) : res.loading && !res.data ? <SkeletonRows /> : res.error || !res.data ? (
          <ErrorState message={res.error?.message ?? 'No audit data'} onRetry={res.reload} />
        ) : (
          <DataTable label="Audit log" data={res.data} columns={COLUMNS} minWidth={760} emptyTitle="No audit entries yet" emptyHint="Entries appear when assessments are created." />
        )}
      </div>
    </div>
  )
}
