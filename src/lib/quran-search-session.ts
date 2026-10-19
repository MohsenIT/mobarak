import { createQuranSearch, normalizeQuranSearch, type SearchVerse, type QuranSearchResult, type QuranSearchOptions } from './quran-search'
import type { AnalysisSelection } from './analysis'
import { wordKey } from './word-parts'

export type SearchCorpus = { verses: SearchVerse[]; waw?: Record<string, number[]>; morphology: Record<string, [string | null, string | null, string | null][]> }
export type SearchSessionOptions = QuranSearchOptions & { surahs?: number[]; includeRoots?: boolean }
export function createSearchSession(corpus: SearchCorpus) {
  const search = createQuranSearch(corpus.verses, corpus.waw)
  const verseMap = new Map(corpus.verses.map(([s, a, words]) => [`${s}:${a}`, words]))
  const wordText = (s: number, a: number, pos: number) => {
    const text = verseMap.get(`${s}:${a}`)?.[pos - 1] ?? ''
    const key = wordKey(text)
    return corpus.waw?.[`${s}:${a}`]?.includes(pos) ? key.replace(/^و/, '') : key
  }

  return (query: string, options: SearchSessionOptions = {}, filter?: AnalysisSelection | null): QuranSearchResult[] => {
    const scope = new Set(options.surahs ?? [])
    const within = (s: number) => !scope.size || scope.has(s)
    if (filter) {
      const source = corpus.morphology[`${filter.s}:${filter.a}`]?.[filter.pos - 1]
      const lemma = source?.[1]
      const root = filter.root ?? source?.[0]
      const type = options.includeRoots && root ? 'root' : filter.tab === 'root' ? 'word' : filter.tab
      return corpus.verses.flatMap(([s, a, words]) => {
        if (!within(s)) return []
        const positions: number[] = []
        const metadata = corpus.morphology[`${s}:${a}`] ?? []
        words.forEach((_, i) => {
          const [r, l, form] = metadata[i] ?? []
          const match = type === 'root' ? !!root && r === root : type === 'form' ? !!root && r === root && form === filter.form : filter.part === 'prefix' ? corpus.waw?.[`${s}:${a}`]?.includes(i + 1) : lemma ? l === lemma : wordText(s, a, i + 1) === wordText(filter.s, filter.a, filter.pos)
          if (match) positions.push(i + 1)
        })
        return positions.length ? [{ s, a, words, waw: corpus.waw?.[`${s}:${a}`] ?? [], positions, parts: Object.fromEntries(positions.map(pos => [pos, filter.part === 'prefix' ? 1 : 2])), kind: 'exact' as const, score: 0 }] : []
      })
    }
    const literal = search(query, 0, options)
    if (!options.includeRoots || normalizeQuranSearch(query).includes(' ')) return literal.filter(r => within(r.s))
    const roots = new Set<string>()
    // Prefer literal matches; only use typo matches as seeds if no literal exists.
    const exact = literal.filter(r => r.kind !== 'near')
    for (const result of exact.length ? exact : literal.filter(r => r.score === literal[0]?.score)) {
      for (const pos of result.positions) {
        const root = corpus.morphology[`${result.s}:${result.a}`]?.[pos - 1]?.[0]
        if (root && result.parts[pos] & 2) roots.add(root)
      }
    }
    const merged = new Map(literal.filter(r => within(r.s)).map(r => [`${r.s}:${r.a}`, r]))
    for (const [s, a, words] of corpus.verses) {
      if (!within(s)) continue
      const positions = (corpus.morphology[`${s}:${a}`] ?? []).flatMap(([r], i) => r && roots.has(r) ? [i + 1] : [])
      if (!positions.length) continue
      const key = `${s}:${a}`
      const previous = merged.get(key)
      merged.set(key, { s, a, words, waw: corpus.waw?.[key] ?? [], kind: previous?.kind ?? 'root', score: previous?.score ?? 2,
        positions: [...new Set([...(previous?.positions ?? []), ...positions])].sort((a, b) => a - b),
        parts: { ...previous?.parts, ...Object.fromEntries(positions.map(pos => [pos, (previous?.parts[pos] ?? 0) | 2])) } })
    }
    return [...merged.values()].sort((a, b) => a.score - b.score || a.s - b.s || a.a - b.a)
  }
}
