import { expect, test } from 'bun:test'
import { groupOccurrencesByAyah, occurrenceTokens, occurrenceWindow } from './occurrence-context'
import type { SurahData } from './quran'
import taha from '../../public/data/surah/20.json'
const surah: SurahData = { ...taha, ri: {} }
test('an opening word includes the preceding ayah and its marker', () => {
  const result = occurrenceWindow(occurrenceTokens(surah), 24, 1)
  expect(result.tokens.slice(0, result.target).some(t => t.kind === 'word' && t.a === 23)).toBe(true)
  expect(result.tokens.slice(0, result.target).some(t => t.kind === 'marker' && t.a === 23)).toBe(true)
  expect(result.tokens[result.target]).toMatchObject({ kind: 'word', a: 24, pos: 1, text: 'ٱذْهَبْ' })
  expect(result.tokens.some(t => t.kind === 'word' && t.a === 25)).toBe(true)
})
test('the full target verse remains available for horizontal reading', () => {
  const result = occurrenceWindow(occurrenceTokens(surah), 10, 4)
  const words = result.tokens.filter(t => t.kind === 'word' && t.a === 10 && t.part === 'stem')
  expect(words.length).toBe(surah.v[9].w.length)
})
test('waw and stem targets stay distinct, and surah edges do not wrap', () => {
  const tokens = occurrenceTokens(surah)
  for (const part of ['prefix', 'stem'] as const) {
    const result = occurrenceWindow(tokens, 21, 3, part)
    expect(result.tokens[result.target]).toMatchObject({ a: 21, pos: 3, part })
  }
  const first = occurrenceWindow(tokens, 1, 1)
  expect(first.target).toBe(0)
  expect(first.tokens.some(t => t.a === surah.vc)).toBe(false)
})

test('three occurrences in Taha 72 occupy one ayah row without losing locations', () => {
  const occurrences: [number, number][] = surah.v.flatMap(verse => verse.w.flatMap((word, i): [number, number][] => word.r === 'قضي' ? [[verse.n, i + 1]] : []))
  const groups = groupOccurrencesByAyah(occurrences)
  expect(occurrences).toEqual([[72, 11], [72, 14], [72, 16], [114, 11]])
  expect(groups.map(group => [group.a, group.locations.length])).toEqual([[72, 3], [114, 1]])
  expect(groups[0].indexes).toEqual([0, 1, 2])
  expect(groups[0].locations).toEqual(occurrences.slice(0, 3))
})
