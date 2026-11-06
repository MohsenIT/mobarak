import { readPageNumber, readSurahNumber, readVerseAddress, readingUrl, type VerseAddress } from './verse-link'
import { readSearchLink, searchLink, type SearchLinkState } from './search-link'

export type ReadingMode = 'mushaf' | 'flow'

/** Which reading view a browser location describes. */
export type ReadingRoute =
  | { kind: 'search'; state: SearchLinkState }
  | { kind: 'verse'; address: VerseAddress }
  | { kind: 'surah'; s: number }
  | { kind: 'page'; p: number }

/** Last known reading position, as persisted between visits. */
export type StoredReading = { page: number; mode: ReadingMode; surah: number }

const clampPage = (value: number) => Math.min(604, Math.max(1, value))

/**
 * The reading view a location points at. Search outranks a verse address,
 * which outranks a bare surah, which outranks a page — matching the order the
 * reader has always restored them in. Returns null for a location that
 * describes no reading position (e.g. `/`).
 */
export function readingRoute(href: string): ReadingRoute | null {
  const url = new URL(href, 'https://mobarak.invalid')
  const search = readSearchLink(href)
  if (search) return { kind: 'search', state: search }
  const address = readVerseAddress(url.search, url.pathname)
  if (address) return { kind: 'verse', address }
  const surah = readSurahNumber(url.search, url.pathname)
  if (surah) return { kind: 'surah', s: surah }
  const page = readPageNumber(url.search, url.pathname)
  return page ? { kind: 'page', p: page } : null
}

/**
 * Reading position for the very first render. A location passed in wins over
 * the stored position; `null` (server rendering, where there is no location)
 * falls back to storage.
 */
export function initialReading(stored: StoredReading, location: { search: string; pathname: string } | null) {
  const search = location?.search ?? ''
  const pathname = location?.pathname ?? '/'
  const fromPage = readPageNumber(search, pathname)
  const fromSurah = readSurahNumber(search, pathname)
  return {
    page: clampPage(fromPage ?? stored.page),
    mode: (fromSurah ? 'flow' : fromPage ? 'mushaf' : stored.mode) as ReadingMode,
    surah: fromSurah ?? stored.surah,
  }
}

/**
 * The canonical location for the reading view, or null while the advanced
 * search page owns the URL. Reading state never overwrites a search link.
 */
export function readingLocation(current: string, mode: ReadingMode, surah: number, page: number, native = false): URL | null {
  return readSearchLink(current) ? null : readingUrl(current, mode, surah, page, native)
}

export type SearchEntry = { href: string; entering: boolean }

/**
 * Writing search state either enters the search page (a new history entry, so
 * back returns to the reading position) or updates it in place. Callers record
 * `entering` to remember where to return to.
 */
export function searchEntry(current: string, state: SearchLinkState, native = false): SearchEntry {
  return { href: searchLink(current, state, native).href, entering: !readSearchLink(current) }
}

export type SearchExit =
  /** The search page was pushed by us: step back so its history entry disappears. */
  | { kind: 'back' }
  /** The search page was reached directly: rewrite the location to the reading view instead. */
  | { kind: 'replace'; href: string }

/**
 * Leaving the search page. A direct deep link has no prior reading history, so
 * it is replaced rather than popped; `fallback` is the reading view to show.
 * Returns null when the location is not the search page — nothing to unwind.
 */
export function searchExit(current: string, historyState: unknown, readingBefore: string | null, fallback: URL): SearchExit | null {
  if (!readSearchLink(current)) return null
  if ((historyState as { quranSearchEntry?: boolean } | null)?.quranSearchEntry) return { kind: 'back' }
  return { kind: 'replace', href: readingBefore ?? fallback.href }
}
