import { expect, test } from 'bun:test'
import { createSearchSuggestions } from './search-suggestions'
import { normalizeQuranSearch } from './quran-search'
import corpus from '../../public/data/quran-search.json'
import type { SearchCorpus } from './quran-search-session'
const suggest = createSearchSuggestions(corpus as unknown as SearchCorpus)
test('text autocomplete suggests attested Arabic words from partial input', () => {
  const values = suggest('تعل', 'text')
  expect(values.length).toBeGreaterThan(0)
  expect(values.every(value => normalizeQuranSearch(value, true).startsWith('تعل'))).toBe(true)
  expect(values.every(value => !/[A-Za-z]/.test(value))).toBe(true)
})
test('phrase completions preserve the actual adjacent words and selected surah scope', () => {
  const values = suggest('لا تخ', 'text', [20])
  expect(values.length).toBeGreaterThan(0)
  const verses = corpus.verses.filter(v => v[0] === 20).map(v => normalizeQuranSearch((v[2] as string[]).join(' '), true))
  expect(values.every(value => verses.some(verse => verse.includes(normalizeQuranSearch(value, true))))).toBe(true)
})
test('root and lemma suggestions stay Arabic and support a single initial letter', () => {
  expect(suggest('ع', 'root')).toContain('علم')
  expect(suggest('على', 'lemma').some(value => normalizeQuranSearch(value) === 'علي')).toBe(true)
})
