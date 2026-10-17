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

export type SearchVerse = [s: number, a: number, words: string[]]
export type QuranSearchResult = { s: number; a: number; words: string[]; waw: number[]; positions: number[]; kind: 'exact' | 'partial' | 'near'; score: number }
type IndexedVerse = { verse: SearchVerse; keys: string[][]; compact: { text: string; ranges: [number, number][] }[] }

export function createQuranSearch(verses: SearchVerse[], waw: Record<string, number[]> = {}) {
  const vocabulary = new Set<string>()
  const indexed: IndexedVerse[] = verses.map(verse => {
    const keys = verse[2].map(word => [...new Set([normalizeQuranSearch(word), normalizeQuranSearch(word, true)])].filter(Boolean))
    keys.flat().forEach(key => vocabulary.add(key))
    const compact = [0, 1].map(variant => {
      let text = ''; const ranges: [number, number][] = []
      keys.forEach(options => { const key = options[variant] ?? options[0] ?? ''; ranges.push([text.length, text.length + key.length]); text += key })
      return { text, ranges }
    })
    return { verse, keys, compact }
  })
  return (input: string, surah = 0): QuranSearchResult[] => {
    const query = normalizeQuranSearch(input)
    if (query.replace(/\s/g, '').length < 2) return []
    const terms = query.split(' ')
    const compactQuery = terms.join('')
    const budget = terms.length === 1 ? (terms[0].length >= 6 ? 2 : 1) : Math.min(3, Math.max(1, Math.ceil(compactQuery.length / 12)))
    const distances = terms.map(term => {
      const max = term.length < 3 ? 0 : term.length < 6 ? 1 : 2
      const matches = new Map<string, number>()
      if (max === 0) { if (vocabulary.has(term)) matches.set(term, 0); return matches }
      for (const word of vocabulary) {
        const cost = typoDistance(term, word, max)
        if (cost <= max) matches.set(word, cost)
      }
      return matches
    })
    const results: QuranSearchResult[] = []
    for (const { verse: [s, a, words], keys, compact } of indexed) {
      if (surah && s !== surah) continue
      let score = Infinity; let positions: number[] = []; let kind: QuranSearchResult['kind'] = 'near'
      for (let start = 0; start <= keys.length - terms.length; start++) {
        let cost = 0
        for (let offset = 0; offset < terms.length; offset++) {
          cost += Math.min(...keys[start + offset].map(key => distances[offset].get(key) ?? Infinity))
          if (cost > score || cost > budget) break
        }
        if (cost <= score && cost <= budget) {
          const matched = Array.from({ length: terms.length }, (_, i) => start + i + 1)
          positions = cost === score ? [...new Set([...positions, ...matched])] : matched
          score = cost; kind = cost === 0 ? 'exact' : 'near'
        }
      }
      // Ignore accidental spaces inside words, and also accept incomplete words.
      if (score > 0) for (const item of compact) {
        for (let start = item.text.indexOf(compactQuery); start >= 0; start = item.text.indexOf(compactQuery, start + 1)) {
          const end = start + compactQuery.length
          const matched = item.ranges.flatMap(([from, to], i) => from < end && to > start ? [i + 1] : [])
          const whole = item.ranges.some(([from]) => from === start) && item.ranges.some(([, to]) => to === end)
          const value = whole ? 0 : 0.5
          if (value <= score) {
            positions = value === score ? [...new Set([...positions, ...matched])] : matched
            score = value; kind = whole ? 'exact' : 'partial'
          }
        }
      }
      if (Number.isFinite(score)) results.push({ s, a, words, waw: waw[`${s}:${a}`] ?? [], positions: positions.sort((a, b) => a - b), kind, score })
    }
    return results.sort((a, b) => a.score - b.score || a.s - b.s || a.a - b.a)
  }
}
