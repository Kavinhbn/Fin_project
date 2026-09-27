import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

// ─── Button ───
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)] border border-transparent',
  secondary: 'bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
  ghost: 'bg-transparent text-[var(--color-text-secondary)] border border-transparent hover:bg-[var(--color-bg)]',
  danger: 'bg-[var(--color-surface)] text-[var(--color-error)] border border-[var(--color-error)] hover:bg-[var(--color-error-bg)]',
}
const SIZE: Record<Size, string> = { sm: 'h-8 px-3 text-[12px]', md: 'h-9 px-4 text-[13px]' }

export function Button({ variant = 'secondary', size = 'md', loading = false, icon, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold select-none',
        'transition-[transform,background] duration-100 ease-[var(--ease-out)] active:scale-[.97]',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANT[variant], SIZE[size], className,
      )}
    >
      {loading ? <Loader2 size={14} className="spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}
