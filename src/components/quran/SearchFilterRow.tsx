'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from '@/lib/i18n'
import { toFa } from '@/lib/quran'
import { visibleFacetCount } from '@/lib/search-facet-layout'

export type SearchFilterOption = { value: string; label: ReactNode; count?: number; title?: string }

/** Shared single-line overflow behavior for any search filter, independent of its domain. */
export default function SearchFilterRow({ label, ariaLabel, options, selected, onToggle }: {
  label: string
  ariaLabel: string
  options: SearchFilterOption[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const row = useRef<HTMLDivElement>(null)
  const [fitting, setFitting] = useState(options.length)
  const layoutIdentity = JSON.stringify(options.map(({ value, count }) => [value, count]))
  useEffect(() => {
    const element = row.current
    if (!element) return
    const measure = () => {
      const widths = Array.from(element.querySelectorAll<HTMLElement>('[data-measure-facet]')).map(chip => chip.getBoundingClientRect().width)
      const more = [0, ...Array.from(element.querySelectorAll<HTMLElement>('[data-measure-more]')).map(chip => chip.getBoundingClientRect().width)]
      const gap = parseFloat(getComputedStyle(element).columnGap) || 0
      setFitting(visibleFacetCount(element.getBoundingClientRect().width, widths, more, gap))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    element.querySelectorAll('[data-measure-facet], [data-measure-more]').forEach(chip => observer.observe(chip))
    measure()
    return () => observer.disconnect()
  }, [layoutIdentity])

  if (!options.length) return null
  return <div className="search-facet-row" role="group" aria-label={ariaLabel}>
    <span>{label}</span>
    <div ref={row} className="search-facet-options">
      <div className="search-facet-measure" aria-hidden="true" inert><div>
        {options.map(({value,label,count}) => <button type="button" key={value} data-measure-facet tabIndex={-1}><span>{label}</span>{count !== undefined && <small>{toFa(count)}</small>}</button>)}
        {options.map((_,index) => <button type="button" key={index} className="search-facet-more" data-measure-more tabIndex={-1}>{t('ui.9b083d9135',{p0:toFa(index + 1)})}</button>)}
      </div></div>
      {(expanded ? options : options.slice(0, fitting)).map(({value,label,count,title}) => <button type="button" key={value} aria-pressed={selected.includes(value)} title={title} onClick={() => onToggle(value)}><span>{label}</span>{count !== undefined && <small>{toFa(count)}</small>}</button>)}
      {options.length > fitting && <button type="button" className="search-facet-more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? t('ui.a023ed0970') : t('ui.9b083d9135',{p0:toFa(options.length - fitting)})}</button>}
    </div>
  </div>
}
