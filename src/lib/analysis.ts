import { lexicalKey, splitWord, wordKey, type WordPart } from './word-parts'
import type { SurahData, Word } from './quran'
import { nextContext, getContext, getSurahContexts } from './contexts'

export type AnalysisTab = 'root' | 'form' | 'word' | 'verse' | 'context' | 'surah'
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
    case 'surah': return true
    case 'verse': return selection.a === a
    case 'context': return selection.from !== undefined && selection.to !== undefined && a >= selection.from && a <= selection.to
  }
}

export function analysisOccurrences(surah: SurahData, selection: AnalysisSelection): [number, number][] {
  const occurrences: [number, number][] = []
  const selectedWord = surah.v.find(verse => verse.n === selection.a)?.w[selection.pos - 1]
  const selectedKey = selectedWord ? lexicalKey(selectedWord, selection.part) : wordKey(selection.text)
  for (const verse of surah.v) for (const [i, word] of verse.w.entries()) {
    // Word statistics group attested lemmas, excluding corpus-tagged waw;
    // the actual selection remains a single word at a single location.
    const match = selection.tab === 'word' ? (selection.part === 'prefix' ? !!splitWord(word).prefix : lexicalKey(word) === selectedKey) : matchesAnalysis(selection, surah.n, verse.n, i + 1, word)
    if (match) occurrences.push([verse.n, i + 1])
  }
  return occurrences
}

/** Each tab navigates its own unit, preserving the other tabs' targets. */
export function nextAnalysisLocation(surah: SurahData, selection: AnalysisSelection, direction: number): [number, number, WordPart?] | null {
  if (selection.tab === 'surah') return null
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

export type AnalysisLocation = [number, number, WordPart?]

/** Separate changing a tab's unit from visiting repetitions of that same unit. */
export function analysisNavigation(surah: SurahData, selection: AnalysisSelection) {
  const units: AnalysisLocation[] = []
  const seen = new Set<string>()
  if (selection.tab === 'surah') {
    units.push([selection.a, selection.pos])
  } else if (selection.tab === 'verse') {
    for (const verse of surah.v) units.push([verse.n, 1])
  } else if (selection.tab === 'context') {
    for (const range of getSurahContexts(surah.n)?.ranges ?? []) units.push([range.from, 1])
  } else {
    for (const verse of surah.v) for (const [i, word] of verse.w.entries()) {
      if (selection.tab === 'word') {
        if (splitWord(word).prefix) units.push([verse.n, i + 1, 'prefix'])
        units.push([verse.n, i + 1, splitWord(word).prefix ? 'stem' : undefined])
        continue
      }
      if (selection.tab === 'form' && word.r !== selection.root) continue
      const key = selection.tab === 'root' ? word.r : word.form
      if (!key || seen.has(key)) continue
      seen.add(key)
      units.push([verse.n, i + 1])
    }
  }
  const unitIndex = units.findIndex(([a, pos, part]) => {
    const word = surah.v[a - 1]?.w[pos - 1]
    if (selection.tab === 'root') return word?.r === selection.root
    if (selection.tab === 'form') return word?.form === selection.form
    if (selection.tab === 'context') return getContext(surah.n, selection.a)?.from === a
    if (selection.tab === 'verse') return a === selection.a
    return a === selection.a && pos === selection.pos && (part ?? 'stem') === (selection.part ?? 'stem')
  })
  const hasRepetitions = selection.tab === 'root' || selection.tab === 'form' || selection.tab === 'word'
  const repetitions: AnalysisLocation[] = hasRepetitions ? analysisOccurrences(surah, selection).map(([a, pos]) => [a, pos,
    selection.tab === 'word' ? selection.part === 'prefix' ? 'prefix' : splitWord(surah.v[a - 1].w[pos - 1]).prefix ? 'stem' : undefined : undefined,
  ]) : units
  const repetitionIndex = hasRepetitions ? repetitions.findIndex(([a, pos]) => a === selection.a && pos === selection.pos) : unitIndex
  return { units, unitIndex, repetitions, repetitionIndex, hasRepetitions }
}

/** Neighboring different roots around the current occurrence in reading order. */
export function adjacentRootLocations(surah: SurahData, selection: Pick<AnalysisSelection, 'a' | 'pos' | 'root'>) {
  const words = surah.v.flatMap(verse => verse.w.map((word, i) => ({ a: verse.n, pos: i + 1, root: word.r })))
  const current = words.findIndex(word => word.a === selection.a && word.pos === selection.pos)
  const find = (direction: number): AnalysisLocation | undefined => {
    if (current < 0) return undefined
    for (let i = current + direction; i >= 0 && i < words.length; i += direction) {
      const word = words[i]
      if (word.root && word.root !== selection.root) return [word.a, word.pos]
    }
  }
  return { previous: find(-1), next: find(1) }
}
