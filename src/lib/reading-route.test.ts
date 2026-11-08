import { expect, test } from 'bun:test'
import { initialReading, readingLocation, readingRoute, searchEntry, searchExit } from './reading-route'
import type { SearchLinkState } from './search-link'

const search: SearchLinkState = {
  query: 'الله', mode: 'text', surahs: [], lemmas: [], forms: [],
  includeRoots: true, includePartial: true, includeNear: false,
  showTranslation: false, translator: 's', occurrence: null,
}

test('a location resolves to the same reading view the reader restores', () => {
  // Search outranks a verse address; a verse address outranks its surah; a
  // bare surah outranks a page.
  expect(readingRoute('https://x.test/q?q=الله')?.kind).toBe('search')
  expect(readingRoute('https://x.test/?search=1&q=الله')?.kind).toBe('search')
  expect(readingRoute('https://x.test/s/20/a/7/w/6')).toEqual({ kind: 'verse', address: { s: 20, a: 7, pos: 6 } })
  expect(readingRoute('https://x.test/?s=20&a=7')).toEqual({ kind: 'verse', address: { s: 20, a: 7, pos: 1 } })
  expect(readingRoute('https://x.test/s/20')).toEqual({ kind: 'surah', s: 20 })
  expect(readingRoute('https://x.test/p/12')).toEqual({ kind: 'page', p: 12 })
  // A search link carrying a stray verse address stays a search link.
  expect(readingRoute('https://x.test/q?q=الله&s=20&a=7')?.kind).toBe('search')
})

test('a location with no reading position resolves to nothing', () => {
  expect(readingRoute('https://x.test/')).toBeNull()
  expect(readingRoute('https://x.test/?p=999')).toBeNull()
  expect(readingRoute('https://x.test/s/115')).toBeNull()
  expect(readingRoute('https://x.test/study/taha')).toBeNull()
})

test('the first render prefers the location over the stored position', () => {
  const stored = { page: 42, mode: 'flow' as const, surah: 3 }
  expect(initialReading(stored, { search: '', pathname: '/p/12' })).toEqual({ page: 12, mode: 'mushaf', surah: 3 })
  expect(initialReading(stored, { search: '', pathname: '/s/20' })).toEqual({ page: 42, mode: 'flow', surah: 20 })
  // A verse address implies flow mode, but does not change the initial surah:
  // the surah number is read separately, exactly as the reader has always done.
  expect(initialReading(stored, { search: '', pathname: '/s/20/a/7' })).toEqual({ page: 42, mode: 'flow', surah: 20 })
  // No location (server rendering) falls back to storage untouched.
  expect(initialReading(stored, null)).toEqual(stored)
  // Readable legacy paths are honoured too.
  expect(initialReading(stored, { search: '', pathname: '/page/12' })).toEqual({ page: 12, mode: 'mushaf', surah: 3 })
})

test('the first render clamps a stored page into the mushaf range', () => {
  expect(initialReading({ page: 900, mode: 'mushaf', surah: 1 }, null).page).toBe(604)
  expect(initialReading({ page: 0, mode: 'mushaf', surah: 1 }, null).page).toBe(1)
})

test('reading state writes the canonical location but never overwrites a search link', () => {
  expect(readingLocation('https://x.test/?s=20&a=7', 'flow', 20, 1)?.pathname).toBe('/s/20/a/7')
  expect(readingLocation('https://x.test/?s=20&a=7', 'mushaf', 20, 12)?.pathname).toBe('/p/12')
  expect(readingLocation('https://x.test/q?q=الله', 'flow', 20, 1)).toBeNull()
  // The native desktop build keeps one entry point and carries the address in the query.
  expect(readingLocation('tauri://localhost/?s=20&a=7', 'flow', 20, 1, true)?.href).toBe('tauri://localhost/?s=20&a=7')
})

test('entering search is distinguished from updating it', () => {
  const entering = searchEntry('https://x.test/s/20', search)
  expect(entering.entering).toBe(true)
  expect(entering.href).toBe('https://x.test/q?q=%D8%A7%D9%84%D9%84%D9%87')
  const updating = searchEntry('https://x.test/q?q=الله', search)
  expect(updating.entering).toBe(false)
  expect(updating.href).toBe('https://x.test/q?q=%D8%A7%D9%84%D9%84%D9%87')
})

test('leaving search steps back when we pushed it and replaces a direct deep link', () => {
  const fallback = new URL('https://x.test/s/1')
  expect(searchExit('https://x.test/q?q=الله', { quranSearchEntry: true }, 'https://x.test/s/20/a/7', fallback)).toEqual({ kind: 'back' })
  // A direct deep link has no prior reading entry: restore the remembered
  // reading position when there is one, otherwise the fallback view.
  expect(searchExit('https://x.test/q?q=الله', null, 'https://x.test/s/20/a/7', fallback)).toEqual({ kind: 'replace', href: 'https://x.test/s/20/a/7' })
  expect(searchExit('https://x.test/q?q=الله', null, null, fallback)).toEqual({ kind: 'replace', href: 'https://x.test/s/1' })
  // Not on the search page: nothing to unwind.
  expect(searchExit('https://x.test/s/20', { quranSearchEntry: true }, null, fallback)).toBeNull()
})
