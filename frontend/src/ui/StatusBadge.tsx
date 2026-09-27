import { cx } from './cx'

// ─── Status map (single source of truth; never hardcode a status colour elsewhere) ───
type Tone = 'approved' | 'warning' | 'error' | 'sky' | 'violet' | 'muted'

const TONE: Record<Tone, { bg: string; dot: string }> = {
  approved: { bg: 'var(--color-approved-bg)', dot: 'var(--color-approved)' },
  warning: { bg: 'var(--color-warning-bg)', dot: 'var(--color-warning)' },
  error: { bg: 'var(--color-error-bg)', dot: 'var(--color-error)' },
  sky: { bg: 'var(--color-sky-bg)', dot: 'var(--color-sky)' },
  violet: { bg: 'var(--color-violet-bg)', dot: 'var(--color-violet)' },
  muted: { bg: 'var(--color-muted-bg)', dot: 'var(--color-muted)' },
}

export const STATUS = {
  low: { label: 'Low', tone: 'approved' },
  moderate: { label: 'Moderate', tone: 'warning' },
  high: { label: 'High', tone: 'error' },
  uncertain: { label: 'Uncertain', tone: 'sky' },
  not_assessed: { label: 'Not assessed', tone: 'muted' },
  passed: { label: 'Verified', tone: 'approved' },
  flagged: { label: 'Flagged', tone: 'warning' },
  not_run: { label: 'Not run', tone: 'muted' },
  ai_generated: { label: 'AI-generated', tone: 'violet' },
  reviewed: { label: 'Reviewed', tone: 'approved' },
  awaiting_review: { label: 'Awaiting review', tone: 'muted' },
} as const satisfies Record<string, { label: string; tone: Tone }>

export type StatusKey = keyof typeof STATUS

// Label text stays in the primary text colour (state colours fail AA as small text);
// the coloured dot marks the state and the label always names it.
export function StatusBadge({ status, className }: { status: StatusKey; className?: string }) {
  const { label, tone } = STATUS[status]
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-primary)] whitespace-nowrap', className)}
      style={{ background: TONE[tone].bg }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: TONE[tone].dot }} />
      {label}
    </span>
  )
}
