import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Button } from './Button'
import { EmptyState } from './States'

// ─── Table: flex-row divs driven by TanStack (not <table>) ───
interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  onRowClick?: (row: T) => void
  emptyTitle: string
  emptyHint: string
  pageSize?: number
  minWidth?: number
  label: string
}

export function DataTable<T>({ data, columns, onRowClick, emptyTitle, emptyHint, pageSize = 10, minWidth = 1024, label }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data, columns, state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })


  const { pageIndex, pageSize: size } = table.getState().pagination
  const from = pageIndex * size + 1
  const to = Math.min(data.length, from + size - 1)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <div role="table" aria-label={label} style={{ minWidth }}>
          <div role="rowgroup" className="custom-table-head">
            {table.getHeaderGroups().map((group) => (
              <div role="row" key={group.id} className="flex w-full">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  return (
                    <div
                      role="columnheader"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                      key={header.id}
                      style={{ flex: `${header.getSize()} 1 0` }}
                      className="min-w-0 px-4 py-2.5"
                    >
                      {canSort ? (
                        <button type="button" onClick={header.column.getToggleSortingHandler()} className="eyebrow inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? <ChevronUp size={11} aria-hidden /> : sorted === 'desc' ? <ChevronDown size={11} aria-hidden /> : <ChevronsUpDown size={11} aria-hidden />}
                        </button>
                      ) : (
                        <span className="eyebrow">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div role="rowgroup">
            {table.getRowModel().rows.map((row) => (
              <div
                role="row"
                key={row.id}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={() => onRowClick?.(row.original)}
                onKeyDown={(e) => { if (onRowClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(row.original) } }}
                className="custom-table-row"
              >
                {row.getVisibleCells().map((cell, i) => (
                  <div role="cell" key={cell.id} style={{ flex: `${cell.column.getSize()} 1 0` }} className={`min-w-0 px-4 py-3 text-[12px] text-[var(--color-text-primary)] ${i === 0 ? 'truncate' : 'break-words'}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        {data.length === 0 && <EmptyState title={emptyTitle} hint={emptyHint} />}
      </div>
      {data.length > 0 && <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[12px] text-[var(--color-text-secondary)]">
        <span className="font-mono-fig">Showing {from}–{to} of {data.length}</span>
        <div className="flex gap-2">
          <Button size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Previous</Button>
          <Button size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Next</Button>
        </div>
      </div>}
    </div>
  )
}
