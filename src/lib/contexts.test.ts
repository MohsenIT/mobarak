/// <reference types="bun-types" />
import { expect, test } from 'bun:test'
import { getContext, getSurahContexts, nextContext } from './contexts'
import { matchesAnalysis, nextAnalysisLocation, type AnalysisSelection } from './analysis'
import meta from '../../public/data/meta.json'
import shura from '../../public/data/surah/42.json'
import type { SurahData } from './quran'

test('every explicit source partition covers its surah exactly once', () => {
  let count = 0
  for (const s of meta.surahs) {
    const entry = getSurahContexts(s.n)
    expect(entry).toBeDefined()
    let last = 0
    for (const range of entry!.ranges) {
      expect(range.from).toBe(last + 1)
      expect(range.to).toBeGreaterThanOrEqual(range.from)
      expect(range.to).toBeLessThanOrEqual(s.vc)
      expect(range.sourcePage).toBeGreaterThanOrEqual(2)
      expect(range.sourcePage).toBeLessThanOrEqual(23)
      last = range.to; count++
    }
    expect(last).toBe(s.vc)
  }
  expect(count).toBe(593)
})
test('context boundaries follow the context column, not daily reading sections', () => {
  expect(getContext(2, 16)).toMatchObject({ from: 1, to: 27 })
  expect(getContext(2, 28)).toMatchObject({ from: 28, to: 39 })
  expect(getContext(4, 176)).toMatchObject({ from: 176, to: 176 })
  expect(getContext(18, 21)).toMatchObject({ from: 9, to: 21 })
  expect(getContext(40, 23)).toMatchObject({ from: 23, to: 50 })
  expect(getContext(53, 30)).toMatchObject({ from: 1, to: 30 })
})
test('whole-surah clarification and aggregate ranges retain their provenance', () => {
  expect(getContext(114, 1)).toMatchObject({ from: 1, to: 6, origin: 'user-clarification' })
  expect(getSurahContexts(114)?.status).toBe('whole-surah')
  expect(getContext(42, 40)).toMatchObject({ from: 29, to: 53, sourceLabel: 'پنجم و ششم و هفتم' })
})
test('context navigation and highlighting stay within the provided boundaries', () => {
  expect(nextContext(2, 27, 1)).toMatchObject({ from: 28, to: 39 })
  expect(nextContext(2, 1, -1)).toMatchObject({ from: 1, to: 27 })
  const selection: AnalysisSelection = { tab: 'context', s: 42, a: 1, pos: 1, root: null, text: '', from: 1, to: 6 }
  expect(nextAnalysisLocation(shura as SurahData, selection, 1)).toEqual([7, 1])
  expect(matchesAnalysis(selection, 42, 6, 2, { t: '', l: null })).toBe(true)
  expect(matchesAnalysis(selection, 42, 7, 1, { t: '', l: null })).toBe(false)
  expect(matchesAnalysis({ ...selection, from: undefined, to: undefined }, 42, 1, 1, { t: '', l: null })).toBe(false)
})
