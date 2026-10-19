import { expect, test } from 'bun:test'
import { createSearchSession, type SearchCorpus } from './quran-search-session'
import corpus from '../../public/data/quran-search.json'
const search = createSearchSession(corpus as unknown as SearchCorpus)

test('multiple surahs constrain textual results together', () => {
  const hits = search('رحمة', { surahs: [19, 20] })
  expect(hits.length).toBeGreaterThan(0)
  expect(hits.every(r => r.s === 19 || r.s === 20)).toBe(true)
  expect(search('رحمة').length).toBeGreaterThan(hits.length)
})
test('same-root expansion uses attested roots and can find a different form within the scope', () => {
  const literal = search('اذهب', { surahs: [20] })
  const expanded = search('اذهب', { surahs: [20], includeRoots: true })
  expect(expanded.some(r => r.a === 63 && r.positions.includes(11))).toBe(true) // يذهبا
  expect(expanded.length).toBeGreaterThan(literal.length)
  expect(expanded.every(r => r.s === 20)).toBe(true)
})
test('occurrence filter supports changing scope and toggling root vs lemma', () => {
  const filter = { s: 20, a: 24, pos: 1, text: 'ٱذْهَبْ', root: 'ذهب', tab: 'root' as const }
  const local = search('', { surahs: [20], includeRoots: true }, filter)
  expect(local.map(r => r.a)).toEqual([24, 42, 43, 63, 97])
  const all = search('', { includeRoots: true }, filter)
  expect(all.length).toBeGreaterThan(local.length)
  const knowledge = { ...filter, a: 114, pos: 17, text: 'عِلْمًۭا', root: 'علم' }
  const rootHits = search('', { surahs: [20], includeRoots: true }, knowledge)
  const lemma = search('', { surahs: [20], includeRoots: false }, knowledge)
  expect(rootHits.length).toBeGreaterThan(lemma.length)
  expect(lemma.some(r => r.a === 114)).toBe(true)
})
test('attached pronouns match one lemma while independent waw remains separate', () => {
  const filter = { s: 20, a: 80, pos: 12, text: 'عَلَيْكُمُ', root: null, tab: 'word' as const }
  const hits = search('', { surahs: [20] }, filter)
  expect(hits.some(r => r.a === 5 && r.positions.includes(2))).toBe(true)
  expect(hits.some(r => r.a === 73 && r.positions.includes(9))).toBe(true)
})
