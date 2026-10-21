import type { QuranSearchResult } from './quran-search'
export type SearchFacetSelection = { lemmas: string[]; forms: string[] }
export function filterSearchFacets(results: QuranSearchResult[], selection: SearchFacetSelection): QuranSearchResult[] {
  if (!selection.lemmas.length && !selection.forms.length) return results
  return results.flatMap(result => {
    const positions = result.positions.filter(pos => {
      const [, lemma, form] = result.morphology?.[pos - 1] ?? []
      return (!selection.lemmas.length || !!lemma && selection.lemmas.includes(lemma)) && (!selection.forms.length || !!form && selection.forms.includes(form))
    })
    return positions.length ? [{ ...result, positions, parts: Object.fromEntries(positions.map(pos => [pos, result.parts[pos]])) }] : []
  })
}
export function searchFacetCounts(results: QuranSearchResult[], selection: SearchFacetSelection, kind: 'lemmas' | 'forms') {
  const column = kind === 'lemmas' ? 1 : 2
  const counts = new Map<string, number>()
  // Keep alternatives in the current group available; apply the other group.
  for (const result of filterSearchFacets(results, { ...selection, [kind]: [] })) for (const pos of result.positions) {
    const value = result.morphology?.[pos - 1]?.[column]
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'ar'))
}
