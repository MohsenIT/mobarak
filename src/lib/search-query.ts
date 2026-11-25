import { normalizeQuranSearch, quranSearchKeys, type QuranSearchResult, type SearchVerse } from './quran-search'

export type SearchRelation = 'all' | 'any' | 'phrase'
export type SearchSort = 'mushaf' | 'relevance'
export type SearchCooccurrence = 'verse' | 'context' | 'surah'
export type Phase3SearchOptions = {
  relation: SearchRelation
  sorts: SearchSort[]
  reverseSort?: boolean
  roots: string[]
  lemmas: string[]
  forms: string[]
  cooccurrence?: SearchCooccurrence
  spellingSensitive?: boolean
}

export function defaultPhase3SearchOptions(): Phase3SearchOptions {
  return { relation: 'all', sorts: ['mushaf'], roots: [], lemmas: [], forms: [] }
}

type SearchClause = { text: string; exact: boolean }

export function parseSearchQuery(input: string, relation: SearchRelation, spellingSensitive = false): SearchClause[] {
  if (relation === 'phrase') {
    const text = normalizeQuranSearch(input, false, spellingSensitive)
    return text ? [{ text, exact: true }] : []
  }
  const clauses = new Map<string, SearchClause>()
  for (const [plain, straight, curly, angled] of input.matchAll(/"([^"]*)(?:"|$)|“([^”]*)(?:”|$)|«([^»]*)(?:»|$)|[^"“«]+/g)) {
    const quoted = straight ?? curly ?? angled
    const exact = quoted !== undefined
    const normalized = normalizeQuranSearch(quoted ?? plain, false, spellingSensitive)
    for (const text of exact ? [normalized] : normalized.split(' ')) {
      if (text) clauses.set(`${exact}:${text}`, { text, exact })
    }
  }
  return [...clauses.values()]
}

export function createExactSearch(verses: SearchVerse[], wawByVerse: Record<string, number[]> = {}, spellingSensitive = false) {
  const keysByWord = new Map<string, string[]>()
  const keysFor = (word: string) => {
    let keys = keysByWord.get(word)
    if (!keys) {
      keys = quranSearchKeys(word, spellingSensitive)
      keysByWord.set(word, keys)
    }
    return keys
  }

  return (text: string, within: (surah: number) => boolean): QuranSearchResult[] => {
    const terms = text.split(' ')
    const results: QuranSearchResult[] = []
    for (const [s, a, words] of verses) {
      if (!within(s)) continue
      const waw = wawByVerse[`${s}:${a}`] ?? []
      const occurrences: number[][] = []
      const parts: Record<number, number> = {}
      const facetPositions = terms.map(() => new Set<number>())
      const match = (start: number, afterWaw: boolean) => {
        const hit: number[] = []
        const stems: [number, number][] = []
        for (let i = start, term = 0; i < words.length; i++) {
          const keys = keysFor(words[i])
          const prefixed = waw.includes(i + 1) && keys.some(key => key.startsWith('و') && key.length > 1)
          if (afterWaw && i === start) {
            if (!keys.includes(`و${terms[term]}`)) return
            hit.push(2)
          } else if (keys.includes(terms[term])) {
            hit.push(prefixed ? 3 : 2)
          } else if (prefixed && terms[term] === 'و') {
            if (term === terms.length - 1) hit.push(1)
            else if (keys.includes(`و${terms[++term]}`)) hit.push(3)
            else return
          } else return
          if (hit.at(-1)! & 2) stems.push([term, i + 1])
          if (++term === terms.length) {
            for (const [index, position] of stems) facetPositions[index].add(position)
            occurrences.push(hit.map((mask, offset) => {
              const pos = start + offset + 1
              parts[pos] = (parts[pos] ?? 0) | mask
              return pos
            }))
            return
          }
        }
      }
      for (let i = 0; i < words.length; i++) {
        match(i, false)
        if (waw.includes(i + 1)) match(i, true)
      }
      if (occurrences.length) results.push({ s, a, words, waw, parts, positions: Object.keys(parts).map(Number), facetPositions: facetPositions.map(positions => [...positions]), occurrences, kind: 'exact', score: 0 })
    }
    return results
  }
}

export function bm25(frequency: number, documentFrequency: number, length: number, averageLength: number, documents: number) {
  const idf = Math.log1p((documents - documentFrequency + 0.5) / (documentFrequency + 0.5))
  return idf * (frequency * 2.2) / (frequency + 1.2 * (0.25 + 0.75 * length / averageLength))
}

/** Smallest token window covering the matched clauses. */
export function searchProximity(groups: number[][]) {
  if (groups.length < 2) return 0
  const hits = groups.flatMap((positions, group) => positions.map(pos => ({ pos, group }))).sort((a, b) => a.pos - b.pos)
  const counts = Array<number>(groups.length).fill(0)
  let left = 0
  let covered = 0
  let tightest = Infinity
  for (const hit of hits) {
    if (counts[hit.group]++ === 0) covered++
    while (covered === groups.length) {
      const first = hits[left++]
      tightest = Math.min(tightest, hit.pos - first.pos + 1)
      if (--counts[first.group] === 0) covered--
    }
  }
  return 1 / tightest
}

/** Earliest forward chain from each first-term match, measured in token positions. */
export function searchOrder(groups: number[][]) {
  if (groups.length < 2) return 0
  let best = Infinity
  for (const start of groups[0]) {
    let end = start
    for (const positions of groups.slice(1)) {
      end = positions.find(position => position > end) ?? Infinity
      if (!Number.isFinite(end)) break
    }
    best = Math.min(best, end - start + 1)
  }
  return 1 / best
}
