import { Info } from 'lucide-react'
import { useId } from 'react'
import { cx } from './cx'
import { Tooltip } from './Tooltip'

// ─── Schema-driven fields: one generic renderer for number / radio / text ───
// `help` is a plain-language explanation for a field whose label alone is jargon (e.g. "HbA1c").
// It shows as an info icon next to the label — hover or keyboard-focus to read it — rather than
// renaming the label itself, so the field stays precisely identifiable to a clinician.
export type FieldSchema =
  | { kind: 'number'; name: string; label: string; unit?: string; hint?: string; required?: boolean; help?: string }
  | { kind: 'radio'; name: string; label: string; options: readonly { value: string; label: string }[]; required?: boolean; help?: string }
  | { kind: 'text'; name: string; label: string; required?: boolean; help?: string }

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
  // The info button's accessible name deliberately does NOT include the field's own label text
  // (e.g. it says "More information", not "What is BMI?") — otherwise nesting it inside
  // <label>/<legend> makes that text part of the field's accessible name too, and
  // getByLabel('BMI') starts matching both the input and this button (a real regression this
  // caused once: fixed by generalising the button's name instead of restructuring the DOM).
  const label = (
    <span className="eyebrow inline-flex items-center gap-1">
      {schema.label}
      {schema.kind === 'number' && schema.unit ? <span className="ml-1 normal-case tracking-normal font-medium">({schema.unit})</span> : null}
      {schema.required ? <span aria-hidden> *</span> : null}
      {schema.help && (
        <Tooltip text={schema.help}>
          <button type="button" aria-label="More information" className="inline-flex text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)]">
            <Info size={13} aria-hidden />
          </button>
        </Tooltip>
      )}
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
