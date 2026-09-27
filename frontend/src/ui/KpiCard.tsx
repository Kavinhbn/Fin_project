import { cx } from './cx'

// ─── KpiCard ───
interface KpiCardProps {
  label: string
  value: string
  sub?: string
  progress?: number
  className?: string
}

export function KpiCard({ label, value, sub, progress, className }: KpiCardProps) {
  return (
    <div className={cx('card-lift rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]', className)}>
      <div className="eyebrow">{label}</div>
      <div className="font-display mt-2 text-[28px] font-bold leading-none tracking-tight text-[var(--color-text-primary)] font-mono-fig">{value}</div>
      {sub && <div className="mt-2 text-[12px] text-[var(--color-text-secondary)] font-mono-fig">{sub}</div>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--color-bg)]" role="presentation">
          <div className="h-full rounded-full bg-[var(--color-brand)] transition-[width] duration-700 ease-[var(--ease-out)]" style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
        </div>
      )}
    </div>
  )
}
