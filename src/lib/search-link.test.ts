import { expect, test } from 'bun:test'
import { initialSearchLinkState, readSearchLink, searchLink, type SearchLinkState } from './search-link'
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
test('relative navigation commands keep their surah context when shared',()=>{
  const state:SearchLinkState={...base,query:'ق۶',mode:'text',contextSurah:20}
  expect(readSearchLink(searchLink('https://example.com',state).href)).toEqual(state)
})

test('phase 3 links preserve scope context, sort precedence and distinct facets', () => {
  const state: SearchLinkState = {
    ...base, contextSurah: 20, scopeVariant: 'after', surahs: [21, 22], lemmas: ['legacy-lemma'], forms: ['II'],
    phase3: { relation: 'phrase', sorts: ['relevance', 'mushaf', 'relevance'], roots: ['علم', 'علم'], lemmas: ['عِلْم'], forms: ['IV'] },
  }
  const expected: SearchLinkState = {
    ...base, contextSurah: 20, scopeVariant: 'after', surahs: [21, 22], lemmas: ['legacy-lemma'], forms: ['II'],
    phase3: { relation: 'phrase', sorts: ['relevance', 'mushaf'], roots: ['علم'], lemmas: ['عِلْم'], forms: ['IV'] },
  }
  const web = searchLink('https://example.com/s/2', state)
  expect(web.searchParams.getAll('sort')).toEqual(['relevance', 'mushaf'])
  expect(readSearchLink(web.href)).toEqual(expected)
  const native = searchLink('https://tauri.localhost', state, true)
  expect(native.searchParams.get('search')).toBe('1')
  expect(readSearchLink(native.href)).toEqual(expected)
})

test('unknown phase 3 settings do not change a legacy link', () => {
  expect(readSearchLink('/q?q=علم&m=r&scope=unknown&rel=invalid&sort=invalid&fr=&fl=&ff=')).toEqual(base)
  expect(readSearchLink('/q?q=علم&m=r&scope=medinan&rel=all&sort=mushaf&sort=invalid&sort=mushaf')?.phase3).toEqual({
    relation: 'all', sorts: ['mushaf'], roots: [], lemmas: [], forms: [],
  })
})

test('co-occurrence and spelling preferences round trip with default legacy behavior', () => {
  const state: SearchLinkState = { ...base, phase3: { relation: 'all', sorts: ['mushaf'], roots: [], lemmas: [], forms: [], cooccurrence: 'context', spellingSensitive: true } }
  for (const native of [false, true]) expect(readSearchLink(searchLink('https://example.com', state, native).href)).toEqual(state)
  expect(readSearchLink('/q?q=علم&m=r&co=unknown&sp=garbage')).toEqual(base)
})

test('handoffs keep explicit phase 3 scope and the original reading context', () => {
  const state = initialSearchLinkState('s', {
    query: 'لا تخف', mode: 'text', surahs: [19, 20], contextSurah: 21, scopeVariant: 'before',
    phase3: { relation: 'any', sorts: [], roots: [], lemmas: [], forms: [] },
  })
  expect(state).toMatchObject({
    query: 'لا تخف', surahs: [19, 20], contextSurah: 21, scopeVariant: 'before', phase3: { relation: 'any' },
  })
})
