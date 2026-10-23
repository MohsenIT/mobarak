import { expect, test } from 'bun:test'
import { readSearchLink, searchLink, type SearchLinkState } from './search-link'
import { readingUrl } from './verse-link'
const base: SearchLinkState = { query: 'علم', mode: 'root', surahs: [], lemmas: [], forms: [], includeRoots: true, includePartial: true, includeNear: false, showTranslation: false, translator: 's', occurrence: null }
test('short search URLs omit defaults and remove reading/refresh parameters', () => {
  const url = searchLink('https://example.com/s/20/a/7?_refresh=123', base)
  expect(url.pathname).toBe('/q')
  expect([...url.searchParams.entries()]).toEqual([['q', 'علم'], ['m', 'r']])
  expect(readSearchLink(url.href)).toEqual(base)
})
test('all search settings and multiple facets round trip', () => {
  const state: SearchLinkState = { ...base, query: 'لا تخف', mode: 'text', surahs: [2, 20, 114], lemmas: ['عِلْم', 'تَعْلِيم'], forms: ['II', 'V'], includeRoots: false, includePartial: false, includeNear: true, showTranslation: true, translator: 'f' }
  expect(readSearchLink(searchLink('https://example.com', state).href)).toEqual({ ...state, lemmas: [...state.lemmas].sort() })
})
test('occurrence links preserve lemma/form identity including prefix selection', () => {
  const state: SearchLinkState = { ...base, query: '', occurrence: { tab: 'word', s: 20, a: 72, pos: 11, root: 'قضي', text: 'فَٱقْضِ', part: 'prefix', form: 'I' } }
  expect(readSearchLink(searchLink('https://example.com', state).href)).toEqual(state)
  const native = searchLink('https://tauri.localhost', state, true)
  expect(native.pathname).toBe('/')
  expect(readSearchLink(native.href)).toEqual(state)
})
test('invalid destinations are ignored and reading links shed search state', () => {
  expect(readSearchLink('https://example.com/s/20')).toBeNull()
  const parsed = readSearchLink('https://example.com/search?q=test&s=0,20,999,20&m=bogus&o=r.999.1.1')!
  expect(parsed.surahs).toEqual([20]); expect(parsed.mode).toBe('text'); expect(parsed.occurrence).toBeNull()
  const reader = readingUrl(searchLink('https://example.com', base).href, 'flow', 20, 1)
  expect(reader.pathname).toBe('/s/20'); expect(reader.search).toBe('')
})
