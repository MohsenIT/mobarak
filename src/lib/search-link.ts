import type { AnalysisSelection } from './analysis'
import type { SearchMode } from './quran-search-session'
import type { Phase3SearchOptions } from './search-query'
import type { Translator } from './quran'
import type { VerseAddress } from './verse-link'
import {isTranslator} from './translations'

export const SEARCH_AND_GO_PHASE_2 = process.env.NEXT_PUBLIC_SEARCH_AND_GO === '1' && process.env.NEXT_PUBLIC_SEARCH_AND_GO_PHASE_2 === '1'
export const SEARCH_AND_GO_PHASE_3 = SEARCH_AND_GO_PHASE_2 && process.env.NEXT_PUBLIC_SEARCH_AND_GO_PHASE_3 === '1'

export type SearchResultPosition = { scrollTop: number; visible: number; anchor?: { s: number; a: number; offset: number } }
export type SearchResultSnapshot = { query: string; position: SearchResultPosition; state?: SearchLinkState; selected?: VerseAddress }

const scopeVariants = ['all', 'current', 'selected', 'before', 'after', 'meccan', 'medinan', 'single'] as const
export type SearchScopeVariant = typeof scopeVariants[number]
export type SearchPhase3State = Phase3SearchOptions

export type SearchLinkState = {
  query: string; mode: SearchMode; contextSurah?: number; surahs: number[]; lemmas: string[]; forms: string[]
  includeRoots: boolean; includePartial: boolean; includeNear: boolean
  showTranslation: boolean; translator: Translator; occurrence: AnalysisSelection | null
  scopeVariant?: SearchScopeVariant; phase3?: SearchPhase3State
}

export function initialSearchLinkState(
  translator: Translator,
  start?: Pick<SearchLinkState, 'query' | 'mode' | 'surahs' | 'contextSurah' | 'scopeVariant' | 'phase3'>,
  occurrence: AnalysisSelection | null = null,
): SearchLinkState {
  return {
    query: start?.query ?? '', mode: start?.mode ?? 'text', surahs: start?.surahs ?? [],
    lemmas: [], forms: [], includeRoots: occurrence?.tab === 'root',
    includePartial: true, includeNear: false, showTranslation: false, translator, occurrence,
    ...(start?.contextSurah ? { contextSurah: start.contextSurah } : {}),
    ...(start?.scopeVariant ? { scopeVariant: start.scopeVariant } : {}),
    ...(start?.phase3 ? { phase3: start.phase3 } : {}),
  }
}
const tabs = { r: 'root', f: 'form', w: 'word' } as const
const codes = { root: 'r', form: 'f', word: 'w' } as const
const phase3Facets = { fr: 'roots', fl: 'lemmas', ff: 'forms' } as const

function sortedFacets(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort()
}

export function readSearchLink(href: string): SearchLinkState | null {
  const url = new URL(href, 'https://quran-vajeh.vercel.app')
  if (!/^\/(q|search)\/?$/.test(url.pathname) && url.searchParams.get('search') !== '1') return null
  const p = url.searchParams
  const bounded = (raw: string | undefined, max: number) => { const n = Number(raw); return Number.isInteger(n) && n >= 1 && n <= max ? n : 0 }
  const values = (key: string) => [...new Set(p.getAll(key).slice(0, 100).map(value => value.slice(0, 160)))]
  const scope = p.get('scope')
  const scopeVariant = scopeVariants.find(value => value === scope)
  const rawRelation = p.get('rel')
  const relation = rawRelation === 'all' || rawRelation === 'any' || rawRelation === 'phrase' ? rawRelation : undefined
  const sorts = values('sort').filter(value => value === 'mushaf' || value === 'relevance')
  const roots = sortedFacets(values('fr'))
  const lemmas = sortedFacets(values('fl'))
  const forms = sortedFacets(values('ff'))
  const cooccurrence = p.get('co')
  const broader = cooccurrence === 'context' || cooccurrence === 'surah'
  const spellingSensitive = p.get('sp') === '1'
  const orderedWords = p.get('wo') === '1'
  const reverseSort = p.get('dir') === 'desc'
  const phase3 = relation || sorts.length || roots.length || lemmas.length || forms.length || broader || spellingSensitive || orderedWords || reverseSort
    ? { relation: relation ?? 'all', sorts, ...(reverseSort ? { reverseSort } : {}), roots, lemmas, forms, ...(orderedWords ? { orderedWords } : {}), ...(broader ? { cooccurrence } : {}), ...(spellingSensitive ? { spellingSensitive } : {}) } satisfies SearchPhase3State
    : undefined
  const [tab, s, a, pos] = (p.get('o') || '').split('.')
  const occurrence: AnalysisSelection | null = Object.hasOwn(tabs, tab) && bounded(s, 114) && bounded(a, 286) && bounded(pos, 500) ? {
    tab: tabs[tab as keyof typeof tabs], s: Number(s), a: Number(a), pos: Number(pos),
    root: p.get('r')?.slice(0, 80) || null, text: p.get('w')?.slice(0, 160) || '',
    ...(p.get('f') ? { form: p.get('f')!.slice(0, 20) } : {}), ...(p.get('px') === '1' ? { part: 'prefix' as const } : {}),
  } : null
  return {
    ...(bounded(p.get('at')??undefined,114)?{contextSurah:Number(p.get('at'))}:{}),
    query: (p.get('q') || '').slice(0, 160), mode: p.get('m') === 'r' ? 'root' : p.get('m') === 'l' ? 'lemma' : 'text',
    surahs: [...new Set((p.get('s') || '').split(',').map(value => bounded(value, 114)).filter(Boolean))].sort((a,b) => a-b),
    lemmas: values('l'), forms: values('b'), includeRoots: p.get('h') !== '0', includePartial: p.get('p') !== '0', includeNear: p.get('n') === '1',
    showTranslation: p.get('t') === '1', translator: isTranslator(p.get('tr')) ? p.get('tr') as Translator : 's', occurrence,
    ...(scopeVariant ? { scopeVariant } : {}),
    ...(phase3 ? { phase3 } : {}),
  }
}
export function searchLink(current: string, state: SearchLinkState, native = false): URL {
  const url = new URL(current)
  url.pathname = native ? '/' : '/q'; url.search = ''; url.hash = ''
  const p = url.searchParams
  if (native) p.set('search', '1')
  if (state.query) p.set('q', state.query)
  if (state.contextSurah) p.set('at', String(state.contextSurah))
  if (state.mode !== 'text') p.set('m', state.mode === 'root' ? 'r' : 'l')
  if (state.surahs.length) p.set('s', [...new Set(state.surahs)].sort((a,b) => a-b).join(','))
  for (const lemma of [...new Set(state.lemmas)].sort()) p.append('l', lemma)
  for (const form of [...new Set(state.forms)].sort()) p.append('b', form)
  if (!state.includeRoots) p.set('h', '0')
  if (!state.includePartial) p.set('p', '0')
  if (state.includeNear) p.set('n', '1')
  if (state.showTranslation) p.set('t', '1')
  if (state.translator !== 's') p.set('tr', state.translator)
  if (state.scopeVariant) p.set('scope', state.scopeVariant)
  if (state.phase3) {
    p.set('rel', state.phase3.relation)
    if (state.phase3.cooccurrence && state.phase3.cooccurrence !== 'verse') p.set('co', state.phase3.cooccurrence)
    if (state.phase3.orderedWords) p.set('wo', '1')
    if (state.phase3.spellingSensitive) p.set('sp', '1')
    if (state.phase3.reverseSort) p.set('dir', 'desc')
    for (const sort of new Set(state.phase3.sorts)) p.append('sort', sort)
    for (const [param, facet] of Object.entries(phase3Facets)) {
      for (const value of sortedFacets(state.phase3[facet])) p.append(param, value)
    }
  }
  const o = state.occurrence
  if (o && Object.hasOwn(codes, o.tab)) {
    p.set('o', `${codes[o.tab as keyof typeof codes]}.${o.s}.${o.a}.${o.pos}`)
    if (o.root) p.set('r', o.root)
    if (o.text) p.set('w', o.text)
    if (o.form) p.set('f', o.form)
    if (o.part === 'prefix') p.set('px', '1')
  }
  return url
}
