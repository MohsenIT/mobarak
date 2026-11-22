/** Search keys only: the displayed Quran words always remain unchanged. */
export function normalizeQuranSearch(text: string, restoreSmallLetters = false): string {
  let value = text.normalize('NFKC')
  if (restoreSmallLetters) value = value.replace(/و\u0670/g, 'ا').replace(/ى\u0670/g, 'ى').replace(/\u0670/g, 'ا').replace(/\u06e7/g, 'ي')
  return value.replace(/[أإآٱ]/g, 'ا').replace(/[یىئ]/g, 'ي').replace(/ک/g, 'ك')
    .replace(/ؤ/g, 'و').replace(/ة/g, 'ه').replace(/ء/g, '')
    .replace(/[\p{M}\u0610-\u061a\u06d6-\u06edـ\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ').toLowerCase()
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
export type QuranSearchResult = { s: number; a: number; words: string[]; waw: number[]; parts: Record<number, number>; positions: number[]; occurrences?: number[][]; kind: 'exact' | 'partial' | 'near' | 'root'; score: number; morphology?: [string | null, string | null, string | null][] }
export type QuranSearchCounts = { occurrences: number; words: number; verses: number }

export function countQuranSearchResults(results: QuranSearchResult[]): QuranSearchCounts {
  let occurrences = 0
  let words = 0
  for (const result of results) {
    occurrences += result.occurrences?.length ?? result.positions.length
    words += result.positions.length
  }
  return { occurrences, words, verses: results.length }
}

type IndexedVerse = { verse: SearchVerse; keys: string[][]; prefixed: Set<number>; compact: { text: string; ranges: [number, number][]; boundaries: Set<number> }[] }

export function createQuranSearch(verses: SearchVerse[], waw: Record<string, number[]> = {}) {
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
  const indexed: IndexedVerse[] = verses.map(verse => {
    const keys = verse[2].map(word => {
      let options = normalizedWords.get(word)
      if (!options) {
        options = [...new Set([normalizeQuranSearch(word), normalizeQuranSearch(word, true)])].filter(Boolean)
        normalizedWords.set(word, options)
        options.forEach(key => vocabulary.add(key))
      }
      return options
    })
    const prefixed = new Set(waw[`${verse[0]}:${verse[1]}`] ?? [])
    const variants = keys.some(options => options.length > 1) ? [0, 1] : [0]
    const compact = variants.map(variant => {
      let text = ''; const ranges: [number, number][] = []; const boundaries = new Set<number>()
      keys.forEach((options, i) => {
        const key = options[variant] ?? options[0] ?? ''
        const from = text.length
        ranges.push([from, from + key.length])
        boundaries.add(from); boundaries.add(from + key.length)
        // A corpus-tagged waw and its stem are independent lexical units.
        // Keep canonical positions for result navigation and highlighting.
        if (prefixed.has(i + 1) && key.startsWith('و')) boundaries.add(from + 1)
        text += key
      })
      return { text, ranges, boundaries }
    })
    return { verse, keys, prefixed, compact }
  })
  return (input: string, surah = 0, { includePartial = true, includeNear = false }: QuranSearchOptions = {}): QuranSearchResult[] => {
    const query = normalizeQuranSearch(input)
    if (query.replace(/\s/g, '').length < 2) return []
    const terms = query.split(' ')
    const compactQuery = terms.join('')
    const budget = terms.length === 1 ? (terms[0].length >= 6 ? 2 : 1) : Math.min(3, Math.max(1, Math.ceil(compactQuery.length / 12)))
    const distances = includeNear ? terms.map(term => {
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
    for (const { verse: [s, a, words], keys, prefixed, compact } of indexed) {
      if (surah && s !== surah) continue
      let score = Infinity; let positions: number[] = []; let parts: Record<number, number> = {}; let kind: QuranSearchResult['kind'] = 'near'
      let occurrences: Map<string, number[]> | undefined
      const hitKey = (pos: number, offset: number, variant: number) => {
        const sourceOffset = keys[pos - 1].length > 1 ? originalOffset(words[pos - 1], variant, offset) : offset
        return `${pos}:${sourceOffset}`
      }
      const record = (cost: number, matched: number[], masks: Record<number, number>, occurrence: string) => {
        if (cost < score) { positions = []; parts = {}; occurrences?.clear() }
        positions = [...new Set([...positions, ...matched])]
        for (const pos of matched) parts[pos] = (parts[pos] ?? 0) | masks[pos]
        if (!occurrences) occurrences = new Map()
        occurrences.set(occurrence, matched)
        score = cost
      }
      const lastStart = terms.length > 1 || distances ? keys.length - terms.length : -1
      for (let start = 0; start <= lastStart; start++) {
        let cost = 0
        for (let offset = 0; offset < terms.length; offset++) {
          const word = keys[start + offset]
          if (distances) cost += Math.min(...word.map(key => distances[offset].get(key) ?? Infinity))
          else if (!word.includes(terms[offset])) cost = Infinity
          if (cost > score || cost > budget) break
        }
        if (cost <= score && cost <= budget) {
          const matched = Array.from({ length: terms.length }, (_, i) => start + i + 1)
          const last = start + terms.length - 1
          const lastTerm = terms[terms.length - 1]
          const occurrence = cost === 0
            ? `${hitKey(start + 1, 0, keys[start].indexOf(terms[0]))}-${hitKey(last + 1, lastTerm.length - 1, keys[last].indexOf(lastTerm))}`
            : `${start + 1}-${last + 1}`
          record(cost, matched, Object.fromEntries(matched.map(pos => [pos, prefixed.has(pos) ? 3 : 2])), occurrence)
          kind = cost === 0 ? 'exact' : 'near'
        }
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
          const matched = item.ranges.flatMap(([from, to], i) => from < end && to > start ? [i + 1] : [])
          const whole = item.boundaries.has(start) && item.boundaries.has(end)
          // A single word may match inside one token, or full adjacent tokens
          // with omitted spaces; never invent a word from two partial edges.
          if (terms.length === 1 && matched.length > 1 && !whole) continue
          if (!whole && !includePartial) continue
          const value = whole ? 0 : 0.5
          literalScore = Math.min(literalScore, value)
          const first = matched[0]
          const last = matched[matched.length - 1]
          const occurrence = `${hitKey(first, start - item.ranges[first - 1][0], variant)}-${hitKey(last, end - 1 - item.ranges[last - 1][0], variant)}`
          if (!literalOccurrences) literalOccurrences = new Map()
          literalOccurrences.set(occurrence, matched)
          for (const pos of matched) {
            const [from, to] = item.ranges[pos - 1]
            // Bit 1 selects the independent waw; bit 2 selects the stem.
            const mask = prefixed.has(pos)
              ? (start < from + 1 && end > from ? 1 : 0) | (start < to && end > from + 1 ? 2 : 0)
              : 2
            literalPositions.add(pos)
            literalParts[pos] = (literalParts[pos] ?? 0) | mask
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
