import { createSearchSession, type SearchCorpus, type SearchSessionOptions } from './quran-search-session'
import { createSearchSuggestions } from './search-suggestions'
import type { AnalysisSelection } from './analysis'
let engine: Promise<{ search: ReturnType<typeof createSearchSession>; suggest: ReturnType<typeof createSearchSuggestions> }> | undefined
self.addEventListener('message', async (event: MessageEvent<{ id: number; query: string; options?: SearchSessionOptions; filter?: AnalysisSelection | null }>) => {
  const { id, query, options, filter } = event.data
  try {
    engine ??= fetch(new URL('/data/quran-search.json', self.location.origin)).then(async response => {
      if (!response.ok) throw new Error('corpus')
      const corpus = await response.json() as SearchCorpus
      return { search: createSearchSession(corpus), suggest: createSearchSuggestions(corpus) }
    }).catch(error => { engine = undefined; throw error })
    const { search, suggest } = await engine
    self.postMessage({ id, results: search(query, options, filter), suggestions: filter ? [] : suggest(query, options?.mode, options?.surahs) })
  } catch { self.postMessage({ id, error: true }) }
})
