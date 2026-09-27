import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

// ─── Tooltip (Radix, dark pill) ───
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={200}>{children}</RadixTooltip.Provider>
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="z-[70] max-w-xs rounded-[var(--radius-pill)] px-3 py-1 text-[11px] font-medium text-white shadow-[var(--shadow-md)]"
          style={{ background: 'var(--color-text-primary)' }}
        >
          {text}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}
