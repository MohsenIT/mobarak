export type OccurrenceScope = 'previous' | 'surah' | 'next' | 'quran'

/** A scope changes the search area, never the selected root/lemma criterion. */
export function occurrenceScopeSurahs(scope: OccurrenceScope, current: number): number[] | null {
  if (!Number.isInteger(current) || current < 1 || current > 114) return null
  if (scope === 'quran') return []
  const number = current + (scope === 'previous' ? -1 : scope === 'next' ? 1 : 0)
  return number >= 1 && number <= 114 ? [number] : null
}
