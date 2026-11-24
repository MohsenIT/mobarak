'use client'

import { useId, useState, type KeyboardEvent } from 'react'
import { t } from '@/lib/i18n'
import { activeDestinationIndex, stepDestinationIndex, type Destination, type DestinationSuggestion } from '@/lib/navigation'

export function useDestinationSelection(options: readonly DestinationSuggestion[], completions = 0) {
  const id = useId()
  const [selected, setSelected] = useState<number>()
  const completionId = `${id}-completion`
  const count = options.length + completions
  const active = selected !== undefined && selected >= options.length && selected < count ? selected : activeDestinationIndex(options, selected)
  const completion = active >= options.length ? active - options.length : -1
  return {
    id, active, completionId, completion, destination: options[active]?.destination,
    reset: () => setSelected(undefined),
    move(event: KeyboardEvent<HTMLInputElement>) {
      if (!count || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return false
      event.preventDefault()
      setSelected(stepDestinationIndex(active, count, event.key === 'ArrowDown' ? 1 : -1))
      return true
    },
    inputProps: {
      role: 'combobox',
      'aria-autocomplete': 'list' as const,
      'aria-expanded': count > 0,
      'aria-controls': [options.length ? id : '', completions ? completionId : ''].filter(Boolean).join(' ') || undefined,
      'aria-activedescendant': completion >= 0 ? `${completionId}-${completion}` : active >= 0 ? `${id}-${active}` : undefined,
    },
  }
}

export default function DestinationOptions({ id, active, options, onPick, className, asChips = false }: {
  id: string
  active: number
  options: readonly DestinationSuggestion[]
  onPick: (destination: Destination) => void
  className: string
  asChips?: boolean
}) {
  if (!options.length) return null
  return <div id={id} className={className} role="listbox" aria-label={t('ui.6d7a6c7a7e')}>
    {options.map((item, index) => <button key={index} id={`${id}-${index}`} type="button" role="option" className={asChips ? "chip" : undefined}
      aria-selected={active === index} onMouseDown={event => event.preventDefault()}
      onClick={() => onPick(item.destination)}>{item.label}</button>)}
  </div>
}
