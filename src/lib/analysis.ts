import type { SurahData, Word } from './quran'

export type AnalysisTab = 'root' | 'form' | 'word' | 'verse'
export interface AnalysisSelection {
  tab: AnalysisTab
  s: number
  a: number
  pos: number
  root: string | null
  text: string
  form?: string
  from?: number
  to?: number
}

export function matchesAnalysis(selection: AnalysisSelection | null | undefined, s: number, a: number, pos: number, word: Word): boolean {
  if (!selection || selection.s !== s) return false
  switch (selection.tab) {
    case 'root': return !!selection.root && word.r === selection.root
    case 'form': return !!selection.form && word.form === selection.form
    case 'word': return selection.a === a && selection.pos === pos
    case 'verse': return selection.a === a
  }
}

export function analysisOccurrences(surah: SurahData, selection: AnalysisSelection): [number, number][] {
  const occurrences: [number, number][] = []
  for (const verse of surah.v) for (const [i, word] of verse.w.entries()) {
    // Word statistics and its occurrence list count exact written words;
    // the actual selection remains a single word at a single location.
    const match = selection.tab === 'word' ? word.t === selection.text : matchesAnalysis(selection, surah.n, verse.n, i + 1, word)
    if (match) occurrences.push([verse.n, i + 1])
  }
  return occurrences
}

/** Each tab navigates its own unit, preserving the other tabs' targets. */
export function nextAnalysisLocation(surah: SurahData, selection: AnalysisSelection, direction: number): [number, number] | null {
  if (selection.tab === 'verse') return [Math.max(1, Math.min(surah.vc, selection.a + direction)), 1]
  const units: { key: string; location: [number, number] }[] = []
  const seen = new Set<string>()
  for (const verse of surah.v) for (const [i, word] of verse.w.entries()) {
    const key = selection.tab === 'root' ? word.r : selection.tab === 'form' ? word.form : `${verse.n}:${i + 1}`
    if (!key || seen.has(key)) continue
    seen.add(key)
    units.push({ key, location: [verse.n, i + 1] })
  }
  if (!units.length) return null
  const key = selection.tab === 'root' ? selection.root : selection.tab === 'form' ? selection.form : `${selection.a}:${selection.pos}`
  const current = units.findIndex(unit => unit.key === key)
  const next = current < 0 ? (direction > 0 ? 0 : units.length - 1) : (current + direction + units.length) % units.length
  return units[next].location
}
