import { parseProfessionalQuery } from './professional-query'
import { createSearchSession, type SearchCorpus, type SearchSessionOptions } from './quran-search-session'
import { createSearchSuggestions } from './search-suggestions'
import type { AnalysisSelection } from './analysis'
let engine: Promise<{ search: ReturnType<typeof createSearchSession>; suggest: ReturnType<typeof createSearchSuggestions> }> | undefined
self.addEventListener('message', async (event: MessageEvent<{ warmup: true } | { id: number; query: string; options?: SearchSessionOptions; filter?: AnalysisSelection | null; phase2?: boolean; countsKey?: string; emptyScope?: boolean }>) => {
  if ('warmup' in event.data) { self.postMessage({ ready: true }); return }
  const { id, query, options, filter, phase2, countsKey, emptyScope } = event.data
  const start = performance.now()
  try {
    engine ??= fetch(new URL('/data/quran-search.json', self.location.origin)).then(async response => {
      if (!response.ok) throw new Error('corpus')
      const corpus = await response.json() as SearchCorpus
      return { search: createSearchSession(corpus), suggest: createSearchSuggestions(corpus) }
    }).catch(error => { engine = undefined; throw error })
    const { search, suggest } = await engine
    const ready = performance.now()
    const results = emptyScope ? [] : search(query, options, filter)
    if (countsKey) {
      const counts: Record<number, number> = {}
      for (const result of results) counts[result.s] = (counts[result.s] ?? 0) + (result.occurrences?.length ?? result.positions.length)
      self.postMessage({ key: countsKey, counts })
      return
    }
    const suggestions = filter || emptyScope || parseProfessionalQuery(query).status !== 'ordinary' ? [] : suggest(query, options?.mode, options?.surahs, phase2)
    self.postMessage({ id, results, suggestions, ...(phase2 ? { timing: { initMs: ready - start, searchMs: performance.now() - ready } } : {}) })
  } catch { self.postMessage({ id, key: countsKey, error: true }) }
})
