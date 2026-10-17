import { createQuranSearch, type SearchVerse } from './quran-search'

let search: Promise<ReturnType<typeof createQuranSearch>> | undefined
self.addEventListener('message', async (event: MessageEvent<{ id: number; query: string; surah: number }>) => {
  const { id, query, surah } = event.data
  try {
    search ??= fetch(new URL('/data/quran-search.json', self.location.origin)).then(async response => {
      if (!response.ok) throw new Error('corpus')
      const corpus: { verses: SearchVerse[] } = await response.json()
      return createQuranSearch(corpus.verses)
    }).catch(error => { search = undefined; throw error })
    self.postMessage({ id, results: (await search)(query, surah) })
  } catch { self.postMessage({ id, error: true }) }
})
