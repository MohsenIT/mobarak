import { expect, test } from 'bun:test'
import { createSearchSession, type SearchCorpus } from './quran-search-session'
import { countQuranSearchResults } from './quran-search'
import { unrecordedSearchForm } from './search-query'
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

test('a directly typed root works without a seed verse, including spaced letters', () => {
  const direct = search('علم', { mode: 'root', surahs: [2, 3, 20] })
  expect(direct.length).toBeGreaterThan(0)
  expect(direct.every(r => [2, 3, 20].includes(r.s) && r.positions.every(pos => r.morphology?.[pos - 1]?.[0] === 'علم'))).toBe(true)
  expect(search('ع ل م', { mode: 'root', surahs: [2, 3, 20] })).toEqual(direct)
})
test('direct lemma search groups inflections while keeping different lemmas separate', () => {
  const hits = search('عَلَىٰ', { mode: 'lemma', surahs: [20] })
  expect(hits.some(r => r.a === 5)).toBe(true)
  expect(hits.some(r => r.a === 80 && r.positions.includes(12))).toBe(true)
})

test('رحم does not invent a word from الجوارح مكلبين or other adjacent word edges', () => {
  for (const includeRoots of [false, true]) {
    const hits = search('رحم', { includeNear: false, includeRoots })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some(r => r.s === 5 && r.a === 4)).toBe(false)
    expect(hits.every(r => r.positions.every(pos => r.morphology?.[pos - 1]?.[0] === 'رحم'))).toBe(true)
  }
})

test('real Quran counts distinguish repeated matches, highlighted words and verses', () => {
  const repeated = search('زَبَد', { surahs: [13] })
  expect(repeated.map(r => [r.a, r.occurrences])).toEqual([[17, [[10], [21], [29]]]])
  expect(countQuranSearchResults(repeated)).toEqual({ occurrences: 3, words: 3, verses: 1 })

  for (const query of ['لَا تَخَفْ', 'لاتخف']) {
    const phrase = search(query, { surahs: [20] })
    expect(phrase.map(r => [r.a, r.occurrences])).toEqual([[21, [[3, 4]]], [68, [[2, 3]]], [77, [[14, 15]]]])
    expect(phrase[0].parts).toEqual({ 3: 2, 4: 2 })
    expect(countQuranSearchResults(phrase)).toEqual({ occurrences: 3, words: 6, verses: 3 })
  }
})

test('expanding a literal match counts each new root occurrence once', () => {
  const expanded = search('اذهب', { surahs: [20], includeRoots: true })
  expect(expanded.find(r => r.a === 24)?.occurrences).toEqual([[1]])
  expect(expanded.find(r => r.a === 63)?.occurrences).toEqual([[11]])
})

const phase3 = { relation: 'all' as const, sorts: ['mushaf' as const], roots: [], lemmas: [], forms: [] }

test('a conjunction cannot supply the first letter of a partial or fuzzy word match', () => {
  const options = { phase3, includePartial: true, includeRoots: true }
  for (const includeNear of [false, true]) {
    const hits = search('سلم وجه', { ...options, includeNear })
    expect(hits.some(({ s, a }) => s === 22 && a === 78)).toBe(false)
    expect(hits.some(({ s, a }) => s === 2 && a === 112)).toBe(true)
  }
  const local = createSearchSession({ verses: [[1, 1, ['وَجَهْدٌ', 'وَجْهٌ']]], waw: { '1:1': [1] }, morphology: {} })
  expect(local('وجه', { phase3, includeNear: true })[0].parts).toEqual({ 2: 2 })
})

test('the word count includes a separately matched conjunction', () => {
  const local = createSearchSession({ verses: [[1, 1, ['وَلَا', 'تَخَفْ']]], waw: { '1:1': [1] }, morphology: {} })
  const phrase = { ...phase3, relation: 'phrase' as const }
  expect(countQuranSearchResults(local('و لا تخف', { phase3: phrase }))).toEqual({ occurrences: 1, words: 3, verses: 1 })
})

test('multiword lemma and root searches find both stems in Yusuf 76', () => {
  for (const mode of ['lemma', 'root'] as const) {
    const options = { mode, phase3, surahs: [12] }
    expect(search('دین ملک', options).map(r => [r.a, r.positions])).toEqual([[76, [19, 20]]])
    expect(search('«دین ملک»', options).map(r => [r.a, r.occurrences])).toEqual([[76, [[19, 20]]]])
    expect(search('«ملک دین»', options)).toEqual([])
    expect(search('دین ملک', { ...options, phase3: { ...phase3, relation: 'any' } }).length).toBeGreaterThan(1)
  }
})

test('all and any run independent clauses in the same verse, across real Quran data', () => {
  const options = { surahs: [20], phase3 }
  const all = search('تخف موسى', options)
  const any = search('تخف موسى', { ...options, phase3: { ...phase3, relation: 'any' } })
  expect(all.map(r => r.a)).toEqual([77])
  expect(any.map(r => r.a)).toContain(9)
  expect(any.length).toBeGreaterThan(all.length)
})

test('exact phrase boundaries respect the independent waw and canonical positions', () => {
  const options = { surahs: [20], phase3 }
  const hits = search('«لا تخف»', options)
  expect(hits.map(r => r.a)).toEqual([21, 68, 77])
  expect(hits[0]).toMatchObject({ occurrences: [[3, 4]], parts: { 3: 2, 4: 2 } })
  expect(search('“و لا تخف”', options)[0]).toMatchObject({ a: 21, parts: { 3: 3, 4: 2 } })
  expect(search('لاتخف', { ...options, phase3: { ...phase3, relation: 'phrase' } })).toEqual([])
  const local = createSearchSession({ verses: [[1, 1, ['قال', 'ولا', 'تخف']]], waw: { '1:1': [2] }, morphology: {} })
  expect(local('"قال لا"', { phase3 })).toEqual([])
  expect(local('"قال و لا"', { phase3 })[0].occurrences).toEqual([[1, 2]])
})

test('morphology groups must share one matched stem and values within a group are alternatives', () => {
  const local = createSearchSession({
    verses: [[1, 1, ['قال', 'كتب']], [1, 2, ['قال', 'كتب']]],
    morphology: { '1:1': [['قول', 'say', 'I'], ['كتب', 'write', 'II']], '1:2': [['قول', 'say', 'II'], ['كتب', 'write', 'I']] },
  })
  const options = { phase3: { ...phase3, roots: ['قول', 'علم'], lemmas: ['say'], forms: ['II'] } }
  expect(local('قال كتب', options).map(r => [r.a, r.positions, r.occurrences])).toEqual([[2, [1], [[1]]]])
  expect(local('"قال كتب"', options).map(r => [r.a, r.occurrences])).toEqual([[2, [[1, 2]]]])
})

test('relevance uses frequency, proximity and stable verse ordering', () => {
  const local = createSearchSession({
    verses: [[1, 1, ['قال', 'من', 'ثم', 'كتب']], [1, 2, ['قال', 'كتب', 'من', 'ثم']], [1, 3, ['قال', 'قال', 'كتب', 'ثم']], [1, 4, ['قال', 'كتب', 'من', 'ثم']]],
    morphology: {},
  })
  expect(local('قال كتب', { phase3 }).map(r => r.a)).toEqual([1, 2, 3, 4])
  expect(local('قال كتب', { phase3: { ...phase3, reverseSort: true } }).map(r => r.a)).toEqual([4, 3, 2, 1])
  for (const reverseSort of [false, true]) {
    expect(local('قال كتب', { phase3: { ...phase3, reverseSort, sorts: ['relevance', 'mushaf'] } }).map(r => r.a)).toEqual([3, 2, 4, 1])
  }
})

test('broader all-word search keeps real verses, uses source context ranges and never crosses surahs', () => {
  const options = { surahs: [20], includePartial: false, phase3 }
  expect(search('تخف نارا', options)).toEqual([])
  const contexts = search('تخف نارا', { ...options, phase3: { ...phase3, cooccurrence: 'context' } })
  expect(contexts.map(r => [r.a, r.occurrences, r.cooccurrenceGroup])).toEqual([
    [10, [[3], [9]], { unit: 'context', from: 9, to: 23 }],
    [21, [[4]], { unit: 'context', from: 9, to: 23 }],
  ])
  expect(countQuranSearchResults(contexts)).toEqual({ occurrences: 3, words: 3, verses: 2 })
  const surah = search('تخف نارا', { ...options, phase3: { ...phase3, cooccurrence: 'surah' } })
  expect(surah.map(r => r.a)).toEqual([10, 21, 68, 77])
  expect(surah[0].cooccurrenceGroup).toEqual({ unit: 'surah', from: 1, to: 135 })
  expect(search('"تخف نارا"', { ...options, phase3: { ...phase3, cooccurrence: 'surah' } })).toEqual([])
  const local = createSearchSession({ verses: [[115, 1, ['تخف']], [115, 2, ['نارا']], [116, 1, ['موسى']]], morphology: {} })
  expect(local('تخف نارا', { phase3: { ...phase3, cooccurrence: 'context' } })).toEqual([])
  expect(local('تخف موسى', { phase3: { ...phase3, cooccurrence: 'surah' } })).toEqual([])
})

test('explicit relaxed spellings use attested verses, while sensitive mode keeps the written distinctions', () => {
  const relaxed = { phase3, surahs: [12, 24] }
  const sensitive = { ...relaxed, phase3: { ...phase3, spellingSensitive: true } }
  for (const spelling of ['رویا', 'رؤیا']) {
    expect(search(spelling, relaxed).map(r => [r.s, r.a])).toEqual([[12, 5], [12, 43], [12, 100]])
    expect(search(spelling, { ...sensitive, includeNear: true })).toEqual([])
  }
  expect(search('رُءْيَاكَ', sensitive).map(r => [r.s, r.a])).toEqual([[12, 5]])
  for (const spelling of ['صلاة', 'صلات']) expect(search(spelling, relaxed).some(r => r.s === 24 && r.a === 58)).toBe(true)
  expect(search('صلاة صلات', relaxed).find(r => r.s === 24 && r.a === 58)?.occurrences).toEqual([[17], [26]])
  expect(search('صلات', sensitive).some(r => r.s === 24 && r.a === 58)).toBe(false)
  expect(search('صلاة', sensitive).some(r => r.s === 24 && r.a === 58)).toBe(false)
  expect(search('"صَلَوٰة"', sensitive).map(r => [r.s, r.a])).toEqual([[24, 58]])
  expect(search('«لا تخف»', { ...sensitive, surahs: [20] })[0]).toMatchObject({ a: 21, parts: { 3: 2, 4: 2 } })
  const local = createSearchSession({ verses: [[1, 1, ['رُويَا']], [1, 2, ['رُؤيَا']], [1, 3, ['صَلاة']], [1, 4, ['صَلات']]], morphology: {} })
  for (const [index, word] of ['رویا', 'رؤیا', 'صلاة', 'صلات'].entries()) {
    expect(local(word, { phase3: sensitive.phase3 }).map(r => r.a)).toEqual([index + 1])
  }
})

test('prayer spelling variants do not seed the unrelated فصل root, and facets retain word order', () => {
  for (const spelling of ['صلاه', 'صلات']) {
    const results = search(`صابر ${spelling}`, { includeRoots: true, includePartial: true, phase3 })
    expect(results.some(result => result.s === 2 && result.a === 249)).toBe(false)
    const verse = results.find(result => result.s === 2 && result.a === 153)!
    expect(verse.facetPositions?.map(group => [...new Set(group.map(pos => verse.morphology?.[pos - 1]?.[0]))])).toEqual([['صبر'], ['صلو']])
  }
})

test('exact phrases retain separate facet positions in query order', () => {
  const results = search('دين الملك', { phase3: { ...phase3, relation: 'phrase' } })
  const verse = results.find(result => result.s === 12 && result.a === 76)!
  expect(verse.facetPositions?.map(group => group.map(pos => verse.morphology?.[pos - 1]?.[0]))).toEqual([['دين'], ['ملك']])
})

test('unrecorded form keeps the seven prayer matches countable and filterable', () => {
  const hits = search('صابر صلاه', { includeRoots: true, phase3 })
  const forms = hits.flatMap(result => result.facetPositions?.[1].map(pos => result.morphology?.[pos - 1]?.[2]) ?? [])
  expect(forms).toEqual(Array(7).fill(null))
  const filtered = search('صابر صلاه', { includeRoots: true, phase3: { ...phase3, forms: [unrecordedSearchForm] } })
  expect(filtered.map(result => [result.s, result.a])).toEqual(hits.map(result => [result.s, result.a]))
  expect(filtered.flatMap(result => result.positions.map(pos => result.morphology?.[pos - 1]?.[2]))).not.toContain('VIII')
})

test('an attested typed root expands without a literal token spelling', () => {
  const options = { includeRoots: true, phase3, surahs: [79] }
  expect(search('برز جحم', options).map(r => [r.a, r.positions])).toEqual(
    search('برز جحیم', options).map(r => [r.a, r.positions]),
  )
  expect(search('برز جحم', options).some(r => r.a === 36)).toBe(true)
  expect(search('برز جحم', { ...options, includeRoots: false })).toEqual([])
})

test('word order is optional, allows intervening words, and requires repeated words to use distinct hits', () => {
  const local = createSearchSession({
    verses: [[1, 1, ['قال', 'ثم', 'كتب']], [1, 2, ['كتب', 'قال']], [1, 3, ['قال', 'ثم', 'قال']]],
    morphology: {},
  })
  const ordered = { ...phase3, orderedWords: true }
  expect(local('قال كتب', { phase3 }).map(r => r.a)).toEqual([1, 2])
  expect(local('قال كتب', { phase3: ordered }).map(r => r.a)).toEqual([1])
  expect(local('كتب قال', { phase3: ordered }).map(r => r.a)).toEqual([2])
  expect(local('قال قال', { phase3: ordered }).map(r => r.a)).toEqual([3])
  expect(local('قال كتب', { phase3: { ...ordered, relation: 'phrase' } })).toEqual([])
  expect(local('قال غفر', { phase3: { ...ordered, relation: 'any' } }).map(r => r.a)).toEqual([1, 2, 3])
})

test('word order across a surah retains only verses participating in an ordered sequence', () => {
  const local = createSearchSession({
    verses: [[1, 1, ['كتب']], [1, 2, ['قال']], [1, 3, ['كتب']], [1, 4, ['قال']], [2, 1, ['كتب']]],
    morphology: {},
  })
  expect(local('قال كتب', { phase3: { ...phase3, orderedWords: true, cooccurrence: 'surah' } }).map(r => [r.s,r.a]))
    .toEqual([[1,2], [1,3]])
})
