/// <reference types="bun-types" />
import { expect, test } from 'bun:test'
import { analysisOccurrences, matchesAnalysis, nextAnalysisLocation, type AnalysisSelection } from './analysis'
import { formName } from './quran'
import taha from '../../public/data/surah/20.json'
import type { SurahData } from './quran'
const tahaData: SurahData = { ...taha, ri: Object.fromEntries(Object.entries(taha.ri).map(([root, occurrences]) => [root, occurrences.map(([a, pos]) => [a, pos] as [number, number])])) }
const surah: SurahData = { n: 1, ar: '', fa: '', vc: 2, ri: {}, v: [
  { n: 1, p: 1, j: 1, w: [{ t: 'a', r: 'علم', form: 'II', l: null }, { t: 'b', r: 'علم', form: 'V', l: null }] },
  { n: 2, p: 1, j: 1, w: [{ t: 'a', r: 'قول', form: 'II', l: null }] },
] }
const base: AnalysisSelection = { tab: 'root', s: 1, a: 1, pos: 1, text: 'a', root: 'علم', form: 'II' }
test('root and form select different sets, word selects one location, verse selects all its words', () => {
  expect(analysisOccurrences(surah, base)).toEqual([[1, 1], [1, 2]])
  expect(analysisOccurrences(surah, { ...base, tab: 'form' })).toEqual([[1, 1]])
  expect(analysisOccurrences(surah, { ...base, tab: 'word' })).toEqual([[1, 1], [2, 1]])
  expect(matchesAnalysis({ ...base, tab: 'word' }, 1, 2, 1, surah.v[1].w[0])).toBe(false)
  expect(matchesAnalysis({ ...base, tab: 'verse' }, 1, 1, 2, surah.v[0].w[1])).toBe(true)
  expect(matchesAnalysis({ ...base, tab: 'verse' }, 1, 2, 1, surah.v[1].w[0])).toBe(false)
  expect(matchesAnalysis(base, 2, 1, 1, surah.v[0].w[0])).toBe(false)
})
test('missing form does not select unannotated words', () => {
  expect(analysisOccurrences(surah, { ...base, tab: 'form', form: undefined })).toEqual([])
})

test('each tab moves between its own units rather than changing the other selections', () => {
  expect(nextAnalysisLocation(surah, base, 1)).toEqual([2, 1]) // next different root
  expect(nextAnalysisLocation(surah, { ...base, tab: 'form' }, 1)).toEqual([1, 2]) // next different form
  expect(nextAnalysisLocation(surah, { ...base, tab: 'word' }, 1)).toEqual([1, 2])
  expect(nextAnalysisLocation(surah, { ...base, tab: 'verse' }, 1)).toEqual([2, 1])
  expect(nextAnalysisLocation(surah, { ...base, tab: 'verse', a: 2 }, 1)).toEqual([2, 1])
  expect(base.a).toBe(1)
  expect(base.pos).toBe(1)
})

test('Alqa in Taha shows ilqa and selects only lqy in form IV', () => {
  const anchor = taha.v[64].w[10]
  expect(anchor.r).toBe('لقي')
  expect(anchor.form).toBe('IV')
  expect(formName(anchor.r ?? null, anchor.form)).toBe('إلقاء')
  const target: AnalysisSelection = { tab: 'form', s: 20, a: 65, pos: 11, text: anchor.t, root: anchor.r ?? null, form: anchor.form }
  const occurrences = analysisOccurrences(tahaData, target)
  expect(occurrences).toHaveLength(10)
  expect(occurrences.every(([a, pos]) => taha.v[a - 1].w[pos - 1].r === 'لقي')).toBe(true)
})
