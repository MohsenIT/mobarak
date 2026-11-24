'use client'

import { useRef, useState } from 'react'
import { Arrow as PopoverArrow } from '@radix-ui/react-popover'
import { X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { t } from '@/lib/i18n'
import { toFa, type Meta } from '@/lib/quran'
import type { QuranSearchResult } from '@/lib/quran-search'
import type { AnalysisLocation } from '@/lib/analysis'
import { occurrenceVerseTokens } from '@/lib/occurrence-context'
import { OccurrenceRow } from './OccurrencePicker'

export default function QuickSearchResultPicker({ meta, results, index, onSelect }: {
  meta: Meta
  results: QuranSearchResult[]
  index: number
  onSelect: (index: number) => void
}) {
  const [open, setOpen] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const count = { p0: toFa(index + 1), p1: toFa(results.length) }
  const address = ({ s, a }: QuranSearchResult) => `${meta.surahs[s - 1].fa} ${toFa(a)}`

  return <Popover open={open} onOpenChange={setOpen}>
    <span className="sr-only" role="status">{address(results[index])}{' · '}{t('ui.53b89ec77a', count)}</span>
    <PopoverTrigger asChild>
      <button type="button" className="analysis-position-button" aria-label={`${address(results[index])}، ${t('ui.f511eddde8', count)}`}>
        <bdi>{address(results[index])}</bdi>
        <span aria-hidden="true">·</span>
        <span>{t('ui.53b89ec77a', count)}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent className="analysis-position-picker quick-search-result-picker" align="end" sideOffset={8} dir="rtl"
      aria-label={t('ui.b55272cf13')} onOpenAutoFocus={event => {
        event.preventDefault()
        const selected = list.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')
        selected?.focus({ preventScroll: true })
        selected?.scrollIntoView({ block: 'nearest' })
      }}>
      <div className="occurrence-picker-heading">
        <span className="occurrence-search-label">{t('ui.b55272cf13')}</span>
        <button type="button" className="occurrence-picker-close" aria-label={t('ui.510fc4baec')} onClick={() => setOpen(false)}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div ref={list} className="occurrence-picker-list nice-scroll">
        {open && results.map((result, i) => {
          const waw = new Set(result.waw)
          const tokens = occurrenceVerseTokens(result.a, result.words.map((word, j) => ({ t: word, wa: waw.has(j + 1) })))
          const locations = result.positions.flatMap((pos): AnalysisLocation[] => {
            const mask = result.parts[pos] ?? 2
            const matches: AnalysisLocation[] = []
            if (mask & 1) matches.push([result.a, pos, 'prefix'])
            if (mask & 2) matches.push([result.a, pos, 'stem'])
            return matches
          })
          const target = locations[0]
          return <OccurrenceRow key={`${result.s}:${result.a}`} tokens={tokens} a={result.a}
            pos={target?.[1] ?? 1} part={target?.[2]} locations={locations}
            reference={address(result)} selected={i === index}
            onPick={() => { onSelect(i); setOpen(false) }}
          />
        })}
      </div>
      <PopoverArrow width={18} height={9} className="occurrence-picker-arrow" />
    </PopoverContent>
  </Popover>
}
