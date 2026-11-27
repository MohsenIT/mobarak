import { splitWord } from './word-parts'

/** Search keys only: the displayed Quran words always remain unchanged. */
export function normalizeQuranSearch(text: string, restoreSmallLetters = false, spellingSensitive = false): string {
  let value = text.normalize('NFKC')
  if (spellingSensitive) value = value.replace(/ٱ/g, 'ا').replace(/ی/g, 'ي').replace(/ک/g, 'ك').replace(/[\u0654\u0655]/g, 'ء')
  else {
    if (restoreSmallLetters) value = value.replace(/و\u0670/g, 'ا').replace(/ى\u0670/g, 'ى').replace(/\u0670/g, 'ا').replace(/\u06e7/g, 'ي')
    value = value.replace(/[أإآٱ]/g, 'ا').replace(/[یىئ]/g, 'ي').replace(/ک/g, 'ك').replace(/ؤ/g, 'و').replace(/ة/g, 'ه').replace(/ء/g, '')
  }
  return value
    .replace(/[\p{M}\u0610-\u061a\u06d6-\u06edـ\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function quranSearchKeys(text: string, spellingSensitive: boolean): string[] {
  const key = normalizeQuranSearch(text, false, spellingSensitive)
  if (spellingSensitive) return key ? [key] : []
  return [...new Set([key, normalizeQuranSearch(text, true)])].filter(Boolean)
}

/** Bounded Damerau distance also tolerates swapping two adjacent letters. */
export function typoDistance(a: string, b: string, max: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  let older = previous
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let minimum = i
    for (let j = 1; j <= b.length; j++) {
      let value = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, older[j - 2] + 1)
      row[j] = value; minimum = Math.min(minimum, value)
    }
    if (minimum > max) return max + 1
    older = previous; previous = row
  }
  return previous[b.length]
}

export type QuranSearchOptions = { includePartial?: boolean; includeNear?: boolean }
export type SearchVerse = [s: number, a: number, words: string[]]
export type SearchCooccurrenceGroup = { unit: 'context' | 'surah'; from: number; to: number }
export type QuranSearchResult = { s: number; a: number; words: string[]; waw: number[]; parts: Record<number, number>; positions: number[]; facetPositions?: number[][]; occurrences?: number[][]; kind: 'exact' | 'partial' | 'near' | 'root'; score: number; morphology?: [string | null, string | null, string | null][]; cooccurrenceGroup?: SearchCooccurrenceGroup }
export type QuranSearchHighlight = Pick<QuranSearchResult, 's' | 'a' | 'positions' | 'parts'>
export type QuranSearchCounts = { occurrences: number; words: number; verses: number }

export function countQuranSearchResults(results: QuranSearchResult[]): QuranSearchCounts {
  let occurrences = 0
  let words = 0
  for (const result of results) {
    occurrences += result.occurrences?.length ?? result.positions.length
    words += result.positions.length
    // A marked conjunction and stem share a canonical position but are two words.
    for (const pos of result.positions) if (result.parts[pos] === 3) words++
  }
  return { occurrences, words, verses: results.length }
}

type SearchToken = { text: string; keys: string[]; pos: number; part: 1 | 2 }
type TokenRange = { token: SearchToken; from: number; to: number }
type IndexedVerse = {
  verse: SearchVerse; tokens: SearchToken[]
  compact: { text: string; ranges: TokenRange[] }[]
}

export function createQuranSearch(verses: SearchVerse[], waw: Record<string, number[]> = {}, spellingSensitive = false) {
  const vocabulary = new Set<string>()
  const sourceOffsets = new Map<string, number[][]>()
  const originalOffset = (word: string, variant: number, offset: number) => {
    let variants = sourceOffsets.get(word)
    if (!variants) {
      // Restoring a small letter can shift a hit while its source span stays the same.
      variants = [false, true].map(restore => {
        const offsets: number[] = []
        for (let end = 1; end <= word.length; end++) {
          const length = normalizeQuranSearch(word.slice(0, end), restore).length
          while (offsets.length < length) offsets.push(end - 1)
          offsets.length = length
        }
        return offsets
      })
      sourceOffsets.set(word, variants)
    }
    return variants[variant][offset] ?? offset
  }
  const normalizedWords = new Map<string, string[]>()
  const tokenKeys = (word: string) => {
    let keys = normalizedWords.get(word)
    if (!keys) {
      keys = quranSearchKeys(word, spellingSensitive)
      normalizedWords.set(word, keys)
      keys.forEach(key => vocabulary.add(key))
    }
    return keys
  }
  const indexed: IndexedVerse[] = verses.map(verse => {
    const prefixed = new Set(waw[`${verse[0]}:${verse[1]}`] ?? [])
    const tokens: SearchToken[] = verse[2].flatMap((word, i) => {
      const pos = i + 1
      const { prefix, stem } = splitWord({ t: word, wa: prefixed.has(pos) })
      const parts: SearchToken[] = []
      if (prefix) parts.push({ text: prefix, keys: tokenKeys(prefix), pos, part: 1 })
      const keys = tokenKeys(stem)
      if (keys.length) parts.push({ text: stem, keys, pos, part: 2 })
      return parts
    })
    const variants = tokens.some(token => token.keys.length > 1) ? [0, 1] : [0]
    const compact = variants.map(variant => {
      let text = ''
      const ranges = tokens.map(token => {
        const from = text.length
        text += token.keys[variant] ?? token.keys[0]
        return { token, from, to: text.length }
      })
      return { text, ranges }
    })
    return { verse, tokens, compact }
  })
  return (input: string, surah = 0, { includePartial = true, includeNear = false }: QuranSearchOptions = {}): QuranSearchResult[] => {
    const query = normalizeQuranSearch(input, false, spellingSensitive)
    if (query.replace(/\s/g, '').length < 2) return []
    const terms = query.split(' ')
    const compactQuery = terms.join('')
    const termBoundaries = new Set<number>()
    let offset = 0
    for (const term of terms.slice(0, -1)) {
      offset += term.length
      termBoundaries.add(offset)
    }
    const budget = terms.length === 1 ? (terms[0].length >= 6 ? 2 : 1) : Math.min(3, Math.max(1, Math.ceil(compactQuery.length / 12)))
    const distances = includeNear && !spellingSensitive ? terms.map(term => {
      const max = term.length < 3 ? 0 : term.length < 6 ? 1 : 2
      const matches = new Map<string, number>()
      if (max === 0) { if (vocabulary.has(term)) matches.set(term, 0); return matches }
      for (const word of vocabulary) {
        const cost = typoDistance(term, word, max)
        if (cost <= max) matches.set(word, cost)
      }
      return matches
    }) : null
    const results: QuranSearchResult[] = []
    for (const { verse: [s, a, words], tokens, compact } of indexed) {
      if (surah && s !== surah) continue
      let score = Infinity; let positions: number[] = []; let parts: Record<number, number> = {}; let kind: QuranSearchResult['kind'] = 'near'
      let occurrences: Map<string, number[]> | undefined
      const hitKey = (token: SearchToken, offset: number, variant: number) => {
        const sourceOffset = token.keys.length > 1 ? originalOffset(token.text, variant, offset) : offset
        return `${token.pos}:${token.part}:${sourceOffset}`
      }
      const record = (cost: number, matched: number[], masks: Record<number, number>, occurrence: string) => {
        if (cost < score) { positions = []; parts = {}; occurrences?.clear() }
        positions = [...new Set([...positions, ...matched])]
        for (const pos of matched) parts[pos] = (parts[pos] ?? 0) | masks[pos]
        if (!occurrences) occurrences = new Map()
        occurrences.set(occurrence, matched)
        score = cost
      }
      const lastStart = terms.length > 1 || distances ? tokens.length - terms.length : -1
      for (let start = 0; start <= lastStart; start++) {
        let cost = 0
        for (let offset = 0; offset < terms.length; offset++) {
          const keys = tokens[start + offset].keys
          if (keys.includes(terms[offset])) continue
          cost += distances ? Math.min(...keys.map(key => distances[offset].get(key) ?? Infinity)) : Infinity
          if (cost > score || cost > budget) break
        }
        if (cost > score || cost > budget) continue
        const matched = tokens.slice(start, start + terms.length)
        const first = matched[0], last = matched[matched.length - 1]
        const lastTerm = terms[terms.length - 1]
        const occurrence = cost === 0
          ? `${hitKey(first, 0, first.keys.indexOf(terms[0]))}-${hitKey(last, lastTerm.length - 1, last.keys.indexOf(lastTerm))}`
          : `${start}-${start + terms.length - 1}`
        const masks: Record<number, number> = {}
        for (const token of matched) masks[token.pos] = (masks[token.pos] ?? 0) | token.part
        record(cost, Object.keys(masks).map(Number), masks, occurrence)
        kind = cost === 0 ? 'exact' : 'near'
      }
      // Rank by the best literal occurrence, but highlight every literal occurrence.
      // A whole-word hit must not hide an occurrence inside another word in the verse.
      let literalScore = score === 0 ? 0 : Infinity
      const literalPositions = new Set<number>(score === 0 ? positions : [])
      const literalParts: Record<number, number> = score === 0 ? { ...parts } : {}
      let literalOccurrences: Map<string, number[]> | undefined = score === 0 ? occurrences : undefined
      // Ignore accidental spaces inside words, and also accept incomplete words.
      for (const [variant, item] of compact.entries()) {
        for (let start = item.text.indexOf(compactQuery); start >= 0; start = item.text.indexOf(compactQuery, start + 1)) {
          const end = start + compactQuery.length
          const matched = item.ranges.filter(range => range.from < end && range.to > start)
          const first = matched[0], last = matched[matched.length - 1]
          const whole = first.from === start && last.to === end
          if (!whole && !includePartial) continue
          // Incomplete terms cannot cross a lexical boundary. Complete phrases
          // still accept omitted spaces, except a lone word can't merge a clitic with its stem.
          if (matched.slice(1).some((range, index) =>
            (!whole && !termBoundaries.has(range.from - start)) ||
            (terms.length === 1 && range.token.pos === matched[index].token.pos))) continue
          const value = whole ? 0 : 0.5
          literalScore = Math.min(literalScore, value)
          const occurrence = `${hitKey(first.token, start - first.from, variant)}-${hitKey(last.token, end - 1 - last.from, variant)}`
          if (!literalOccurrences) literalOccurrences = new Map()
          literalOccurrences.set(occurrence, [...new Set(matched.map(({ token }) => token.pos))])
          for (const { token } of matched) {
            literalPositions.add(token.pos)
            literalParts[token.pos] = (literalParts[token.pos] ?? 0) | token.part
          }
        }
      }
      if (literalPositions.size) {
        positions = [...literalPositions]; parts = literalParts; score = literalScore
        occurrences = literalOccurrences
        kind = literalScore === 0 ? 'exact' : 'partial'
      }
      if (occurrences) results.push({ s, a, words, parts, waw: waw[`${s}:${a}`] ?? [], positions: positions.sort((a, b) => a - b), occurrences: [...occurrences.values()].sort((a, b) => a[0] - b[0]), kind, score })
    }
    return results.sort((a, b) => a.score - b.score || a.s - b.s || a.a - b.a)
  }
}
