import { Button } from './Button'
import { cx } from './cx'

// ─── Skeleton / empty / error / restricted states ───
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('skeleton h-4 w-full', className)} />
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-2 p-4">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9" />)}
    </div>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <div className="text-[14px] font-bold text-[var(--color-text-primary)]">{title}</div>
      <div className="max-w-sm text-[12px] text-[var(--color-text-secondary)]">{hint}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <div className="text-[14px] font-bold text-[var(--color-text-primary)]">Something went wrong</div>
      <div className="max-w-sm text-[12px] text-[var(--color-text-secondary)]">{message}</div>
      {onRetry && <Button className="mt-3" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

// Read-only / insufficient role: explains WHY; callers still render the content beneath.
export function RoleNotice({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-6 py-2.5 text-[12px] text-[var(--color-text-secondary)]">
      {children}
    </div>
  )
}
