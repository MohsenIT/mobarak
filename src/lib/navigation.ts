import type { Meta, SurahMeta } from './quran'
import { SURAH_ALIASES } from './surah-aliases'
export type JumpKind = 'surah' | 'page' | 'juz' | 'verse'
export type Destination = { kind: 'surah'; s: number } | { kind: 'page'; p: number } | { kind: 'verse'; s: number; a: number }
export function normalizeSearch(value: string): string {
  return value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/[\u200c\sـ]/g, '').toLowerCase()
}
function nameKey(value: string) { return normalizeSearch(value).replace(/^ال/, '') }
function surahKeys(s: SurahMeta) { return [s.fa, s.ar, ...(SURAH_ALIASES[s.n] ?? [])].map(nameKey) }
function surahScore(s: SurahMeta, query: string): number {
  if (String(s.n) === normalizeSearch(query)) return 0
  const key = nameKey(query)
  if (!key) return 3
  const names = surahKeys(s)
  return names.includes(key) ? 0 : names.some(name => name.startsWith(key)) ? 1 : names.some(name => name.includes(key)) ? 2 : Infinity
}
export function searchSurahs(meta: Meta, input: string): SurahMeta[] {
  if (!normalizeSearch(input)) return meta.surahs
  return meta.surahs.map(s => ({ s, score: surahScore(s, input) })).filter(item => Number.isFinite(item.score)).sort((a, b) => a.score - b.score || a.s.n - b.s.n).map(item => item.s)
}
function findSurah(meta: Meta, query: string) {
  const exact = meta.surahs.filter(s => surahScore(s, query) === 0)
  if (exact.length === 1) return exact[0]
  const matches = searchSurahs(meta, query)
  return matches.length === 1 ? matches[0] : undefined
}
export function resolveDestination(meta: Meta, kind: JumpKind, input: string, currentSurah: number): Destination | null {
  let value = input.trim()
  const prefix = value.match(/^(سوره|صفحه|جزء|آیه)\s+/)
  if (prefix) {
    kind = ({ سوره: 'surah', صفحه: 'page', جزء: 'juz', آیه: 'verse' } as const)[prefix[1] as 'سوره']
    value = value.slice(prefix[0].length)
  }
  if (!value) return null
  if (kind === 'surah') {
    const s = findSurah(meta, value)
    return s ? { kind: 'surah', s: s.n } : null
  }
  if (kind === 'verse') {
    const parts = value.split(/[:：/]/)
    if (parts.length > 2) return null
    const s = parts.length === 2 ? findSurah(meta, parts[0]) : meta.surahs[currentSurah - 1]
    const number = normalizeSearch(parts[parts.length - 1])
    const a = /^\d+$/.test(number) ? Number(number) : NaN
    return s && Number.isInteger(a) && a >= 1 && a <= s.vc ? { kind: 'verse', s: s.n, a } : null
  }
  const number = normalizeSearch(value)
  const n = /^\d+$/.test(number) ? Number(number) : NaN
  if (!Number.isInteger(n)) return null
  if (kind === 'page') return n >= 1 && n <= 604 ? { kind: 'page', p: n } : null
  const first = meta.juz[String(n)]
  return n >= 1 && n <= 30 && first ? { kind: 'verse', s: first[0], a: first[1] } : null
}

export type DestinationSuggestion = { destination: Destination; label: string }
/** Infer the destination after typing; show explicit choices for ambiguous numbers. */
export function destinationSuggestions(meta: Meta, input: string, currentSurah: number): DestinationSuggestion[] {
  const value = input.trim()
  if (!value) return []
  const label = (destination: Destination) => destination.kind === 'surah' ? `سورهٔ ${meta.surahs[destination.s - 1]?.fa}` : destination.kind === 'page' ? `صفحهٔ ${destination.p}` : `${meta.surahs[destination.s - 1]?.fa} · آیهٔ ${destination.a}`
  const prefix = value.match(/^(سوره|صفحه|جزء|آیه)\s+/)
  if (prefix || /[:：/]/.test(value)) {
    const destination = resolveDestination(meta, /[:：/]/.test(value) ? 'verse' : 'surah', value, currentSurah)
    return destination ? [{ destination, label: prefix?.[1] === 'جزء' ? `جزء ${normalizeSearch(value.replace(/^جزء\s+/, ''))}` : label(destination) }] : []
  }
  if (/^\d+$/.test(normalizeSearch(value))) {
    return (['surah', 'verse', 'page', 'juz'] as const).flatMap(kind => {
      const destination = resolveDestination(meta, kind, value, currentSurah)
      return destination ? [{ destination, label: kind === 'juz' ? `جزء ${normalizeSearch(value)}` : label(destination) }] : []
    })
  }
  return searchSurahs(meta, value).slice(0, 6).map(s => {
    const alias = SURAH_ALIASES[s.n]?.find(alias => nameKey(alias) === nameKey(value))
    return { destination: { kind: 'surah' as const, s: s.n }, label: alias ? `سورهٔ ${s.fa} (${alias})` : `سورهٔ ${s.fa}` }
  })
}
