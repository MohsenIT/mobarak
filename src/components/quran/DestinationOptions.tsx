'use client'

import { useId, useState, type KeyboardEvent } from 'react'
import { t } from '@/lib/i18n'
import { activeDestinationIndex, stepDestinationIndex, type Destination, type DestinationSuggestion } from '@/lib/navigation'

export function useDestinationSelection(options: readonly DestinationSuggestion[]) {
  const id = useId()
  const [selected, setSelected] = useState<number>()
  const active = activeDestinationIndex(options, selected)
  return {
    id, active, destination: options[active]?.destination,
    reset: () => setSelected(undefined),
    move(event: KeyboardEvent<HTMLInputElement>) {
      if (!options.length || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return false
      event.preventDefault()
      setSelected(stepDestinationIndex(active, options.length, event.key === 'ArrowDown' ? 1 : -1))
      return true
    },
    inputProps: {
      role: 'combobox',
      'aria-autocomplete': 'list' as const,
      'aria-expanded': options.length > 0,
      'aria-controls': options.length ? id : undefined,
      'aria-activedescendant': active >= 0 ? `${id}-${active}` : undefined,
    },
  }
}

export default function DestinationOptions({ id, active, options, onPick, className }: {
  id: string
  active: number
  options: readonly DestinationSuggestion[]
  onPick: (destination: Destination) => void
  className: string
}) {
  if (!options.length) return null
  return <div id={id} className={className} role="listbox" aria-label={t('ui.6d7a6c7a7e')}>
    {options.map((item, index) => <button key={index} id={`${id}-${index}`} type="button" role="option"
      aria-selected={active === index} onMouseDown={event => event.preventDefault()}
      onClick={() => onPick(item.destination)}>{item.label}</button>)}
  </div>
}
