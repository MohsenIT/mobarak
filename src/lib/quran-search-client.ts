export function createQuranSearchWorker() {
  return new Worker(new URL('./quran-search.worker.ts', import.meta.url), { type: 'module' })
}
