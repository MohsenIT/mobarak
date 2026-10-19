import { createSearchSession, type SearchCorpus, type SearchSessionOptions } from './quran-search-session'
import type { AnalysisSelection } from './analysis'
let search: Promise<ReturnType<typeof createSearchSession>> | undefined
self.addEventListener('message', async (event: MessageEvent<{ id: number; query: string; options?: SearchSessionOptions; filter?: AnalysisSelection | null }>) => {
  const { id, query, options, filter } = event.data
  try {
    search ??= fetch(new URL('/data/quran-search.json', self.location.origin)).then(async response => {
      if (!response.ok) throw new Error('corpus')
      return createSearchSession(await response.json() as SearchCorpus)
    }).catch(error => { search = undefined; throw error })
    self.postMessage({ id, results: (await search)(query, options, filter) })
  } catch { self.postMessage({ id, error: true }) }
})
