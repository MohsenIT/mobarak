export type RootBook = 'tahqiq' | 'maqayis'
export type RootSummary = { word: string; summary: string; needsReview: boolean; sourceSha256: string; sourceWarning?: string }
type SummaryFile = { schemaVersion: number; entries: Record<string, RootSummary[]> }
const pending = new Map<RootBook, Promise<SummaryFile>>()

/** Separate previews leave the full source translations untouched. */
export async function rootSummaries(book: RootBook, root: string): Promise<RootSummary[]> {
  if (!pending.has(book)) pending.set(book, fetch(`/data/${book}-summaries.json`).then(response => {
    if (!response.ok) throw new Error('root summaries unavailable')
    return response.json() as Promise<SummaryFile>
  }).catch(error => { pending.delete(book); throw error }))
  return (await pending.get(book)!).entries[root] ?? []
}
