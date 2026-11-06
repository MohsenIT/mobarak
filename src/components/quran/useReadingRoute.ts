'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { readPageNumber, readSurahNumber, readVerseAddress, readingUrl, type VerseAddress } from '@/lib/verse-link'
import { readSearchLink, type SearchLinkState } from '@/lib/search-link'
import { readStored, writeStored } from '@/lib/reader-storage'
import { initialReading, readingLocation, searchEntry, searchExit, type ReadingMode } from '@/lib/reading-route'

const clampPage = (value: number) => Math.min(604, Math.max(1, value))
const NATIVE = process.env.NEXT_PUBLIC_DESKTOP === '1'

/**
 * What the reader does with a location it did not originate. The hook owns the
 * route (page / mode / surah) and the URL; the caller owns what a route change
 * means for the rest of the screen, because only it knows about selection,
 * flash and the search panel.
 */
export type ReadingRouteHandlers = {
  /**
   * The location describes the advanced search page. `sameEntry` is true for
   * the entry the reader itself just wrote, whose state is already on screen.
   */
  onSearch: (state: SearchLinkState, sameEntry: boolean) => void
  /** The location addresses a verse; the caller reveals it once loaded. */
  onVerse: (address: VerseAddress) => void
  /** The location is a surah or page: the caller drops transient selection state. */
  onReading: () => void
}

/**
 * Reading position and browser history, in one place.
 *
 * Owns: the page / mode / surah triple, their `mushaf.*` persistence, the
 * canonical reading URL, browser back/forward restoration, and the history
 * bookkeeping that lets advanced search be entered and left without losing the
 * reading position. It does not own search panel state, selection, audio or
 * presentation settings — those are passed back through `handlers`.
 */
export function useReadingRoute(handlers: ReadingRouteHandlers) {
  const [initial] = useState(() =>
    initialReading(
      { page: readStored('mushaf.page', 1), mode: readStored<ReadingMode>('mushaf.mode', 'flow'), surah: readStored('mushaf.surah', 1) },
      typeof window === 'undefined' ? null : window.location,
    ),
  )
  const [page, setPage] = useState(initial.page)
  const [mode, setMode] = useState<ReadingMode>(initial.mode)
  const [surah, setSurah] = useState(initial.surah)
  const [mushafNavigationRevision, setMushafNavigationRevision] = useState(0)

  const readingBeforeSearch = useRef<string | null>(null)
  const lastSearchUrl = useRef<string | null>(null)

  // The popstate listener is registered once, so it reads the newest handlers
  // from a ref rather than re-subscribing on every render.
  const latest = useRef(handlers)
  useEffect(() => { latest.current = handlers })

  const requestMushafPage = useCallback((p: number) => {
    setPage(clampPage(p))
    setMushafNavigationRevision(n => n + 1)
  }, [])

  const writeSearchState = useCallback((state: SearchLinkState) => {
    const current = window.location.href
    const { href, entering } = searchEntry(current, state, NATIVE)
    if (entering) readingBeforeSearch.current = current
    lastSearchUrl.current = href
    if (href === current) return
    window.history[entering ? 'pushState' : 'replaceState'](entering ? { ...window.history.state, quranSearchEntry: true } : window.history.state, '', href)
  }, [])

  /**
   * Unwinds the search URL when the panel closes: pop our own history entry, or
   * — for a direct deep link — rewrite the location to the reading view. The
   * panel's own open flag is the caller's state, not the hook's.
   */
  const leaveSearch = useCallback(() => {
    const current = window.location.href
    const fallback = readingUrl(new URL('/', current).href, mode, surah, page, NATIVE)
    const exit = searchExit(current, window.history.state, readingBeforeSearch.current, fallback)
    if (!exit) return
    if (exit.kind === 'back') window.history.back()
    else window.history.replaceState(window.history.state, '', exit.href)
  }, [mode, surah, page])

  // Restore whatever the current location describes: this runs once on mount
  // (a deep link or a refresh) and again for every back/forward navigation.
  useEffect(() => {
    const restore = () => {
      const current = window.location.href
      const search = readSearchLink(current)
      if (search) {
        latest.current.onSearch(search, lastSearchUrl.current === current)
        return
      }
      const address = readVerseAddress(window.location.search, window.location.pathname)
      if (address) {
        setMode('flow')
        setSurah(address.s)
        latest.current.onVerse(address)
        return
      }
      latest.current.onReading()
      const s = readSurahNumber(window.location.search, window.location.pathname)
      const p = readPageNumber(window.location.search, window.location.pathname)
      if (s) { setMode('flow'); setSurah(s) }
      else if (p) { setMode('mushaf'); requestMushafPage(p) }
    }
    restore()
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [requestMushafPage])

  // The URL is the canonical reading location: keep it in step with the route,
  // except while advanced search owns it.
  useEffect(() => {
    writeStored('mushaf.page', page)
    const url = readingLocation(window.location.href, mode, surah, page, NATIVE)
    if (url) window.history.replaceState(window.history.state, '', url.toString())
  }, [page, mode, surah])
  useEffect(() => { writeStored('mushaf.mode', mode) }, [mode])
  useEffect(() => { writeStored('mushaf.surah', surah) }, [surah])

  return { page, setPage, mode, setMode, surah, setSurah, requestMushafPage, mushafNavigationRevision, writeSearchState, leaveSearch }
}
