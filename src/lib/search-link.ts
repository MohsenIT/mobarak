import type { AnalysisSelection } from './analysis'
import type { SearchMode } from './quran-search-session'
import type { Translator } from './quran'

export type SearchLinkState = {
  query: string; mode: SearchMode; contextSurah?: number; surahs: number[]; lemmas: string[]; forms: string[]
  includeRoots: boolean; includePartial: boolean; includeNear: boolean
  showTranslation: boolean; translator: Translator; occurrence: AnalysisSelection | null
}
const tabs = { r: 'root', f: 'form', w: 'word' } as const
const codes = { root: 'r', form: 'f', word: 'w' } as const
export function readSearchLink(href: string): SearchLinkState | null {
  const url = new URL(href, 'https://quran-vajeh.vercel.app')
  if (!/^\/(q|search)\/?$/.test(url.pathname) && url.searchParams.get('search') !== '1') return null
  const p = url.searchParams
  const bounded = (raw: string | undefined, max: number) => { const n = Number(raw); return Number.isInteger(n) && n >= 1 && n <= max ? n : 0 }
  const values = (key: string) => [...new Set(p.getAll(key).slice(0, 100).map(value => value.slice(0, 160)))]
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
    showTranslation: p.get('t') === '1', translator: ['s','a','f','m'].includes(p.get('tr') || '') ? p.get('tr') as Translator : 's', occurrence,
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
