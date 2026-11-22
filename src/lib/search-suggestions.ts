import { normalizeQuranSearch } from './quran-search'
import type { SearchCorpus, SearchMode } from './quran-search-session'
import { lemmaDisplay } from './lemma-display'

/** Attested words/phrases only; never invent Quran completions. */
export function createSearchSuggestions(corpus: SearchCorpus) {
  const rootCounts = new Map<string, number>(), lemmaCounts = new Map<string, number>()
  for (const words of Object.values(corpus.morphology)) for (const [root, lemma] of words) { if (root) { rootCounts.set(root, (rootCounts.get(root) ?? 0) + 1) }; if (lemma) { const value = lemmaDisplay(lemma); lemmaCounts.set(value, (lemmaCounts.get(value) ?? 0) + 1) } }
  const vocabulary = new Map<string, { original: string; key: string; count: number }>()
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
    else vocabulary.set(key, { original: word, key, count: 1 })
  }
  return (query: string, mode: SearchMode = 'text', surahs: number[] = [], completionsOnly = false) => {
    const key = normalizeQuranSearch(query, true)
    if (!key) return []
    const scope = new Set(surahs)
    const within = (s: number) => !scope.size || scope.has(s)
    if (mode !== 'text') {
      let counts = mode === 'root' ? rootCounts : lemmaCounts
      if (completionsOnly && scope.size) {
        counts = new Map()
        for (const [s, a] of corpus.verses) {
          if (!within(s)) continue
          for (const [root, lemma] of corpus.morphology[`${s}:${a}`] ?? []) {
            const value = mode === 'root' ? root : lemma && lemmaDisplay(lemma)
            if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
          }
        }
      }
      const compact = key.replace(/\s/g, '')
      return [...counts].map(([value, count]) => ({ value, count, key: normalizeQuranSearch(value, true).replace(/\s/g, '') }))
        .filter(item => item.key.includes(compact) && (!completionsOnly || item.key !== compact))
        .sort((a, b) => Number(b.key === compact) - Number(a.key === compact) || Number(b.key.startsWith(compact)) - Number(a.key.startsWith(compact)) || b.count - a.count || a.value.localeCompare(b.value, 'ar'))
        .slice(0, 6).map(item => item.value)
    }
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
        if (!within(s)) continue
        for (let i = 0; i <= words.length - size; i++) {
          const spelling = wordKeys.get(words[i])
          if (spelling?.first !== terms[0] && spelling?.plainFirst !== plainFirst) continue
          const span = words.slice(i, i + size)
          const keys = span.map(word => wordKeys.get(word)!)
          const normalized = keys.map(word => word.key).filter(Boolean).join(' ')
          const plain = keys.map(word => word.plain).filter(Boolean).join(' ')
          if (!normalized.startsWith(prefix) && !(plainKey && plain.startsWith(plainPrefix))) continue
          const exact = normalized === key || plain === plainKey
          if (completionsOnly && exact) continue
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
    const candidates = completionsOnly && scope.size ? new Map<string, { original: string; key: string; count: number }>() : vocabulary
    if (candidates !== vocabulary) for (const [s, , words] of corpus.verses) {
      if (!within(s)) continue
      for (const original of words) {
        const token = wordKeys.get(original)?.key
        if (!token?.startsWith(key)) continue
        const existing = candidates.get(token)
        if (existing) existing.count++
        else candidates.set(token, { original, key: token, count: 1 })
      }
    }
    return [...candidates.values()].filter(item => item.key.startsWith(key) && (!completionsOnly || item.key !== key))
      .sort((a, b) => Number(b.key === key) - Number(a.key === key) || b.count - a.count || a.key.localeCompare(b.key, 'ar'))
      .slice(0, 6).map(item => completionsOnly ? item.original : item.original.replace(/[\u06d6-\u06ed]/g, '').trim())
  }
}
