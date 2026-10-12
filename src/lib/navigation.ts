import type { Meta, SurahMeta } from './quran'
export type JumpKind = 'surah' | 'page' | 'juz' | 'verse'
export type Destination = { kind: 'surah'; s: number } | { kind: 'page'; p: number } | { kind: 'verse'; s: number; a: number }
export function normalizeSearch(value: string): string {
  return value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[أإآ]/g, 'ا').replace(/[\u200c\sـ]/g, '').toLowerCase()
}
export function searchSurahs(meta: Meta, input: string): SurahMeta[] {
  const query = normalizeSearch(input)
  if (!query) return meta.surahs
  return meta.surahs.filter(s => String(s.n) === query || normalizeSearch(s.fa).includes(query) || normalizeSearch(s.ar).includes(query))
}
function findSurah(meta: Meta, query: string) {
  const normalized = normalizeSearch(query)
  const exact = meta.surahs.filter(s => String(s.n) === normalized || normalizeSearch(s.fa) === normalized || normalizeSearch(s.ar) === normalized)
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
