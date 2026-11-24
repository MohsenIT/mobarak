import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toFa } from '@/lib/quran'

type Step = {
  label: string
  count?: number
  description?: string
  title?: string
  disabled?: boolean
  hidden?: boolean
  onClick: () => void
}

export default function OccurrenceStepper({ center, previous, next, countLabel }: {
  center: ReactNode
  previous: Step
  next: Step
  countLabel?: string
}) {
  function button(direction: 'previous' | 'next', step: Step) {
    const before = direction === 'previous'
    const Icon = before ? ChevronRight : ChevronLeft
    const count = step.count === undefined ? null : <span>{toFa(step.count)}{countLabel && ` ${countLabel}`}</span>
    return <button type="button" data-analysis-nav-slot={`occurrence-${direction}`}
      className={`analysis-repeat-button analysis-repeat-${direction}`}
      aria-label={step.label} aria-description={step.description} aria-hidden={step.hidden || undefined}
      disabled={step.disabled || step.hidden} title={step.title} onClick={step.onClick}>
      {before && <Icon size={17} aria-hidden="true" />}{count}{!before && <Icon size={17} aria-hidden="true" />}
    </button>
  }

  return <>{button('previous', previous)}{center}{button('next', next)}</>
}
