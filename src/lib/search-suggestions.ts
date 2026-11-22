import { normalizeQuranSearch } from './quran-search'
import type { SearchCorpus, SearchMode } from './quran-search-session'
import { lemmaDisplay } from './lemma-display'

/** Attested words/phrases only; never invent Quran completions. */
export function createSearchSuggestions(corpus: SearchCorpus) {
  const roots = new Set<string>(), lemmas = new Set<string>()
  const rootCounts = new Map<string, number>(), lemmaCounts = new Map<string, number>()
  for (const words of Object.values(corpus.morphology)) for (const [root, lemma] of words) { if (root) { roots.add(root); rootCounts.set(root, (rootCounts.get(root) ?? 0) + 1) }; if (lemma) { const value = lemmaDisplay(lemma); lemmas.add(value); lemmaCounts.set(value, (lemmaCounts.get(value) ?? 0) + 1) } }
  const vocabulary = new Map<string, { value: string; key: string; count: number }>()
  const wordKeys = new Map<string, { key: string; plain: string; first: string; plainFirst: string }>()
  for (const [, , words] of corpus.verses) for (const word of words) {
    let spelling = wordKeys.get(word)
    if (!spelling) {
      const key = normalizeQuranSearch(word, true)
      const plain = normalizeQuranSearch(word)
      spelling = { key, plain, first: key.split(' ', 1)[0], plainFirst: plain.split(' ', 1)[0] }
      wordKeys.set(word, spelling)
    }
    const { key } = spelling
    if (!key) continue
    const existing = vocabulary.get(key)
    if (existing) existing.count++
    else vocabulary.set(key, { value: word.replace(/[\u06d6-\u06ed]/g, '').trim(), key, count: 1 })
  }
  return (query: string, mode: SearchMode = 'text', surahs: number[] = []) => {
    const key = normalizeQuranSearch(query, true)
    if (!key) return []
    if (mode !== 'text') return [...(mode === 'root' ? roots : lemmas)].map(value => ({ value, key: normalizeQuranSearch(value, true).replace(/\s/g, '') })).filter(item => item.key.includes(key.replace(/\s/g, ''))).sort((a, b) => Number(b.key === key) - Number(a.key === key) || Number(b.key.startsWith(key)) - Number(a.key.startsWith(key)) || ((mode === 'root' ? rootCounts : lemmaCounts).get(b.value) ?? 0) - ((mode === 'root' ? rootCounts : lemmaCounts).get(a.value) ?? 0) || a.value.localeCompare(b.value, 'ar')).slice(0, 6).map(item => item.value)
    const continuesPhrase = /\s$/.test(query)
    if (continuesPhrase || key.includes(' ')) {
      const suffix = continuesPhrase ? ' ' : ''
      const prefix = key + suffix
      const plainKey = normalizeQuranSearch(query)
      const plainPrefix = plainKey + suffix
      const terms = key.split(' ')
      const plainFirst = plainKey.split(' ', 1)[0]
      const size = terms.length + Number(continuesPhrase)
      const matches = new Map<string, { value: string; count: number; exact: boolean }>()
      for (const [s, , words] of corpus.verses) {
        if (surahs.length && !surahs.includes(s)) continue
        for (let i = 0; i <= words.length - size; i++) {
          const spelling = wordKeys.get(words[i])
          if (spelling?.first !== terms[0] && spelling?.plainFirst !== plainFirst) continue
          const span = words.slice(i, i + size)
          const keys = span.map(word => wordKeys.get(word)!)
          const normalized = keys.map(word => word.key).filter(Boolean).join(' ')
          const plain = keys.map(word => word.plain).filter(Boolean).join(' ')
          if (!normalized.startsWith(prefix) && !(plainKey && plain.startsWith(plainPrefix))) continue
          const exact = normalized === key || plain === plainKey
          const match = matches.get(normalized)
          if (match) {
            match.count++
            match.exact ||= exact
          } else {
            matches.set(normalized, { value: span.join(' '), count: 1, exact })
          }
        }
      }
      return [...matches.values()].sort((a, b) => Number(b.exact) - Number(a.exact) || b.count - a.count).slice(0, 6).map(match => match.value)
    }
    return [...vocabulary.values()].filter(item => item.key.startsWith(key)).sort((a, b) => Number(b.key === key) - Number(a.key === key) || b.count - a.count || a.key.localeCompare(b.key, 'ar')).slice(0, 6).map(item => item.value)
  }
}
