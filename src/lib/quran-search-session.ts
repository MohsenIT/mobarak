import { createQuranSearch, normalizeQuranSearch, type SearchVerse, type QuranSearchResult, type QuranSearchOptions } from './quran-search'
import type { AnalysisSelection } from './analysis'
import { wordKey } from './word-parts'
import { lemmaDisplay } from './lemma-display'
import { bm25, createExactSearch, parseSearchQuery, searchOrder, searchProximity, type Phase3SearchOptions } from './search-query'

export type { Phase3SearchOptions, SearchRelation, SearchSort } from './search-query'

export type SearchCorpus = { verses: SearchVerse[]; waw?: Record<string, number[]>; morphology: Record<string, [string | null, string | null, string | null][]> }
export type SearchMode = 'text' | 'root' | 'lemma'
export type SearchSessionOptions = QuranSearchOptions & { mode?: SearchMode; surahs?: number[]; includeRoots?: boolean; phase3?: Phase3SearchOptions }

const spansFor = (result: QuranSearchResult) => result.occurrences ?? result.positions.map(pos => [pos])

export function createSearchSession(corpus: SearchCorpus) {
  const search = createQuranSearch(corpus.verses, corpus.waw)
  const exactSearch = createExactSearch(corpus.verses, corpus.waw)
  const verseMap = new Map(corpus.verses.map(([s, a, words]) => [`${s}:${a}`, words]))
  const wordText = (s: number, a: number, pos: number) => {
    const text = verseMap.get(`${s}:${a}`)?.[pos - 1] ?? ''
    const key = wordKey(text)
    return corpus.waw?.[`${s}:${a}`]?.includes(pos) ? key.replace(/^و/, '') : key
  }

  const execute = (query: string, options: SearchSessionOptions = {}, filter?: AnalysisSelection | null): QuranSearchResult[] => {
    const scope = new Set(options.surahs ?? [])
    const within = (s: number) => !scope.size || scope.has(s)
    if (!filter && options.mode && options.mode !== 'text') {
      const column = options.mode === 'root' ? 0 : 1
      const key = normalizeQuranSearch(query).replace(/\s/g, '')
      if (!key) return []
      return corpus.verses.flatMap(([s, a, words]) => {
        if (!within(s)) return []
        const positions = (corpus.morphology[`${s}:${a}`] ?? []).flatMap((m, i) => m[column] && normalizeQuranSearch(column === 1 ? lemmaDisplay(m[column]!) : m[column]!).replace(/\s/g, '') === key ? [i + 1] : [])
        return positions.length ? [{ s, a, words, waw: corpus.waw?.[`${s}:${a}`] ?? [], positions, parts: Object.fromEntries(positions.map(pos => [pos, 2])), kind: 'exact' as const, score: 0 }] : []
      })
    }
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
    const literal = search(query, !options.includeRoots && scope.size === 1 ? scope.values().next().value : 0, options)
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
        occurrences: [...(previous?.occurrences ?? []), ...positions.filter(pos => !((previous?.parts[pos] ?? 0) & 2)).map(pos => [pos])].sort((a, b) => a[0] - b[0]),
        parts: { ...previous?.parts, ...Object.fromEntries(positions.map(pos => [pos, (previous?.parts[pos] ?? 0) | 2])) } })
    }
    return [...merged.values()].sort((a, b) => a.score - b.score || a.s - b.s || a.a - b.a)
  }

  const executePhase3 = (query: string, options: SearchSessionOptions, phase: Phase3SearchOptions, filter?: AnalysisSelection | null) => {
    const scope = new Set(options.surahs ?? [])
    const within = (s: number) => !scope.size || scope.has(s)
    const isText = !filter && (!options.mode || options.mode === 'text')
    const clauses = isText ? parseSearchQuery(query, phase.relation) : [{ text: query, exact: false }]
    const hits = new Map<string, { result: QuranSearchResult; clause: number }[]>()
    const frequencies = clauses.map(({ text, exact }, clause) => {
      const matches = exact || isText && clauses.length > 1 && text.length === 1 ? exactSearch(text, within) : execute(text, options, filter)
      for (const result of matches) {
        const id = `${result.s}:${result.a}`
        const existing = hits.get(id)
        if (existing) existing.push({ result, clause })
        else hits.set(id, [{ result, clause }])
      }
      return matches.length
    })
    const groups = [phase.roots, phase.lemmas, phase.forms]
    const hasFacets = groups.some(group => group.length)
    let documents = 0
    let corpusLength = 0
    const useRelevance = phase.sorts[0] === 'relevance'
    if (useRelevance) for (const [s, , words] of corpus.verses) {
      if (!within(s)) continue
      documents++
      corpusLength += words.length
    }
    const results: { result: QuranSearchResult; relevance: number }[] = []
    for (const [id, matches] of hits) {
      if (phase.relation !== 'any' && matches.length !== clauses.length) continue
      let strongest = matches[0].result
      const parts: Record<number, number> = {}
      const occurrences = new Map<string, number[]>()
      const weights = new Map<string, number>()
      for (const { result, clause } of matches) {
        if (result.score < strongest.score) strongest = result
        const metadata = corpus.morphology[id]
        const positions = hasFacets ? result.positions.filter(pos => (result.parts[pos] & 2) && groups.every((values, column) => {
          const value = metadata?.[pos - 1]?.[column]
          return !values.length || !!value && values.includes(value)
        })) : result.positions
        const retained = new Set(positions)
        for (const pos of positions) parts[pos] = (parts[pos] ?? 0) | result.parts[pos]
        const spans = spansFor(result).filter(span => !hasFacets || span.some(pos => retained.has(pos)))
        const repetitions = new Map<string, number>()
        for (const span of spans) {
          const location = span.join(',')
          const repeat = (repetitions.get(location) ?? 0) + 1
          repetitions.set(location, repeat)
          const normalizedClause = clauses[clause].text.replace(/ /g, '')
          occurrences.set(`${normalizedClause}:${location}:${repeat}`, span)
        }
        if (useRelevance) {
          const strength = 1 / (1 + 0.25 * result.score)
          const term = clauses[clause].text
          const weight = strength * bm25(spansFor(result).length, frequencies[clause], result.words.length, corpusLength / documents, documents)
          weights.set(term, Math.max(weights.get(term) ?? 0, weight))
        }
      }
      if (!occurrences.size) continue
      let relevance = 0
      if (useRelevance) {
        const positions = matches.map(({ result }) => result.positions)
        for (const weight of weights.values()) relevance += weight
        relevance *= 1 + searchProximity(positions) + 0.25 * searchOrder(positions)
      }
      results.push({
        result: { ...strongest, positions: Object.keys(parts).map(Number), parts, occurrences: [...occurrences.values()].sort((a, b) => a[0] - b[0]) },
        relevance,
      })
    }
    const mushafOrder = (a: QuranSearchResult, b: QuranSearchResult) => a.s - b.s || a.a - b.a
    return results.sort((a, b) => {
      for (const sort of phase.sorts) {
        const difference = sort === 'relevance' ? b.relevance - a.relevance : mushafOrder(a.result, b.result)
        if (difference) return difference
      }
      return mushafOrder(a.result, b.result)
    }).map(({ result }) => result)
  }

  return (query: string, options: SearchSessionOptions = {}, filter?: AnalysisSelection | null) => (options.phase3
    ? executePhase3(query, options, options.phase3, filter)
    : execute(query, options, filter)).map(result => ({
    ...result,
    occurrences: spansFor(result),
    morphology: corpus.morphology[`${result.s}:${result.a}`] ?? [],
  }))

}
