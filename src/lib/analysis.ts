import { splitWord, wordKey, type WordPart } from './word-parts'
import type { SurahData, Word } from './quran'
import { nextContext } from './contexts'

export type AnalysisTab = 'root' | 'form' | 'word' | 'verse' | 'context'
export interface AnalysisSelection {
  part?: WordPart
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
    case 'form': return !!selection.form && !!selection.root && word.form === selection.form && word.r === selection.root
    case 'word': return selection.a === a && selection.pos === pos
    case 'verse': return selection.a === a
    case 'context': return selection.from !== undefined && selection.to !== undefined && a >= selection.from && a <= selection.to
  }
}

export function analysisOccurrences(surah: SurahData, selection: AnalysisSelection): [number, number][] {
  const occurrences: [number, number][] = []
  for (const verse of surah.v) for (const [i, word] of verse.w.entries()) {
    // Word statistics match lexical parts after removing corpus-tagged waw;
    // the actual selection remains a single word at a single location.
    const match = selection.tab === 'word' ? (selection.part === 'prefix' ? !!splitWord(word).prefix : wordKey(splitWord(word).stem) === wordKey(selection.text)) : matchesAnalysis(selection, surah.n, verse.n, i + 1, word)
    if (match) occurrences.push([verse.n, i + 1])
  }
  return occurrences
}

/** Each tab navigates its own unit, preserving the other tabs' targets. */
export function nextAnalysisLocation(surah: SurahData, selection: AnalysisSelection, direction: number): [number, number, WordPart?] | null {
  if (selection.tab === 'context') {
    const next = nextContext(selection.s, selection.a, direction)
    return next ? [next.from, 1] : null
  }
  if (selection.tab === 'word') {
    const locations: [number, number, WordPart?][] = []
    for (const verse of surah.v) for (const [i, word] of verse.w.entries()) {
      if (splitWord(word).prefix) locations.push([verse.n, i + 1, 'prefix'])
      locations.push(splitWord(word).prefix ? [verse.n, i + 1, 'stem'] : [verse.n, i + 1])
    }
    const current = locations.findIndex(([a, pos, part]) => a === selection.a && pos === selection.pos && (part ?? 'stem') === (selection.part ?? 'stem'))
    return locations[(current + direction + locations.length) % locations.length] ?? null
  }
  if (selection.tab === 'verse') return [Math.max(1, Math.min(surah.vc, selection.a + direction)), 1]
  const units: { key: string; location: [number, number] }[] = []
  const seen = new Set<string>()
  for (const verse of surah.v) for (const [i, word] of verse.w.entries()) {
    if (selection.tab === 'form' && word.r !== selection.root) continue
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
