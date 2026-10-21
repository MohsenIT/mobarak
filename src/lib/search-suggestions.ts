import { normalizeQuranSearch } from './quran-search'
import type { SearchCorpus, SearchMode } from './quran-search-session'
import { lemmaDisplay } from './lemma-display'

/** Attested words/phrases only; never invent Quran completions. */
export function createSearchSuggestions(corpus: SearchCorpus) {
  const roots = new Set<string>(), lemmas = new Set<string>()
  const rootCounts = new Map<string, number>(), lemmaCounts = new Map<string, number>()
  for (const words of Object.values(corpus.morphology)) for (const [root, lemma] of words) { if (root) { roots.add(root); rootCounts.set(root, (rootCounts.get(root) ?? 0) + 1) }; if (lemma) { const value = lemmaDisplay(lemma); lemmas.add(value); lemmaCounts.set(value, (lemmaCounts.get(value) ?? 0) + 1) } }
  const vocabulary = new Map<string, { value: string; key: string; count: number }>()
  for (const [, , words] of corpus.verses) for (const word of words) {
    const key = normalizeQuranSearch(word, true)
    if (!key) continue
    const existing = vocabulary.get(key)
    if (existing) existing.count++
    else vocabulary.set(key, { value: word.replace(/[\u06d6-\u06ed]/g, '').trim(), key, count: 1 })
  }
  return (query: string, mode: SearchMode = 'text', surahs: number[] = []) => {
    const key = normalizeQuranSearch(query, true)
    if (!key) return []
    if (mode !== 'text') return [...(mode === 'root' ? roots : lemmas)].map(value => ({ value, key: normalizeQuranSearch(value, true).replace(/\s/g, '') })).filter(item => item.key.includes(key.replace(/\s/g, ''))).sort((a, b) => Number(b.key === key) - Number(a.key === key) || Number(b.key.startsWith(key)) - Number(a.key.startsWith(key)) || ((mode === 'root' ? rootCounts : lemmaCounts).get(b.value) ?? 0) - ((mode === 'root' ? rootCounts : lemmaCounts).get(a.value) ?? 0) || a.value.localeCompare(b.value, 'ar')).slice(0, 6).map(item => item.value)
    if (key.includes(' ')) {
      const size = key.split(' ').length, matches = new Map<string, string>()
      for (const [s, , words] of corpus.verses) {
        if (surahs.length && !surahs.includes(s)) continue
        for (let i = 0; i <= words.length - size; i++) {
          const phrase = words.slice(i, i + size).join(' '), normalized = normalizeQuranSearch(phrase, true)
          if (normalized.startsWith(key) && !matches.has(normalized)) matches.set(normalized, phrase)
          if (matches.size >= 6) return [...matches.values()]
        }
      }
      return [...matches.values()]
    }
    return [...vocabulary.values()].filter(item => item.key.startsWith(key)).sort((a, b) => Number(b.key === key) - Number(a.key === key) || b.count - a.count || a.key.localeCompare(b.key, 'ar')).slice(0, 6).map(item => item.value)
  }
}
