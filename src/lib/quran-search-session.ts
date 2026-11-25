import { createQuranSearch, normalizeQuranSearch, type SearchVerse, type QuranSearchResult, type QuranSearchOptions, type SearchCooccurrenceGroup } from './quran-search'
import type { AnalysisSelection } from './analysis'
import { getSourceSurahContexts } from './contexts'
import { wordKey } from './word-parts'
import { lemmaDisplay } from './lemma-display'
import { bm25, createExactSearch, parseSearchQuery, unrecordedSearchForm, searchOrder, searchProximity, type Phase3SearchOptions } from './search-query'

export type { Phase3SearchOptions, SearchCooccurrence, SearchRelation, SearchSort } from './search-query'

export type SearchCorpus = { verses: SearchVerse[]; waw?: Record<string, number[]>; morphology: Record<string, [string | null, string | null, string | null][]> }
export type SearchMode = 'text' | 'root' | 'lemma'
export type SearchSessionOptions = QuranSearchOptions & { mode?: SearchMode; surahs?: number[]; includeRoots?: boolean; phase3?: Phase3SearchOptions }

const spansFor = (result: QuranSearchResult) => result.occurrences ?? result.positions.map(pos => [pos])

function mergeSpellingHits(matches: QuranSearchResult[]) {
  const verses = new Map<string, QuranSearchResult>()
  for (const result of matches) {
    const id = `${result.s}:${result.a}`
    const previous = verses.get(id)
    if (!previous) { verses.set(id, result); continue }
    const parts = { ...previous.parts }
    for (const pos of result.positions) parts[pos] = (parts[pos] ?? 0) | result.parts[pos]
    const occurrences = [...spansFor(previous)]
    const recorded = new Set(occurrences.map(span => span.join(',')))
    occurrences.push(...spansFor(result).filter(span => !recorded.has(span.join(','))))
    verses.set(id, { ...(result.score < previous.score ? result : previous), positions: Object.keys(parts).map(Number), parts, occurrences,
      facetPositions: previous.facetPositions?.map((row, index) => [...new Set([...row, ...(result.facetPositions?.[index] ?? [])])]) })
  }
  return [...verses.values()]
}

export function createSearchSession(corpus: SearchCorpus) {
  const search = createQuranSearch(corpus.verses, corpus.waw)
  const exactSearch = createExactSearch(corpus.verses, corpus.waw)
  let sensitiveSearch: ReturnType<typeof createQuranSearch> | undefined
  const sensitiveExactSearch = createExactSearch(corpus.verses, corpus.waw, true)
  const verseMap = new Map(corpus.verses.map(([s, a, words]) => [`${s}:${a}`, words]))
  const surahRanges = new Map<number, { from: number; to: number }>()
  for (const [s, a] of corpus.verses) {
    const range = surahRanges.get(s)
    if (!range) surahRanges.set(s, { from: a, to: a })
    else { range.from = Math.min(range.from, a); range.to = Math.max(range.to, a) }
  }
  const wordText = (s: number, a: number, pos: number) => {
    const text = verseMap.get(`${s}:${a}`)?.[pos - 1] ?? ''
    const key = wordKey(text)
    return corpus.waw?.[`${s}:${a}`]?.includes(pos) ? key.replace(/^و/, '') : key
  }

  const searchMorphology = (terms: string[], mode: 'root' | 'lemma', within: (s: number) => boolean): QuranSearchResult[] => {
    const column = mode === 'root' ? 0 : 1
    const keys = terms.map(term => normalizeQuranSearch(term).replace(/\s/g, ''))
    if (!keys.length || keys.some(key => !key)) return []
    const normalized = new Map<string, string>()
    return corpus.verses.flatMap(([s, a, words]) => {
      if (!within(s)) return []
      const id = `${s}:${a}`
      const stems = corpus.morphology[id] ?? []
      const occurrences = stems.flatMap((_, index) => {
        const match = keys.every((key, offset) => {
          const value = stems[index + offset]?.[column]
          if (!value) return false
          if (!normalized.has(value)) normalized.set(value, normalizeQuranSearch(mode === 'lemma' ? lemmaDisplay(value) : value).replace(/\s/g, ''))
          return normalized.get(value) === key
        })
        return match ? [keys.map((_, offset) => index + offset + 1)] : []
      })
      if (!occurrences.length) return []
      const positions = [...new Set(occurrences.flat())]
      return [{ s, a, words, waw: corpus.waw?.[id] ?? [], positions, occurrences, parts: Object.fromEntries(positions.map(pos => [pos, 2])), kind: 'exact', score: 0 }]
    })
  }

  const execute = (query: string, options: SearchSessionOptions = {}, filter?: AnalysisSelection | null): QuranSearchResult[] => {
    const scope = new Set(options.surahs ?? [])
    const within = (s: number) => !scope.size || scope.has(s)
    if (!filter && options.mode && options.mode !== 'text') {
      return searchMorphology([query], options.mode, within)
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
    const sensitive = options.phase3?.spellingSensitive
    const matcher = sensitive ? sensitiveSearch ??= createQuranSearch(corpus.verses, corpus.waw, true) : search
    const literal = matcher(query, !options.includeRoots && scope.size === 1 ? scope.values().next().value : 0, options)
    if (!options.includeRoots || normalizeQuranSearch(query, false, sensitive).includes(' ')) return literal.filter(r => within(r.s))
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
    const parsed = filter ? [{ text: query, exact: false }] : parseSearchQuery(query, phase.relation, isText && phase.spellingSensitive)
    const spellingKey = (text: string) => isText && !phase.spellingSensitive && text === 'صلات' ? 'صلاه' : text
    const clauses = [...new Map(parsed.map(clause => [`${clause.exact}:${spellingKey(clause.text)}`, clause])).values()]
    const facetOffsets: number[] = []
    let facetCount = 0
    for (const clause of clauses) {
      facetOffsets.push(facetCount)
      facetCount += filter ? 1 : clause.text.split(' ').length
    }
    const hits = new Map<string, { result: QuranSearchResult; clause: number }[]>()
    const frequencies = clauses.map(({ text, exact }, clause) => {
      const mode = options.mode
      const exactMatcher = phase.spellingSensitive ? sensitiveExactSearch : exactSearch
      const matchesExact = exact || isText && clauses.length > 1 && text.length === 1
      const usePrayerAlias = isText && !phase.spellingSensitive && spellingKey(text) === 'صلاه'
      const primary = usePrayerAlias ? 'صلاه' : text
      let matches = exact && (mode === 'root' || mode === 'lemma')
        ? searchMorphology(text.split(' '), mode, within)
        : matchesExact ? exactMatcher(primary, within) : execute(primary, options, filter)
      if (isText && !phase.spellingSensitive) {
        // The example spellings have explicit alternatives. General Arabic letters retain their existing mappings.
        // An alternate spelling must not seed a root from a substring of an unrelated word.
        if (usePrayerAlias) matches = mergeSpellingHits([...matches, ...(matchesExact
          ? exactSearch('صلات', within)
          : execute('صلات', { ...options, includePartial: false, includeNear: false }))])
        if (text === 'رويا') {
          const canonical = ['رءيا', 'رءيى'].flatMap(value => matchesExact
            ? sensitiveExactSearch(value, within)
            : execute(value, { ...options, phase3: { ...phase, spellingSensitive: true } }))
          matches = mergeSpellingHits([...matches, ...canonical])
        }
      }
      for (const result of matches) {
        const id = `${result.s}:${result.a}`
        const existing = hits.get(id)
        if (existing) existing.push({ result, clause })
        else hits.set(id, [{ result, clause }])
      }
      return matches.length
    })
    const broader = phase.relation === 'all' && clauses.length > 1 ? phase.cooccurrence : undefined
    const memberships = new Map<string, { descriptor: SearchCooccurrenceGroup; clauses: Set<number> }>()
    const groupsByRange = new Map<string, { descriptor: SearchCooccurrenceGroup; clauses: Set<number> }>()
    if (broader === 'context' || broader === 'surah') for (const [id, matches] of hits) {
      const { s, a } = matches[0].result
      const contexts = broader === 'context' ? getSourceSurahContexts(s)?.ranges.filter(range => a >= range.from && a <= range.to) : undefined
      const range = broader === 'surah' ? surahRanges.get(s) : contexts?.length === 1 ? contexts[0] : undefined
      if (!range) continue
      const key = `${s}:${range.from}:${range.to}`
      let group = groupsByRange.get(key)
      if (!group) {
        group = { descriptor: { unit: broader, from: range.from, to: range.to }, clauses: new Set() }
        groupsByRange.set(key, group)
      }
      for (const match of matches) group.clauses.add(match.clause)
      memberships.set(id, group)
    }
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
      const group = memberships.get(id)
      if (phase.relation !== 'any' && (group?.clauses.size ?? matches.length) !== clauses.length) continue
      let strongest = matches[0].result
      const parts: Record<number, number> = {}
      const occurrences = new Map<string, number[]>()
      const facets = Array.from({ length: facetCount }, () => new Set<number>())
      const weights = new Map<string, number>()
      for (const { result, clause } of matches) {
        if (result.score < strongest.score) strongest = result
        const metadata = corpus.morphology[id]
        const positions = hasFacets ? result.positions.filter(pos => (result.parts[pos] & 2) && groups.every((values, column) => {
          const stem = metadata?.[pos - 1]
          const value = stem?.[column] ?? (column === 2 && stem && unrecordedSearchForm)
          return !values.length || !!value && values.includes(value)
        })) : result.positions
        const retained = new Set(positions)
        const clauseFacets = result.facetPositions ?? (clauses[clause].exact && !isText
          ? clauses[clause].text.split(' ').map((_, offset) => spansFor(result).map(span => span[offset]))
          : [positions.filter(pos => result.parts[pos] & 2)])
        clauseFacets.forEach((positions, index) => {
          for (const pos of positions) if (retained.has(pos)) facets[facetOffsets[clause] + index].add(pos)
        })
        for (const pos of positions) parts[pos] = (parts[pos] ?? 0) | result.parts[pos]
        const spans = spansFor(result).filter(span => !hasFacets || span.some(pos => retained.has(pos)))
        const repetitions = new Map<string, number>()
        for (const span of spans) {
          const location = span.join(',')
          const repeat = (repetitions.get(location) ?? 0) + 1
          repetitions.set(location, repeat)
          const normalizedClause = spellingKey(clauses[clause].text).replace(/ /g, '')
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
        result: { ...strongest, positions: Object.keys(parts).map(Number), facetPositions: facets.map(positions => [...positions]), parts, occurrences: [...occurrences.values()].sort((a, b) => a[0] - b[0]), ...(group ? { cooccurrenceGroup: group.descriptor } : {}) },
        relevance,
      })
    }
    const mushafOrder = (a: QuranSearchResult, b: QuranSearchResult) => a.s - b.s || a.a - b.a
    return results.sort((a, b) => {
      for (const [index, sort] of (phase.sorts.length ? phase.sorts : ['mushaf']).entries()) {
        const difference = sort === 'relevance' ? b.relevance - a.relevance : mushafOrder(a.result, b.result)
        if (difference) return index === 0 && sort === 'mushaf' && phase.reverseSort ? -difference : difference
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
