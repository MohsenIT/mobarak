import { test, expect } from 'bun:test'
import { splitWord, wordTarget, wordKey } from './word-parts'
import { analysisOccurrences, nextAnalysisLocation } from './analysis'
import type { SurahData } from './quran'
import taha from '../../public/data/surah/20.json'

test('only corpus-tagged waw is detachable; original text remains intact', () => {
  for (const t of ['وَعَدَ', 'وَلَدَ', 'وَاحِد']) expect(splitWord({ t }).stem).toBe(t)
  expect(splitWord({ t: 'وَأَمَّا', wa: true })).toEqual({ prefix: 'وَ', stem: 'أَمَّا' })
  expect(wordTarget({ t: 'وَأَمَّا', wa: true, l: null }, 'prefix')).toEqual({ text: 'وَ', root: null, part: 'prefix' })
  expect(wordKey('۞ وَ')).toBe('و')
})
test('amma and wa-amma share occurrences, while waw has independent occurrences and navigation', () => {
  const surah: SurahData = { n: 1, ar: '', fa: '', vc: 1, ri: {}, v: [{ n: 1, p: 1, j: 1, w: [{ t: 'أَمَّا', l: null }, { t: 'وَأَمَّا', wa: true, l: null }, { t: 'وَعَدَ', l: null }] }] }
  const selection = { tab: 'word' as const, s: 1, a: 1, pos: 1, text: 'أَمَّا', root: null }
  expect(analysisOccurrences(surah, selection)).toEqual([[1, 1], [1, 2]])
  expect(analysisOccurrences(surah, { ...selection, part: 'prefix', text: 'وَ' })).toEqual([[1, 2]])
  expect(nextAnalysisLocation(surah, selection, 1)).toEqual([1, 2, 'prefix'])
  expect(nextAnalysisLocation(surah, { ...selection, pos: 2, part: 'prefix' }, 1)).toEqual([1, 2, 'stem'])
})
test('Taha ma occurrences include independent and prefixed ma', () => {
  const selection = { tab: 'word' as const, s: 20, a: 6, pos: 4, text: 'مَا', root: null }
  const hits = analysisOccurrences({ ...taha, ri: {} }, selection)
  expect(hits.some(([a, pos]) => !!taha.v[a - 1].w[pos - 1].wa)).toBe(true)
  expect(hits.some(([a, pos]) => !taha.v[a - 1].w[pos - 1].wa)).toBe(true)
})

test('lemma repetitions include ala with attached pronouns, without merging unrelated words', () => {
  const surah = taha as SurahData
  const word = surah.v[79].w[11]
  const selection = { tab: 'word' as const, s: 20, a: 80, pos: 12, ...wordTarget(word) }
  const hits = analysisOccurrences(surah, selection)
  expect(hits).toContainEqual([5, 2]) // على
  expect(hits).toContainEqual([2, 3]) // عليك
  expect(hits).toContainEqual([45, 7]) // علينا
  expect(hits).toContainEqual([73, 9]) // عليه
  expect(hits).toContainEqual([81, 10]) // عليكم
  expect(hits.every(([a, pos]) => surah.v[a - 1].w[pos - 1].lemma === word.lemma)).toBe(true)
  expect(analysisOccurrences(surah, { ...selection, a: 5, pos: 2, ...wordTarget(surah.v[4].w[1]) })).toEqual(hits)
})
