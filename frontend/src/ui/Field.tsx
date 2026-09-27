import { useId } from 'react'
import { cx } from './cx'

// ─── Schema-driven fields: one generic renderer for number / radio / text ───
export type FieldSchema =
  | { kind: 'number'; name: string; label: string; unit?: string; hint?: string; required?: boolean }
  | { kind: 'radio'; name: string; label: string; options: readonly { value: string; label: string }[]; required?: boolean }
  | { kind: 'text'; name: string; label: string; required?: boolean }

interface FieldProps {
  schema: FieldSchema
  value: string
  error?: string
  disabled?: boolean
  onChange: (name: string, value: string) => void
}

export function Field({ schema, value, error, disabled, onChange }: FieldProps) {
  const id = useId()
  const errId = `${id}-err`
  const label = (
    <span className="eyebrow">
      {schema.label}
      {schema.kind === 'number' && schema.unit ? <span className="ml-1 normal-case tracking-normal font-medium">({schema.unit})</span> : null}
      {schema.required ? <span aria-hidden> *</span> : null}
    </span>
  )

  return (
    <div className="flex flex-col gap-1.5">
      {schema.kind === 'radio' ? (
        <fieldset disabled={disabled} className="flex flex-col gap-1.5">
          <legend className="mb-1.5">{label}</legend>
          <div role="radiogroup" aria-label={schema.label} className="flex flex-wrap gap-2">
            {schema.options.map((o) => (
              <label
                key={o.value}
                className={cx(
                  'flex h-9 cursor-pointer items-center rounded-[var(--radius-md)] border px-3 text-[13px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-brand)]',
                  value === o.value
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand-light)] font-semibold text-[var(--color-text-primary)]'
                    : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
                )}
              >
                <input type="radio" name={schema.name} value={o.value} checked={value === o.value} onChange={() => onChange(schema.name, o.value)} className="sr-only" />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <>
          <label htmlFor={id}>{label}</label>
          <input
            id={id}
            name={schema.name}
            type={schema.kind === 'number' ? 'number' : 'text'}
            inputMode={schema.kind === 'number' ? 'decimal' : undefined}
            step={schema.kind === 'number' ? 'any' : undefined}
            value={value}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errId : undefined}
            onChange={(e) => onChange(schema.name, e.target.value)}
            className={cx(
              'h-9 w-full rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text-primary)] font-mono-fig disabled:bg-[var(--color-surface-2)]',
              error ? 'border-[var(--color-error)]' : 'border-[var(--color-border-strong)]',
            )}
          />
        </>
      )}
      {schema.kind === 'number' && schema.hint && !error && <span className="text-[11px] text-[var(--color-text-secondary)]">{schema.hint}</span>}
      {error && <span id={errId} role="alert" className="text-[11px] font-medium text-[var(--color-text-primary)]"><span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: 'var(--color-error)' }} />{error}</span>}
    </div>
  )
}
