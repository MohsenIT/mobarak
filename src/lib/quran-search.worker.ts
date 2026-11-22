import { createSearchSession, type SearchCorpus, type SearchSessionOptions } from './quran-search-session'
import { createSearchSuggestions } from './search-suggestions'
import type { AnalysisSelection } from './analysis'
let engine: Promise<{ search: ReturnType<typeof createSearchSession>; suggest: ReturnType<typeof createSearchSuggestions> }> | undefined
self.addEventListener('message', async (event: MessageEvent<{ warmup: true } | { id: number; query: string; options?: SearchSessionOptions; filter?: AnalysisSelection | null; phase2?: boolean }>) => {
  if ('warmup' in event.data) { self.postMessage({ ready: true }); return }
  const { id, query, options, filter, phase2 } = event.data
  const start = performance.now()
  try {
    engine ??= fetch(new URL('/data/quran-search.json', self.location.origin)).then(async response => {
      if (!response.ok) throw new Error('corpus')
      const corpus = await response.json() as SearchCorpus
      return { search: createSearchSession(corpus), suggest: createSearchSuggestions(corpus) }
    }).catch(error => { engine = undefined; throw error })
    const { search, suggest } = await engine
    const ready = performance.now()
    const results = search(query, options, filter)
    const suggestions = filter ? [] : suggest(query, options?.mode, options?.surahs)
    self.postMessage({ id, results, suggestions, ...(phase2 ? { timing: { initMs: ready - start, searchMs: performance.now() - ready } } : {}) })
  } catch { self.postMessage({ id, error: true }) }
})
