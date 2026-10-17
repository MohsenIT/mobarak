import { createQuranSearch, type SearchVerse, type QuranSearchOptions } from './quran-search'

let search: Promise<ReturnType<typeof createQuranSearch>> | undefined
self.addEventListener('message', async (event: MessageEvent<{ id: number; query: string; surah: number; options?: QuranSearchOptions }>) => {
  const { id, query, surah, options } = event.data
  try {
    search ??= fetch(new URL('/data/quran-search.json', self.location.origin)).then(async response => {
      if (!response.ok) throw new Error('corpus')
      const corpus: { verses: SearchVerse[]; waw?: Record<string, number[]> } = await response.json()
      return createQuranSearch(corpus.verses, corpus.waw)
    }).catch(error => { search = undefined; throw error })
    self.postMessage({ id, results: (await search)(query, surah, options) })
  } catch { self.postMessage({ id, error: true }) }
})
