'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, FileText, Funnel, ListChecks, RotateCcw, Search, Trash2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import { toFa, type Meta } from '@/lib/quran'
import { filterScopeSurahs, scopeSurahs, type SearchScopeSelection } from '@/lib/search-scope'
import { searchPopupName } from './search-popup'
import { RevelationIcon } from './Ornaments'

const ranges = ['all', 'meccan', 'medinan'] as const
type Range = typeof ranges[number]
const tabs = { range: BookOpen, many: ListChecks, single: FileText } as const
type Tab = keyof typeof tabs

function tabFor(variant: SearchScopeSelection['variant']): Tab {
  if (variant === 'single' || variant === 'current') return 'single'
  if (variant === 'selected' || variant === 'before' || variant === 'after') return 'many'
  return 'range'
}

export default function SearchWorkspaceScope({ meta, currentSurah, selection, onScope, counts, countsError, onCountsActive }: {
  meta: Meta
  currentSurah: number
  selection: SearchScopeSelection
  onScope: (selection: SearchScopeSelection) => void
  counts: Record<number, number> | null
  countsError: boolean
  onCountsActive: (active: boolean) => void
}) {
  const id = useId()
  const { variant, surahs } = selection
  const tab = tabFor(variant)
  const [lastRange, setRange] = useState<Range>(() => variant === 'meccan' || variant === 'medinan' ? variant : 'all')
  const [lastMany, setMany] = useState(() => tab === 'many' ? surahs : [])
  const [lastSingle, setSingle] = useState(() => tab === 'single' ? surahs[0] ?? currentSurah : currentSurah)
  const [view, setView] = useState<'results' | 'all'>('results')
  const [query, setQuery] = useState('')
  const [picker, setPicker] = useState(false)
  useEffect(() => () => onCountsActive(false), [onCountsActive])
  const pickerButton = useRef<HTMLButtonElement>(null)
  const single = surahs[0] ?? currentSurah
  const selectedSurah = meta.surahs.find(surah => surah.n === single)
  const summary = variant === 'meccan' || variant === 'medinan' ? t(`searchP3.scopeIn.${variant}`)
    : tab === 'range' ? t('searchP3.scopeIn.all')
      : !surahs.length ? t('searchP3.scopeEmpty')
        : surahs.length === 1 ? t('searchP3.scopeIn.single', { name: selectedSurah?.fa ?? '' })
          : t('searchP3.scopeIn.multiple', { count: toFa(surahs.length) })

  const selectTab = (next: Tab) => {
    if (tab === next) return
    if (tab === 'many') setMany(surahs)
    if (tab === 'single') setSingle(single)
    if (variant === 'all' || variant === 'meccan' || variant === 'medinan') setRange(variant)
    setQuery('')
    setPicker(false)
    onCountsActive(next === 'many' && view === 'results')
    if (next === 'range') onScope({ variant: lastRange, surahs: scopeSurahs(meta, currentSurah, lastRange, []) })
    if (next === 'many') onScope({ variant: 'selected', surahs: lastMany })
    if (next === 'single') onScope({ variant: 'single', surahs: [lastSingle] })
  }
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys = Object.keys(tabs) as Tab[]
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const offset = event.key === (rtl ? 'ArrowLeft' : 'ArrowRight') ? 1 : event.key === (rtl ? 'ArrowRight' : 'ArrowLeft') ? -1 : 0
    const next = event.key === 'Home' ? keys[0] : event.key === 'End' ? keys.at(-1)! : offset ? keys[(keys.indexOf(tab) + offset + keys.length) % keys.length] : undefined
    if (!next) return
    event.preventDefault()
    selectTab(next)
    document.getElementById(`${id}-${next}`)?.focus()
  }
  const chooseSingle = (n: number) => {
    onScope({ variant: 'single', surahs: [n] })
    setPicker(false)
    setQuery('')
    pickerButton.current?.focus()
  }
  const chooseMany = (n: number) => onScope({ variant: 'selected', surahs: surahs.includes(n)
    ? surahs.filter(value => value !== n)
    : [...surahs, n].sort((a, b) => a - b) })
  const withCounts = tab === 'many' && view === 'results'
  const rows = filterScopeSurahs(meta, query, surahs, withCounts ? counts ?? {} : undefined)
  const listing = (singlePicker: boolean) => <>
    <label className="phase3-scope-query"><Search size={16} aria-hidden="true" />
      <input autoFocus={singlePicker} type="search" value={query} onChange={event => setQuery(event.target.value)}
        placeholder={t('searchP3.scopeSearch')} aria-label={t('searchP3.scopeSearch')} />
    </label>
    <div className="phase3-scope-list nice-scroll" role="group" aria-label={t('searchP3.scope')}>
      {rows.map(surah => {
        const chosen = singlePicker ? single === surah.n : surahs.includes(surah.n)
        return <button type="button" className="phase3-scope-item" key={surah.n} data-surah={surah.n}
          role={singlePicker ? undefined : 'checkbox'} aria-checked={!singlePicker ? chosen : undefined}
          aria-pressed={singlePicker ? chosen : undefined}
          onClick={() => singlePicker ? chooseSingle(surah.n) : chooseMany(surah.n)}>
          {!singlePicker && <span className="phase3-scope-check" aria-hidden="true">{chosen && <Check size={13} />}</span>}
          <span className="phase3-scope-number">{toFa(surah.n)}</span>
          <span>{surah.fa}</span>
          {singlePicker && surah.n === currentSurah && <span className="phase3-scope-current">{t('searchP3.scopeCurrent')}</span>}
          {withCounts && <span className="phase3-scope-count">{toFa(counts?.[surah.n] ?? 0)}{' '}{t('ui.61cf4e03c8')}</span>}
          {singlePicker && chosen && <Check size={15} className="phase3-scope-count" aria-hidden="true" />}
        </button>
      })}
      {!rows.length && <p role="status" className="phase3-scope-empty">{t(withCounts && countsError ? 'ui.12287cefbb' : withCounts && counts === null ? 'ui.63509f3da4' : 'searchP3.scopeNoSurah')}</p>}
    </div>
  </>
  return <details name={searchPopupName} className="phase3-scope-control" data-phase3-scope onToggle={event => {
    const open = event.currentTarget.open
    onCountsActive(open && withCounts)
    if (!open) { setQuery(''); setPicker(false) }
  }}>
    <summary className="chip"><Funnel size={14} aria-hidden="true" /><span>{summary}</span><ChevronDown size={12} aria-hidden="true" /></summary>
    <div className="reader-display-menu phase3-scope-menu">
      <div role="tablist" className="phase3-scope-tabs" aria-label={t('searchP3.scope')}>
        {(Object.keys(tabs) as Tab[]).map(value => {
          const Icon = tabs[value]
          return <button key={value} id={`${id}-${value}`} type="button" role="tab" tabIndex={tab === value ? 0 : -1}
            aria-controls={id} aria-selected={tab === value} onKeyDown={onTabKey} onClick={() => selectTab(value)}>
            <Icon size={15} aria-hidden="true" />{t(`searchP3.scopeTab.${value}`)}
          </button>
        })}
      </div>
      <div role="tabpanel" id={id} aria-labelledby={`${id}-${tab}`} className="phase3-scope-body">
        {tab === 'range' && <div className="reader-display-modes phase3-scope-range" role="group" aria-label={t('searchP3.scopeTab.range')}>
          {ranges.map(value => <button key={value} type="button" aria-pressed={variant === value}
            onClick={() => onScope({ variant: value, surahs: scopeSurahs(meta, currentSurah, value, []) })}>
            {value === 'all' ? <BookOpen size={18} aria-hidden="true" /> : <RevelationIcon makki={value === 'meccan'} />}
            {t(`searchP3.scope.${value}`)}
          </button>)}
        </div>}
        {tab === 'many' && <>
          <div className="reader-display-modes" role="group" aria-label={t('searchP3.scopeTab.many')}>
            {(['results', 'all'] as const).map(value => <button key={value} type="button" aria-pressed={view === value}
              onClick={() => { setView(value); setQuery(''); onCountsActive(value === 'results') }}>
              {t(value === 'results' ? 'searchP3.scopeHasResults' : 'searchP3.scopeAllSurahs')}
            </button>)}
          </div>
          {listing(false)}
          <div className="phase3-scope-footer">
            <span aria-live="polite">{t('searchP3.scopeChosen', { count: toFa(surahs.length) })}</span>
            <button className="chip" type="button" disabled={!surahs.length} onClick={() => onScope({ variant: 'selected', surahs: [] })}><Trash2 size={14} aria-hidden="true" />{t('searchP3.scopeClear')}</button>
          </div>
          {view === 'results' && <p className="phase3-scope-hint">{t('searchP3.scopeResultsHint')}</p>}
        </>}
        {tab === 'single' && <>
          <div className="reader-display-modes phase3-scope-stepper">
            <button type="button" aria-label={t('searchP3.scopePrevious')} disabled={single <= 1} onClick={() => onScope({ variant: 'single', surahs: [single - 1] })}>
              <ChevronRight size={16} aria-hidden="true" />{t('searchP3.scopeStepPrevious')}
            </button>
            <button ref={pickerButton} type="button" className="phase3-scope-pick" aria-expanded={picker}
              onClick={() => { setPicker(!picker); setQuery('') }}>
              <Search size={16} aria-hidden="true" />
              <span><strong>{selectedSurah?.fa}</strong>{single === currentSurah && <span className="phase3-scope-current">{t('searchP3.scopeCurrent')}</span>}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            <button type="button" aria-label={t('searchP3.scopeNext')} disabled={single >= 114} onClick={() => onScope({ variant: 'single', surahs: [single + 1] })}>
              <ChevronLeft size={16} aria-hidden="true" />{t('searchP3.scopeStepNext')}
            </button>
          </div>
          {picker && listing(true)}
          {single !== currentSurah && <div className="phase3-scope-footer">
            <button className="chip" type="button" onClick={() => chooseSingle(currentSurah)}><RotateCcw size={14} aria-hidden="true" />{t('searchP3.scopeReturn')}</button>
          </div>}
        </>}
      </div>
    </div>
  </details>
}
