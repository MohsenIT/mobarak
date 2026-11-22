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
test('a trailing space continues a complete word within the chosen surah', () => {
  expect(suggest('بسم ', 'text', [1])).toEqual(['بِسْمِ ٱللَّهِ'])
  expect(suggest('بسم ', 'text', [20])).toEqual([])
})
test('a trailing space after a phrase suggests the immediate next word', () => {
  expect(suggest('بسم الله  ', 'text', [1])).toEqual(['بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ'])
  expect(suggest('مالك يوم الدين ', 'text', [1])).toEqual([])
})
test('unvocalized and Uthmani input find the same canonical phrase spelling', () => {
  const phrase = 'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'
  expect(suggest('الرحمن   الرح', 'text', [1])).toEqual([phrase])
  expect(suggest('ٱلرَّحْمَـٰنِ الرح', 'text', [1])).toEqual([phrase])
})
test('phrases that differ only in Quranic marks are offered once', () => {
  expect(suggest('لا تخف', 'text', [11, 27, 28])).toEqual(['لَا تَخَفْ'])
})
test('next-word completions prioritize the most frequent attested phrases', () => {
  expect(suggest('وعد ').slice(0, 2)).toEqual(['وَعَدَ ٱللَّهُ', 'وُعِدَ ٱلْمُتَّقُونَ ۖ'])
})
test('root and lemma suggestions stay Arabic and support a single initial letter', () => {
  expect(suggest('ع', 'root')).toContain('علم')
  expect(suggest('على', 'lemma').some(value => normalizeQuranSearch(value) === 'علي')).toBe(true)
})

test('live completions extend the query and obey even a single-word scope', () => {
  expect(suggest('طه', 'text', [20], true)).toEqual([])
  expect(suggest('الرح', 'text', [1], true)).toContain('ٱلرَّحْمَـٰنِ')
  expect(suggest('لا تخف', 'text', [11, 27, 28], true)).toEqual([])
  expect(suggest('علم', 'root', [1], true)).toEqual([])
})
