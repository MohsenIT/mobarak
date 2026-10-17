import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import corpus from '../../public/data/quran-search.json'
import { displayWordText } from './word-parts'
import { createQuranSearch, normalizeQuranSearch, typoDistance, type SearchVerse } from './quran-search'
const search = createQuranSearch(corpus.verses as SearchVerse[], corpus.waw)

test('search keys normalize Persian/Arabic forms, marks, wasla and presentation forms', () => {
  expect(normalizeQuranSearch('إِيَّاكَ کَریم يى')).toBe(normalizeQuranSearch('ایاک کریم یی'))
  expect(normalizeQuranSearch('ٱللَّهُ')).toBe('الله')
  expect(normalizeQuranSearch('بِسْمِ\u200c اللّٰه')).toBe('بسم الله')
  expect(normalizeQuranSearch('ﷲ')).toBe('الله')
})
test('a real Quran phrase accepts Persian letters and ignores diacritics', () => {
  const result = search('ذلک الکتاب لا ریب فیه')[0]
  expect([result.s, result.a, result.kind]).toEqual([2, 2, 'exact'])
  expect(result.positions).toEqual([1, 2, 3, 4, 5])
  expect(search('الْحَمْدُ لِلَّهِ')[0].s).toBe(1)
})
test('Uthmani small letters accept common modern spelling without changing original text', () => {
  const result = search('رب العالمین')[0]
  expect([result.s, result.a, result.kind]).toEqual([1, 2, 'exact'])
  expect(search('واقیموا الصلاة').some(r => r.s === 2 && r.a === 43 && r.kind === 'exact')).toBe(true)
})
test('spaces inside and between words can be omitted or added', () => {
  expect(search('بسماللهالرحمنالرحیم')[0].kind).toBe('exact')
  expect(search('بسم الله الرح من الرحیم').some(r => r.s === 1 && r.a === 1 && r.kind === 'exact')).toBe(true)
})
test('small typos and transpositions return nearby original verses with an explicit kind', () => {
  const withTypos = (query: string) => search(query, 0, { includeNear: true })
  expect(typoDistance('الرحمن', 'الرحنم', 2)).toBe(1)
  expect(withTypos('ذلک الکتاب لا ریب فیخ').some(r => r.s === 2 && r.a === 2 && r.kind === 'near')).toBe(true)
  expect(withTypos('المتسقم').some(r => r.s === 1 && r.a === 6 && r.kind === 'near')).toBe(true)
  expect(withTypos('ذلن الکتاب لا ریب فیخ').some(r => r.s === 2 && r.a === 2 && r.kind === 'near')).toBe(true)
  expect(withTypos('المتسقیم').some(r => r.s === 1 && r.a === 6 && r.kind === 'near')).toBe(true)
  expect(search('الله')[0].kind).toBe('exact')
  expect(search('الله', 2).find(r => r.a === 20)?.positions.length).toBe(2)
})
test('verse count and optional scope are correct; noise and short queries do not match everything', () => {
  expect(corpus.verses.length).toBe(6236)
  expect(search('الله', 112).every(result => result.s === 112)).toBe(true)
  expect(search('الله', 112).length).toBeGreaterThan(0)
  expect(search('ص')).toEqual([])
  expect(search('َ۞')).toEqual([])
  expect(search('xyzzyqz')).toEqual([])
})

test('search corpus preserves every canonical verse and word', () => {
  const canonical: SearchVerse[] = []
  const waw: Record<string, number[]> = {}
  for (let s = 1; s <= 114; s++) {
    const data = JSON.parse(readFileSync(new URL(`../../public/data/surah/${s}.json`, import.meta.url), 'utf8'))
    for (const verse of data.v) {
      canonical.push([s, verse.n, verse.w.map((word: { t: string }) => word.t)])
      const positions = verse.w.flatMap((word: { wa?: boolean }, i: number) => word.wa ? [i + 1] : [])
      if (positions.length) waw[`${s}:${verse.n}`] = positions
    }
  }
  expect(corpus.verses).toEqual(canonical)
  expect(corpus.waw as Record<string, number[]>).toEqual(waw)
})
test('long phrases are matched in full rather than silently truncated', () => {
  const local = createQuranSearch([[1, 1, [...Array(25).fill('قال'), 'الله']]])
  expect(local([...Array(25).fill('قال'), 'الرحيم'].join(' '))).toEqual([])
})

test('search snippets detach corpus-tagged waw without changing canonical positions or lexical waw', () => {
  const result = search('لا تخف', 20).find(result => result.a === 21)!
  expect(result).toBeDefined()
  const pos = result.words.findIndex(word => normalizeQuranSearch(word) === 'ولا') + 1
  expect(result.waw).toContain(pos)
  expect(normalizeQuranSearch(displayWordText({ t: result.words[pos - 1], wa: result.waw.includes(pos) }))).toBe('و لا')
  expect(displayWordText({ t: 'وَعَدَ' })).toBe('وَعَدَ')

})

test('a phrase starting after independent waw is exact, including omitted spaces', () => {
  for (const query of ['لا تخف', 'لاتخف', 'ولا تخف', 'و لا تخف']) {
    const result = search(query, 20).find(result => result.a === 21)!
    expect(result.kind).toBe('exact')
    expect(result.score).toBe(0)
  }
  const local = createQuranSearch([[1, 1, ['لَا', 'تَخَفْ', 'وَلَا', 'تَخَفْ', 'وَعَدَ']]], { '1:1': [3] })
  expect(local('لا تخف')[0].positions).toEqual([1, 2, 3, 4])
  expect(local('عد')[0].kind).toBe('partial') // lexical waw is not a word boundary
  expect(local('عد')[0].score).toBeGreaterThan(0)
})

test('highlights select the matched stem and include waw only when it was queried', () => {
  for (const query of ['لا تخف', 'لاتخف']) {
    const result = search(query, 20).find(result => result.a === 21)!
    const pos = result.words.findIndex(word => normalizeQuranSearch(word) === 'ولا') + 1
    expect(result.parts[pos]).toBe(2)
    expect(result.parts[pos + 1]).toBe(2)
  }
  const result = search('ولا تخف', 20).find(result => result.a === 21)!
  const pos = result.words.findIndex(word => normalizeQuranSearch(word) === 'ولا') + 1
  expect(result.parts[pos]).toBe(3)
  const repeated = createQuranSearch([[1, 1, ['وَلَا', 'تَخَفْ', 'قَالَ', 'لَا', 'تَخَفْ']]], { '1:1': [1] })('لا تخف')[0]
  expect(repeated.parts).toEqual({ 1: 2, 2: 2, 4: 2, 5: 2 })
})

test('exact occurrences do not hide other literal occurrences within the same verse', () => {
  const result = search('زبد').find(result => result.s === 13 && result.a === 17)!
  const expected = result.words.flatMap((word, i) => normalizeQuranSearch(word).includes('زبد') ? [i + 1] : [])
  expect(expected.length).toBe(3)
  expect(result.positions).toEqual(expected)
  expect(result.kind).toBe('exact')
  for (const pos of expected) expect(result.parts[pos]).toBe(2)
  const local = createQuranSearch([[1, 1, ['زَبَدٌ', 'الزَّبَدُ', 'زَبَدًا', 'زَادَ']]])('زبد')[0]
  expect(local.positions).toEqual([1, 2, 3])
  expect(local.score).toBe(0)
})

test('partial matches and spelling tolerance can be controlled independently', () => {
  const options = { includePartial: true, includeNear: false }
  expect(search('ذلک الکتاب لا ریب فیخ', 2, options).some(r => r.a === 2)).toBe(false)
  expect(search('ذلک الکتاب لا ریب فیخ', 2, { ...options, includeNear: true }).some(r => r.a === 2 && r.kind === 'near')).toBe(true)
  const local = createQuranSearch([[1, 1, ['الزَّبَدُ']], [1, 2, ['زَبَدٌ', 'الزَّبَدُ']]])
  expect(local('زبد', 0, options).map(r => r.a)).toEqual([2, 1])
  const strict = local('زبد', 0, { includePartial: false, includeNear: false })
  expect(strict.map(r => r.a)).toEqual([2])
  expect(strict[0].positions).toEqual([1])
  expect(search('لاتخف', 20, { includePartial: false, includeNear: false }).find(r => r.a === 21)?.kind).toBe('exact')
  expect(search('ذلک الکتاب لا ریب فیه', 2, options)[0].kind).toBe('exact')
})

test('default search includes literal partials but excludes spelling suggestions', () => {
  expect(search('ذلک الکتاب لا ریب فیخ').some(r => r.kind === 'near')).toBe(false)
  expect(search('زبد').find(r => r.s === 13 && r.a === 17)?.positions.length).toBe(3)
})
