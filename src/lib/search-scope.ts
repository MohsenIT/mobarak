import type { Meta } from './quran'
import type { SearchScopeVariant } from './search-link'
import { normalizeDigits } from './locale-numbers'
import { normalizeQuranSearch } from './quran-search'
import { readStored } from './reader-storage'

export const searchScopeStorage = 'mushaf.search-scope.v1'
export type SearchScopeSelection = { variant: SearchScopeVariant; surahs: number[] }

export function readSearchScope(): SearchScopeSelection {
  const value = readStored<Partial<SearchScopeSelection> | null>(searchScopeStorage, null)
  const variant = value?.variant
  if (variant !== 'selected' && variant !== 'single' && variant !== 'meccan' && variant !== 'medinan') {
    return { variant: 'all', surahs: [] }
  }
  const surahs = Array.isArray(value?.surahs) ? value.surahs.filter(n => Number.isInteger(n) && n >= 1 && n <= 114) : []
  return { variant, surahs: [...new Set(surahs)].sort((a, b) => a - b) }
}

export function scopeSurahs(meta: Meta, origin: number, scope: SearchScopeVariant, surahs: number[]): number[] {
  switch (scope) {
    case 'all': return []
    case 'current': return [origin]
    case 'single': return [surahs[0] ?? origin]
    case 'selected': return surahs
    case 'before': return meta.surahs.filter(s => s.n < origin).map(s => s.n)
    case 'after': return meta.surahs.filter(s => s.n > origin).map(s => s.n)
    case 'meccan': return meta.surahs.filter(s => s.rev === 'makkah').map(s => s.n)
    case 'medinan': return meta.surahs.filter(s => s.rev === 'madinah').map(s => s.n)
  }
}

export function filterScopeSurahs(meta: Meta, query: string, selected: number[], counts?: Record<number, number>) {
  const key = (value: string) => normalizeQuranSearch(normalizeDigits(value)).replaceAll(' ', '')
  const normalized = key(query)
  const match = meta.surahs.filter(surah => {
    if (counts && !counts[surah.n] && !selected.includes(surah.n)) return false
    if (!normalized) return true
    return key(surah.fa).includes(normalized) || key(surah.ar).includes(normalized) || String(surah.n).includes(normalized)
  })
  return match.sort((a, b) => (counts?.[b.n] ?? 0) - (counts?.[a.n] ?? 0) || a.n - b.n)
}
