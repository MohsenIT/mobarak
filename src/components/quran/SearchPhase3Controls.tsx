'use client'

import { useId, useMemo, useState } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { t } from '@/lib/i18n'
import type { Meta } from '@/lib/quran'
import { morphologyLabel } from '@/lib/quran'
import { lemmaDisplay } from '@/lib/lemma-display'
import type { SearchScopeVariant, SearchPhase3State } from '@/lib/search-link'
import type { QuranSearchResult } from '@/lib/quran-search'
import QuranText from './QuranText'

const relations = ['all', 'any', 'phrase'] as const
const scopes = ['all', 'current', 'before', 'after', 'selected', 'meccan', 'medinan'] as const
const groups = ['roots', 'lemmas', 'forms'] as const

export function phase3ScopeSurahs(meta: Meta, origin: number, scope: SearchScopeVariant, surahs: number[]): number[] {
  return {
    all: [], current: [origin], selected: surahs,
    before: meta.surahs.filter(s => s.n < origin).map(s => s.n),
    after: meta.surahs.filter(s => s.n > origin).map(s => s.n),
    meccan: meta.surahs.filter(s => s.rev === 'makkah').map(s => s.n),
    medinan: meta.surahs.filter(s => s.rev === 'madinah').map(s => s.n),
  }[scope]
}

export default function SearchPhase3Controls({ meta, origin, scope, surahs, config, results, identity, includeRoots, onScope, onConfig, onRoots }: {
  meta: Meta
  origin: number
  scope: SearchScopeVariant
  surahs: number[]
  config: SearchPhase3State
  results: QuranSearchResult[]
  identity: string
  includeRoots: boolean
  onScope: (scope: SearchScopeVariant, surahs: number[]) => void
  onConfig: (config: SearchPhase3State) => void
  onRoots: () => void
}) {
  const groupName = useId()
  const [moreOpen, setMoreOpen] = useState(false)
  const [picker, setPicker] = useState(false)
  const [filter, setFilter] = useState('')
  const values = useMemo(() => {
    const catalog = [new Set<string>(), new Set<string>(), new Set<string>()]
    for (const result of results) for (const position of result.positions) {
      result.morphology?.[position - 1]?.forEach((value, column) => { if (value) catalog[column].add(value) })
    }
    return catalog
  }, [results])

  const [catalogue, setCatalogue] = useState({ identity, values })
  const [observed, setObserved] = useState(results)
  if (identity !== catalogue.identity) {
    setCatalogue({ identity, values: [new Set(), new Set(), new Set()] })
    setObserved(results)
  } else if (observed !== results) {
    setObserved(results)
    setCatalogue({ identity, values: values.map((set, index) => new Set([...catalogue.values[index], ...set])) })
  }
  const sort = config.sorts[0] ?? 'mushaf'
  const activeFilters = groups.reduce((sum, group) => sum + config[group].length, 0)
  const moreId = `${groupName}-more`
  return <div className="phase3-controls" data-phase3-controls onKeyDown={event => {
    if (event.key !== 'Escape') return
    const panel = event.currentTarget.querySelector<HTMLDetailsElement>('details[open]')
    if (panel) {
      event.stopPropagation()
      panel.open = false
      panel.querySelector('summary')?.focus()
    }
  }}>
    <div className="phase3-options" role="group" aria-label={t('searchP3.settings')}>
      <details name={groupName} data-phase3-scope><summary className="chip" data-changed={scope !== 'all'}
        aria-label={`${t('searchP3.scope')} · ${t(`searchP3.scope.${scope}`)}`}>{t(`searchP3.scope.${scope}`)}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="phase3-popup">
          <h3>{t('searchP3.scope')}</h3>
          {scopes.map(value => {
            const numbers = phase3ScopeSurahs(meta, origin, value, surahs)
            return <button className="chip" type="button" key={value} aria-pressed={scope === value}
            disabled={value !== 'all' && value !== 'selected' && !numbers.length} onClick={() => {
              if (value === 'selected') { setPicker(!picker); return }
              setPicker(false)
              onScope(value, numbers)
            }}>{t(`searchP3.scope.${value}`)}</button>
          })}
          {(picker || scope === 'selected') && <div className="phase3-picker">
            <input type="search" aria-label={t('searchP3.scope.selected')} value={filter} onChange={event => setFilter(event.target.value)} />
            {meta.surahs.filter(s => `${s.fa} ${s.ar} ${s.n}`.includes(filter)).map(s => <label className="choice-row" key={s.n}>
              <input type="checkbox" checked={scope === 'selected' && surahs.includes(s.n)} onChange={event => {
                const selected = scope === 'selected' ? surahs : []
                const next = event.target.checked ? [...selected, s.n].sort((a,b) => a-b) : selected.filter(n => n !== s.n)
                onScope(next.length ? 'selected' : 'all', next)
              }} />{s.fa}</label>)}
          </div>}
        </div>
      </details>
      <details name={groupName} data-phase3-relation><summary className="chip" data-changed={config.relation !== 'all'}
        aria-label={`${t('searchP3.relation')} · ${t(`searchP3.relation.${config.relation}`)}`}>{t(`searchP3.relation.${config.relation}`)}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="phase3-popup"><h3>{t('searchP3.relation')}</h3>{relations.map(relation => <button className="chip" type="button" key={relation} aria-pressed={config.relation === relation} onClick={() => onConfig({ ...config, relation })}>{t(`searchP3.relation.${relation}`)}</button>)}</div>
      </details>
      <button type="button" className="chip" data-phase3-roots aria-label={t('ui.702b74fe3e')} aria-pressed={includeRoots} onClick={onRoots}>{t(includeRoots ? 'searchP3.rootsOn' : 'searchP3.rootsOff')}</button>
      <details name={groupName} data-phase3-sort><summary className="chip" data-changed={sort !== 'mushaf'}
        aria-label={`${t('searchP3.sort')} · ${t(`searchP3.sort.${sort}`)}`}>{t(`searchP3.sortShort.${sort}`)}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="phase3-popup"><h3>{t('searchP3.sort')}</h3>{(['mushaf', 'relevance'] as const).map(value => <button className="chip" type="button" key={value}
          aria-pressed={sort === value} onClick={() => onConfig({ ...config, sorts: [value, value === 'mushaf' ? 'relevance' : 'mushaf'] })}>{t(`searchP3.sort.${value}`)}</button>)}</div>
      </details>
      <button className="chip" type="button" data-phase3-more aria-expanded={moreOpen} aria-controls={moreId}
        data-changed={activeFilters > 0} onClick={event => {
          const openPopup = event.currentTarget.closest('.phase3-options')?.querySelector('details[open]')
          openPopup?.removeAttribute('open')
          setMoreOpen(open => !open)
        }}>
        <SlidersHorizontal size={14} aria-hidden="true" />
        {t('searchP3.research')}{activeFilters > 0 && <> · {t('searchP3.activeFilters', { count: activeFilters })}</>}
      </button>
    </div>
    <section id={moreId} className="phase3-research nice-scroll" aria-label={t('searchP3.research')} hidden={!moreOpen}>
        <h3>{t('searchP3.research')}</h3>
        <div className="phase3-research-groups">{groups.map((group, index) => {
          const available = [...new Set([...config[group], ...catalogue.values[index]])]
          return <fieldset key={group}><legend>{t(`searchP3.filter.${group}`)}</legend>
            {!available.length && <span>{t('searchP3.noFilters')}</span>}
            {available.map(value => <button className="chip" key={value} type="button" aria-pressed={config[group].includes(value)}
              onClick={() => onConfig({ ...config, [group]: config[group].includes(value) ? config[group].filter(item => item !== value) : [...config[group], value] })}>
              {group === 'forms' ? morphologyLabel(value) : <QuranText text={group === 'lemmas' ? lemmaDisplay(value) : value} />}
            </button>)}</fieldset>
        })}</div>
    </section>
  </div>
}
