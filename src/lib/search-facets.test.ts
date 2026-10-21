import { expect, test } from 'bun:test'
import { filterSearchFacets, searchFacetCounts } from './search-facets'
import type { QuranSearchResult } from './quran-search'
const result: QuranSearchResult = { s: 20, a: 1, words: ['a', 'b', 'c'], waw: [], parts: { 1: 2, 2: 2, 3: 2 }, positions: [1, 2, 3], kind: 'exact', score: 0,
  morphology: [['علم', 'عَلِمَ', 'I'], ['علم', 'عَلَّمَ', 'II'], ['علم', 'عَلِمَ', 'I']] }
test('facet OR within one group and AND across groups applies to the same matched word', () => {
  expect(filterSearchFacets([result], { lemmas: ['عَلِمَ', 'عَلَّمَ'], forms: [] })[0].positions).toEqual([1, 2, 3])
  expect(filterSearchFacets([result], { lemmas: ['عَلَّمَ'], forms: ['II'] })[0].positions).toEqual([2])
  expect(filterSearchFacets([result], { lemmas: ['عَلَّمَ'], forms: ['I'] })).toEqual([])
  expect(filterSearchFacets([result], { lemmas: [], forms: ['II'] })[0].parts).toEqual({ 2: 2 })
})
test('facet counts include matching occurrences and leave alternatives selectable', () => {
  expect(searchFacetCounts([result], { lemmas: [], forms: ['II'] }, 'forms')).toEqual([{ value: 'I', count: 2 }, { value: 'II', count: 1 }])
  expect(searchFacetCounts([result], { lemmas: [], forms: ['II'] }, 'lemmas')).toEqual([{ value: 'عَلَّمَ', count: 1 }])
})
