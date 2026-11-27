'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ToggleEvent, type ReactNode } from 'react'
import { ArrowDownUp, ArrowDown01, ArrowDown10, ArrowDownNarrowWide, ArrowDownWideNarrow, ChevronDown, Check, Layers3, ListChecks, ListOrdered, ListTodo, Quote, ScanText, Settings2, SpellCheck2, Sprout, Tags, type LucideIcon } from 'lucide-react'
import { createPortal } from 'react-dom'
import SearchFilterRow from './SearchFilterRow'
import { t } from '@/lib/i18n'
import { morphologyLabel } from '@/lib/quran'
import { lemmaDisplay } from '@/lib/lemma-display'
import type { SearchPhase3State } from '@/lib/search-link'
import { normalizeQuranSearch, type QuranSearchResult } from '@/lib/quran-search'
import { readStored, writeStored } from '@/lib/reader-storage'
import QuranText from './QuranText'
import { unrecordedSearchForm } from '@/lib/search-query'
import { searchPopupName } from './search-popup'

const relations = { all: ListChecks, any: ListTodo, phrase: Quote } as const
const relationValues = ['all', 'any', 'phrase'] as const
const groups = ['roots', 'lemmas', 'forms'] as const
const matchUnits = [
  ['verse', 'ui.b1b168c791'],
  ['context', 'ui.16836d5471'],
  ['surah', 'ui.a37a87553b'],
] as const
const researchOpenKey = 'mushaf.search-research-open.v1'

type WorkspaceConfigProps = {
  config: SearchPhase3State
  onConfig: (config: SearchPhase3State) => void
}

function dismissPopup(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Escape') return
  const target = event.currentTarget
  const popup = target instanceof HTMLDetailsElement && target.open ? target : target.querySelector<HTMLDetailsElement>('.phase3-options details[open]')
  if (popup) {
    event.stopPropagation()
    popup.open = false
    popup.querySelector('summary')?.focus()
  }
}

function alignFilterPopup(details: HTMLDetailsElement) {
  if (!details.open) return
  const container = details.closest('.phase3-controls')?.getBoundingClientRect()
  const trigger = details.querySelector('summary')?.getBoundingClientRect()
  if (!container || !trigger) return
  details.style.setProperty('--filter-popup-top', `${trigger.bottom - container.top + 7}px`)
  const menu = details.querySelector('.phase3-relation-popup')?.getBoundingClientRect()
  if (menu) {
    const centered = trigger.left - container.left + (trigger.width - menu.width) / 2
    details.style.setProperty('--filter-popup-left', `${Math.max(8, Math.min(centered, container.width - menu.width - 8))}px`)
  }
}

function positionFilterPopup(event: ToggleEvent<HTMLDetailsElement>) {
  alignFilterPopup(event.currentTarget)
}

export function SearchWorkspaceSort({ config, onConfig }: WorkspaceConfigProps) {
  const sort = config.sorts[0] ?? 'mushaf'
  const reversed = config.reverseSort ?? false
  const isRelevance = sort === 'relevance'
  const SortIcon = isRelevance ? ArrowDownWideNarrow : reversed ? ArrowDown10 : ArrowDown01
  const directionLabel = t(isRelevance ? 'searchP3.mostRelevantFirst' : reversed ? 'searchP3.reverse' : 'searchP3.forward')
  return <details name={searchPopupName} className="phase3-sort" data-phase3-sort onKeyDown={dismissPopup}>
    <summary className="chip"
      aria-label={`${t('searchP3.sort')}، ${t(`searchP3.sort.${sort}`)}، ${directionLabel}`}>
      <SortIcon className="phase3-sort-icon" size={16} aria-hidden="true" />
      <span className="phase3-sort-value">{t(`searchP3.sortShort.${sort}`)}</span>
    </summary>
    <div className="reader-display-menu">
      <div className="reader-display-controls">
        <section>
          <h3><ArrowDownUp size={16} aria-hidden="true" />{t('searchP3.sort')}</h3>
          <div className="reader-display-modes" role="group" aria-label={t('searchP3.sort')}>
            {(['mushaf', 'relevance'] as const).map(value => <button type="button" key={value}
              aria-label={t(`searchP3.sort.${value}`)} aria-pressed={sort === value}
              onClick={() => onConfig({ ...config, sorts: [value, value === 'mushaf' ? 'relevance' : 'mushaf'] })}>
              {t(value === 'relevance' ? 'searchP3.sort.relevance' : 'searchP3.sortShort.mushaf')}
            </button>)}
          </div>
        </section>
        <section>
          <div className="reader-display-modes phase3-sort-directions" role="group" aria-label={directionLabel}>
            {[false, true].map(reverse => {
              const Icon = isRelevance ? (reverse ? ArrowDownWideNarrow : ArrowDownNarrowWide) : (reverse ? ArrowDown10 : ArrowDown01)
              return <button type="button" key={String(reverse)}
              disabled={isRelevance} aria-pressed={(isRelevance || reversed) === reverse} onClick={() => onConfig({ ...config, reverseSort: reverse || undefined })}>
              <Icon className="phase3-sort-icon" size={16} aria-hidden="true" />
              {isRelevance
                ? t(reverse ? 'searchP3.highToLow' : 'searchP3.lowToHigh')
                : t(reverse ? 'searchP3.reverse' : 'searchP3.forward')}
            </button>})}
          </div>
        </section>
      </div>
    </div>
  </details>
}

type MatchingPreference = { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }

function SearchSettingToggle({ label, checked, disabled, onChange, icon: Icon, setting }: MatchingPreference & { icon: LucideIcon; setting?: 'spelling' | 'order' }) {
  return <section className="reader-display-translation">
    <span><Icon size={16} aria-hidden="true" />{label}</span>
    <button className="reader-display-switch" type="button" role="switch" aria-label={label}
      data-phase3-spelling={setting === 'spelling' || undefined} data-phase3-word-order={setting === 'order' || undefined}
      aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}><span /></button>
  </section>
}

export function SearchWorkspaceSettings({ config, onConfig, partial, matching, actions }: WorkspaceConfigProps & {
  partial: MatchingPreference; matching: (MatchingPreference & { icon: LucideIcon })[]; actions: ReactNode
}) {
  const cooccurrence = config.cooccurrence ?? 'verse'
  const label = t('searchP3.settings')
  return <details name={searchPopupName} className="phase3-settings" data-phase3-settings onKeyDown={dismissPopup}>
    <summary className="icon-btn phase3-settings-trigger" aria-label={label} title={label}>
      <Settings2 size={19} aria-hidden="true" />
    </summary>
    <div className="reader-display-menu">
      <div className="reader-display-controls">
        <section data-phase3-cooccurrence>
          <h3><Layers3 size={16} aria-hidden="true" />{t('searchP3.matchWithin')}</h3>
          <div className="reader-display-modes" role="group" aria-label={t('searchP3.matchWithin')}>
            {matchUnits.map(([unit, key]) => <button type="button" key={unit} data-phase3-unit={unit}
              aria-pressed={cooccurrence === unit} onClick={() => onConfig({ ...config, cooccurrence: unit })}>
              {t(key)}
            </button>)}
          </div>
        </section>
        <SearchSettingToggle {...partial} icon={ScanText} />
        <SearchSettingToggle setting="spelling" icon={SpellCheck2} label={t('searchP3.spellingSensitive')} checked={!!config.spellingSensitive}
          onChange={checked => onConfig({ ...config, spellingSensitive: checked })} />
        <SearchSettingToggle setting="order" icon={ListOrdered} label={t('searchP3.orderedWords')} checked={!!config.orderedWords} disabled={config.relation !== 'all'}
          onChange={checked => onConfig({ ...config, orderedWords: checked || undefined })} />
        {matching.map(preference => <SearchSettingToggle key={preference.label} {...preference} />)}
        {actions}
      </div>
    </div>
  </details>
}

export default function SearchPhase3Controls({ config, query, results, identity, includeRoots, researchHost, onConfig, onRoots }: {
  query: string
  results: QuranSearchResult[]
  identity: string
  includeRoots: boolean
  researchHost?: HTMLElement | null
  onRoots: () => void
} & WorkspaceConfigProps) {
  const groupName = useId()
  const toolbar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = toolbar.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      const open = element.querySelector<HTMLDetailsElement>('details[open]')
      if (open) alignFilterPopup(open)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const [moreOpen, setMoreOpen] = useState(() => readStored<unknown>(researchOpenKey, false) === true)
  const values = useMemo(() => {
    const catalog: Map<string, number>[][] = []
    for (const result of results) {
      for (const [index, positions] of (result.facetPositions ?? [result.positions]).entries()) {
        const counts = catalog[index] ??= groups.map(() => new Map<string, number>())
        for (const position of positions) result.morphology?.[position - 1]?.forEach((value, column) => {
          const key = value ?? (column === 2 ? unrecordedSearchForm : null)
          if (key) counts[column].set(key, (counts[column].get(key) ?? 0) + 1)
        })
      }
    }
    return catalog
  }, [results])

  const [catalogue, setCatalogue] = useState({ identity, values })
  const [observed, setObserved] = useState(results)
  if (identity !== catalogue.identity) {
    setCatalogue({ identity, values })
    setObserved(results)
  } else if (observed !== results) {
    setObserved(results)
    setCatalogue({ identity, values: Array.from({ length: Math.max(values.length, catalogue.values.length) }, (_, index) =>
      groups.map((_, column) => new Map([...catalogue.values[index]?.[column] ?? [], ...values[index]?.[column] ?? []]))) })
  }
  const multipleWords = normalizeQuranSearch(query).includes(' ')
  const MatchIcon = relations[config.relation]
  const finding = t('searchP3.finding', { relation: t(`searchP3.relation.${config.relation}`) })
  const activeFilters = groups.reduce((sum, group) => sum + config[group].length, 0)
  const moreId = `${groupName}-more`
  const research = <section id={moreId} className="phase3-research" data-phase3-research
    aria-label={t('searchP3.research')} hidden={!moreOpen}>
    {groups.map((group, index) => {
      const label = t(`searchP3.filter.${group}`)
      const selected = config[group]
      const countsByWord = catalogue.values.map(columns => columns[index])
      const unassigned = selected.filter(value => !countsByWord.some(counts => counts.has(value)))
      const words = countsByWord.map(counts => [...counts].sort(([a, ac], [b, bc]) =>
        Number(selected.includes(b)) - Number(selected.includes(a)) || bc - ac || a.localeCompare(b, 'ar')))
      if (unassigned.length) words.push(unassigned.map(value => [value, 0]))
      const nonempty = words.filter(word => word.length)
      return <SearchFilterRow key={`${identity}:${group}`} label={label} ariaLabel={label}
        options={nonempty.flatMap((word, index) => word.map(([value, count], position) => ({
          value,
          key: `${index}:${value}`,
          separator: index > 0 && position === 0,
          count,
          label: group === 'forms' ? (value === unrecordedSearchForm ? t('searchP3.unrecordedForm') : morphologyLabel(value)) : <QuranText text={group === 'lemmas' ? lemmaDisplay(value) : value} />,
        })))}
        selected={config[group]} onToggle={value => onConfig({
          ...config,
          [group]: config[group].includes(value) ? config[group].filter(item => item !== value) : [...config[group], value],
        })} />
    })}
  </section>
  return <div className="phase3-controls" data-phase3-controls onKeyDown={dismissPopup}>
    <div className="phase3-options" ref={toolbar} role="group" aria-label={t('searchP3.settings')}>
      {multipleWords && <details name={searchPopupName} onToggle={positionFilterPopup} data-phase3-relation><summary className="chip">
        <MatchIcon size={14} aria-hidden="true" />
        <span>{finding}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </summary>
        <div className="phase3-popup phase3-relation-popup">
          <div className="phase3-relation-options" role="radiogroup" aria-label={t('searchP3.relation')}>
            {relationValues.map(relation => {
              const Icon = relations[relation]
              const checked = config.relation === relation
              return <label key={relation} className="phase3-relation-option">
                <input type="radio" className="sr-only" name={groupName} checked={checked}
                  onChange={event => {
                    onConfig({ ...config, relation })
                    const popup = event.currentTarget.closest('details')
                    if (popup) {
                      popup.open = false
                      popup.querySelector('summary')?.focus()
                    }
                  }} />
                <Icon size={17} aria-hidden="true" />
                <span>{t(`searchP3.relation.${relation}`)}</span>
                <span className="phase3-radio-indicator" aria-hidden="true">{checked && <Check size={17} />}</span>
              </label>
            })}
          </div>
        </div>
      </details>}
      <button className="chip" type="button" data-phase3-roots aria-pressed={includeRoots} onClick={onRoots}>
        <Sprout size={14} aria-hidden="true" />{t('ui.702b74fe3e')}
      </button>
      <button className="chip" type="button" data-phase3-more aria-expanded={moreOpen} aria-controls={moreId}
        data-changed={activeFilters > 0} onClick={event => {
          const openPopup = event.currentTarget.closest('.phase3-options')?.querySelector('details[open]')
          openPopup?.removeAttribute('open')
          const next = !moreOpen
          writeStored(researchOpenKey, next)
          setMoreOpen(next)
        }}>
        <Tags size={14} aria-hidden="true" />
        {t('searchP3.research')}{activeFilters > 0 && <> · {t('searchP3.activeFilters', { count: activeFilters })}</>}
        <ChevronDown size={12} aria-hidden="true" />
      </button>
    </div>
    {researchHost ? createPortal(research, researchHost) : research}
  </div>
}
