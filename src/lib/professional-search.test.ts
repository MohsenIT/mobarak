import { expect, test } from 'bun:test'
import { createProfessionalWordMatcher } from './professional-word'
import { createSearchSession, type SearchCorpus } from './quran-search-session'
import { countQuranSearchResults } from './quran-search'
import { defaultPhase3SearchOptions } from './search-query'
import source from '../../public/data/quran-search.json'

const phase3 = defaultPhase3SearchOptions()
const run = createSearchSession({
  verses: [
    [20, 1, ['قَالَ', 'مُوسَىٰ']],
    [20, 2, ['قَالَ', 'رَبٌّ', 'مُوسَىٰ', 'فَتْحٌ']],
    [20, 3, ['قَالَ', 'رَبٌّ', 'عِلْمٌ', 'مُوسَىٰ', 'خَوْفٌ']],
    [20, 4, ['مُوسَىٰ', 'قَالَ']],
    [20, 5, ['رَحْمَةٌ', 'رَبٌّ']],
    [20, 6, ['ذِكْرٌ', 'مُلْكٌ', 'مَٰلِكٌ', 'وَمُلْكٌ', 'وَجْهٌ']],
    [20, 7, ['ذَكَرَ', 'جَهْدٌ', 'وَجَهْدٌ']],
    [21, 1, ['حَزَنٌ', 'رَحْمَةٌ']],
  ],
  waw: { '20:6': [4], '20:7': [3] },
  morphology: { '20:6': [['ذكر', 'ذِكْر', null], ['ملك', 'مُلْك', null], ['ملك', 'مَٰلِك', null], ['ملك', 'مُلْك', null], ['وجه', 'وَجْه', null]] },
} satisfies SearchCorpus)
const find = (query: string, options = {}) => run(query, { phase3, includePartial: false, ...options })
const ayahs = (results: ReturnType<typeof run>) => results.map(hit => hit.a)

test('letter wildcards are anchored, count letters, and preserve fixed marks', () => {
  expect(find('مل؟')[0].positions).toEqual([2, 3, 4])
  expect(find('م*ك')[0].positions).toEqual([2, 3, 4])
  expect(find('مُل*')[0].positions).toEqual([2, 4])
  expect(find('*ملك')[0].positions).toEqual([2, 3, 4])
  expect(find('ملك*', { includeNear: true, includePartial: true })[0].positions).toEqual([2, 3, 4])
  expect(find('ق*ى')).toEqual([])
  expect(find('م?لك')).toEqual([])
  expect(createProfessionalWordMatcher('ش?ء', { exact: true })('شَاءَ')).toBe(true)
  expect(createProfessionalWordMatcher('ش?', { exact: true })('شَاءَ')).toBe(false)
  expect(find('*')).toEqual([])
  expect(find('?')).toEqual(expect.arrayContaining([expect.objectContaining({ a: 6, parts: { 4: 1 } })]))
})

test('gaps count only intervening Quran positions, preserve order, and highlight only endpoints', () => {
  expect(ayahs(find('قال ...{۰} موسى'))).toEqual([1])
  expect(ayahs(find('قال (*) موسى'))).toEqual([2])
  expect(ayahs(find('قال …{٢} موسى'))).toEqual([3])
  expect(ayahs(find('قال ...{1,2} موسى'))).toEqual([2, 3])
  expect(ayahs(find('قال ... موسى ...{0} فتح'))).toEqual([2])
  expect(find('قال ...{0,10} موسى')[2].positions).toEqual([1, 4])
  expect(find('قال ...{2,1} موسى')).toEqual([])
  expect(find('قال ...{-1} موسى')).toEqual([])
  expect(find('و ...{0} ملك')[0].parts).toEqual({ 4: 3 })
})

test('negation and proximity use the selected unit and never cross surahs', () => {
  expect(find('رحمة ...{1} ذِكر')).toEqual([])
  for (const cooccurrence of ['context', 'surah'] as const) {
    expect(ayahs(find('رحمة ...{1} ذِكر', { phase3: { ...phase3, cooccurrence } }))).toEqual([5, 6])
    expect(find('رحمة ... حزن', { phase3: { ...phase3, cooccurrence } })).toEqual([])
  }
  expect(ayahs(find('قال -خوف'))).toEqual([1, 2, 4])
  expect(find('قال -خوف', { phase3: { ...phase3, cooccurrence: 'surah' } })).toEqual([])
  const negatives = find('-خوف', { surahs: [21] })
  expect(countQuranSearchResults(negatives)).toEqual({ verses: 1, words: 0, occurrences: 0 })
  expect(negatives[0].positions).toEqual([])
})

test('Boolean precedence, nested exclusions, positive evidence and old modes', () => {
  expect(ayahs(find('فتح | موسى خوف'))).toEqual([2, 3])
  expect(ayahs(find('(فتح | موسى) خوف'))).toEqual([3])
  expect(ayahs(find('قال -(علم | (رب فتح)) -حزن'))).toEqual([1, 4])
  expect(ayahs(find('قال -(علم فتح)'))).toEqual([1, 2, 3, 4])
  expect(ayahs(find('قال -«رب موسى»'))).toEqual([1, 3, 4])
  expect(ayahs(find('قال -خو*'))).toEqual([1, 2, 4])
  expect(ayahs(find('قال ... موسى -خوف'))).toEqual([1, 2])
  expect(find('فتح | فتح')[0].occurrences).toEqual([[4]])
  const any = { phase3: { ...phase3, relation: 'any' as const } }
  expect(ayahs(find('فتح خوف', any))).toEqual([2, 3])
  expect(find('(فتح خوف)', any)).toEqual([])
})

test('explicit conjunction uses corpus word parts, and lexical waw remains part of the stem', () => {
  for (const query of ['وملك', 'و ملك', '"وملك"', 'وَم*ك']) {
    expect(find(query)[0].parts).toEqual({ 4: 3 })
  }
  expect(find('وجه')[0].parts).toEqual({ 5: 2 })
  expect(find('جهد')[0].parts).toEqual({ 2: 2, 3: 2 })
  expect(find('و جه', { includePartial: true })[0].parts).toEqual({ 3: 3 })
  expect(find('وجهد', { includeNear: true })[0].parts).toEqual({ 3: 3 })
  const both = find('وملك | ملك')[0]
  expect(both.positions).toEqual([2, 3, 4])
  expect(both.occurrences).toEqual([[2], [3], [4]])
})

test('diacritics use per-letter subsets, including reordered combining marks', () => {
  expect(ayahs(find('ذكر'))).toEqual([6, 7])
  expect(ayahs(find('ذِكر', { includeNear: true }))).toEqual([6])
  expect(ayahs(find('ذَكر'))).toEqual([7])
  expect(ayahs(find('"ذِكْر"'))).toEqual([6])
  expect(ayahs(find('(ذِكر | قال) -ذَكر'))).toEqual([1, 2, 3, 4, 6])
  expect(createProfessionalWordMatcher('رٌّ', { exact: true })('رٌّ')).toBe(true)
  expect(createProfessionalWordMatcher('رٌّ', { exact: true })('رٌ')).toBe(false)
  expect(createProfessionalWordMatcher('ذُكر', { exact: true })('ذِكْر')).toBe(false)
})

test('root and lemma patterns use morphology rather than the surface word', () => {
  expect(find('مل?', { mode: 'root' })[0].positions).toEqual([2, 3, 4])
  expect(find('مُل*', { mode: 'lemma' })[0].positions).toEqual([2, 4])
  expect(find('مُل*', { mode: 'root' })).toEqual([])
  expect(find('و مل?', { mode: 'root' })[0].parts).toEqual({ 4: 3 })
})

test('real Quran verifies script equivalence, restrictive spelling, marks and ordered proximity', () => {
  const search = createSearchSession(source as unknown as SearchCorpus)
  const query = (text: string, more = {}) => search(text, { phase3, includePartial: false, ...more })
  const identity = (text: string) => query(text).map(hit => [hit.s, hit.a, hit.positions])
  for (const spellings of [['رويا', 'رؤیا'], ['صلاة', 'صلات', 'صلوة'], ['حاجة', 'حاجت'], ['الرحمن', 'الرحمان']]) {
    const [head, ...tail] = spellings
    const expected = identity(head)
    expect(expected.length).toBeGreaterThan(0)
    for (const spelling of tail) expect(identity(spelling)).toEqual(expected)
  }
  expect(query('"رويا"').some(hit => hit.s === 12 && hit.a === 43)).toBe(true)
  expect(identity('"رؤیا"')).toEqual(identity('"رويا"'))
  expect(query('"رويا"', { phase3: { ...phase3, spellingSensitive: true } })).toEqual([])
  expect(query('قال ...{0,10} موسى', { surahs: [20] }).some(hit => hit.a === 91)).toBe(false)
  expect(query('قال ...{0,10} موسى').some(hit => hit.s === 7 && hit.a === 104)).toBe(true)
  expect(query('ذِكر').length).toBeGreaterThan(0)
  expect(query('ذِكر').length).toBeLessThan(query('ذكر').length)
})
