'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { t } from '@/lib/i18n'
import { toFa, type Meta } from '@/lib/quran'
import type { QuranSearchResult } from '@/lib/quran-search'
import QuranHighlight from './QuranHighlight'

export default function QuickSearchResultPicker({ meta, results, index, onSelect }: {
  meta: Meta
  results: QuranSearchResult[]
  index: number
  onSelect: (index: number) => void
}) {
  const [open, setOpen] = useState(false)
  const count = { p0: toFa(index + 1), p1: toFa(results.length) }
  const address = ({ s, a }: QuranSearchResult) => `${meta.surahs[s - 1].fa} · ${toFa(a)}`

  return <Popover open={open} onOpenChange={setOpen}>
    <span className="sr-only" role="status">{address(results[index])}{' · '}{t('ui.53b89ec77a', count)}</span>
    <PopoverTrigger asChild>
      <button type="button" className="analysis-position-button" aria-label={`${address(results[index])}، ${t('ui.f511eddde8', count)}`}>
        <bdi>{address(results[index])}</bdi>
        <span>{t('ui.53b89ec77a', count)}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent className="analysis-position-picker quick-search-result-picker" align="end" sideOffset={8} dir="rtl"
      aria-label={t('ui.b55272cf13')} onOpenAutoFocus={event => {
        const selected = event.currentTarget instanceof HTMLElement
          ? event.currentTarget.querySelector<HTMLButtonElement>('[aria-current="true"]') : null
        if (!selected) return
        event.preventDefault()
        selected.focus({ preventScroll: true })
        selected.scrollIntoView({ block: 'nearest' })
      }}>
      {open && results.map((result, i) => {
        const word = result.words[(result.positions[0] ?? 1) - 1]
        return <button key={`${result.s}:${result.a}`} type="button" className="analysis-position-option"
          aria-current={i === index ? 'true' : undefined} onClick={() => { onSelect(i); setOpen(false) }}>
          <bdi>{address(result)}</bdi>
          {word && <span className="font-quran"><QuranHighlight text={word} /></span>}
        </button>
      })}
    </PopoverContent>
  </Popover>
}
