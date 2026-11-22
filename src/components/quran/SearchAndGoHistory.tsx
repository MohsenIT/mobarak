'use client'

import { Pin, PinOff } from 'lucide-react'
import { t } from '@/lib/i18n'
import { destinationLabel } from '@/lib/navigation'
import type { Meta } from '@/lib/quran'
import type { SearchOperation, SearchOperationEntry } from '@/lib/search-and-go-history'
import { readSearchLink } from '@/lib/search-link'

export default function SearchAndGoHistory({ meta, operations, onReplay, onPin }: {
  meta: Meta
  operations: SearchOperationEntry[]
  onReplay: (operation: SearchOperation) => void
  onPin: (id: string) => void
}) {
  const ordered = [...operations.filter(item => item.pinned), ...operations.filter(item => !item.pinned)]
  return <div className="search-and-go-history nice-scroll" role="group" aria-label={t('ui.c6bdd72afe')}>
    {ordered.map(({ id, operation, pinned }) => {
      const label = operation.type === 'navigation' ? destinationLabel(meta, operation.destination) : readSearchLink(operation.link)?.query ?? ''
      return <div key={id} className="search-and-go-history-item" data-pinned={pinned || undefined}>
        <button type="button" className="search-and-go-replay" onClick={() => onReplay(operation)}>
          <small>{t(operation.type === 'navigation' ? 'ui.b7b6972c78' : 'ui.0f4147fe60')}</small>
          <bdi>{label}</bdi>
        </button>
        <button type="button" className="icon-btn" aria-pressed={pinned} aria-label={t('searchAndGo.pin', { p0: label })}
          onClick={() => onPin(id)}>{pinned ? <PinOff size={16} aria-hidden="true" /> : <Pin size={16} aria-hidden="true" />}</button>
      </div>
    })}
  </div>
}
