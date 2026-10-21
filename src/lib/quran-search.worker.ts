import { createSearchSession, type SearchCorpus, type SearchSessionOptions } from './quran-search-session'
import { normalizeQuranSearch } from './quran-search'
import { lemmaDisplay } from './lemma-display'
import type { AnalysisSelection } from './analysis'
let engine: Promise<{ search: ReturnType<typeof createSearchSession>; roots: string[]; lemmas: string[] }> | undefined
self.addEventListener('message', async (event: MessageEvent<{ id: number; query: string; options?: SearchSessionOptions; filter?: AnalysisSelection | null }>) => {
  const { id, query, options, filter } = event.data
  try {
    engine ??= fetch(new URL('/data/quran-search.json', self.location.origin)).then(async response => {
      if (!response.ok) throw new Error('corpus')
      const corpus = await response.json() as SearchCorpus
      const roots = new Set<string>(), lemmas = new Set<string>()
      for (const words of Object.values(corpus.morphology)) for (const [root, lemma] of words) { if (root) roots.add(root); if (lemma) lemmas.add(lemmaDisplay(lemma)) }
      return { search: createSearchSession(corpus), roots: [...roots], lemmas: [...lemmas] }
    }).catch(error => { engine = undefined; throw error })
    const { search, roots, lemmas } = await engine
    const key = normalizeQuranSearch(query).replace(/\s/g, '')
    const suggestions = !filter && options?.mode !== 'text' && options?.mode ? (options.mode === 'root' ? roots : lemmas).filter(value => normalizeQuranSearch(value).replace(/\s/g, '').includes(key)).sort((a, b) => Number(normalizeQuranSearch(b) === key) - Number(normalizeQuranSearch(a) === key) || a.localeCompare(b, 'ar')).slice(0, 10) : []
    self.postMessage({ id, results: search(query, options, filter), suggestions })
  } catch { self.postMessage({ id, error: true }) }
})
