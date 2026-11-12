'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { readingUrl, writeVerseAddress, type VerseAddress } from '@/lib/verse-link'
import type { SearchLinkState } from '@/lib/search-link'
import { readStored, writeStored } from '@/lib/reader-storage'
import { initialReading, readingLocation, readingRoute, searchEntry, searchExit, type ReadingMode } from '@/lib/reading-route'

const clampPage = (value: number) => Math.min(604, Math.max(1, value))
const NATIVE = process.env.NEXT_PUBLIC_DESKTOP === '1'
type QuickOrigin = { href: string; mode: ReadingMode; surah: number; page: number; address: VerseAddress; offset: number }

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
  onQuickReturn: () => void
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
export function useReadingRoute(handlers: ReadingRouteHandlers, reader: React.RefObject<HTMLElement | null>) {
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
  const [quickOrigin, setQuickOrigin] = useState<QuickOrigin | null>(null)
  const [restoringQuick, setRestoringQuick] = useState<QuickOrigin | null>(null)
  const capturedQuick = useRef<QuickOrigin | null>(null)
  const quickVisitRevision = useRef(0)
  const prepareQuickVisit = useCallback(() => {
    const revision = ++quickVisitRevision.current
    return () => revision === quickVisitRevision.current
  }, [])

  const captureQuickOrigin = useCallback(() => {
    if (window.history.state?.quickJourney) return
    const scroll = reader.current?.querySelector<HTMLElement>('[data-reading-scroll]')
    const top = scroll?.getBoundingClientRect().top ?? 0
    const word = Array.from(scroll?.querySelectorAll<HTMLElement>('[data-pos]') ?? []).find(word => word.getBoundingClientRect().bottom > top + 2)
    capturedQuick.current = {
      href: window.location.href, mode, surah, page,
      address: word ? { s: Number(word.dataset.surah), a: Number(word.dataset.ayah), pos: Number(word.dataset.pos) } : { s: surah, a: 1, pos: 1 },
      offset: word ? word.getBoundingClientRect().top - top : 0,
    }
  }, [reader, mode, surah, page])

  // One history entry for the whole journey. Further hits replace that entry.
  const beginQuickVisit = useCallback(() => {
    if (window.history.state?.quickJourney) return
    const origin = capturedQuick.current
    if (!origin) return
    window.history.replaceState({ ...window.history.state, quickReadingOrigin: origin }, '', origin.href)
    window.history.pushState({ ...window.history.state, quickReadingOrigin: null, quickJourney: origin }, '', origin.href)
    setQuickOrigin(origin)
  }, [])
  const returnFromQuick = useCallback(() => window.history.back(), [])
  const writeReadingVerse = useCallback((address: VerseAddress, quick = false) => {
    if (quick) beginQuickVisit()
    writeVerseAddress(address, quick)
  }, [beginQuickVisit])
  const writePageDestination = useCallback((p: number, quick = false) => {
    if (quick) beginQuickVisit()
    if (mode !== 'mushaf') return
    const url = readingUrl(window.location.href, 'mushaf', surah, p, NATIVE)
    if (url.href !== window.location.href) window.history[quick ? 'replaceState' : 'pushState'](window.history.state, '', url)
  }, [beginQuickVisit, mode, surah])

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
    if (entering) setQuickOrigin(null)
    window.history[entering ? 'pushState' : 'replaceState'](entering ? { ...window.history.state, quranSearchEntry: true, quickJourney: null, quickReadingOrigin: null } : window.history.state, '', href)
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
      quickVisitRevision.current++
      const current = window.location.href
      const origin = window.history.state?.quickReadingOrigin as QuickOrigin | undefined
      const journey = window.history.state?.quickJourney as QuickOrigin | undefined
      setQuickOrigin(journey ?? null)
      if (origin && !journey && origin.href === current) {
        capturedQuick.current = null
        latest.current.onQuickReturn()
        setMode(origin.mode); setSurah(origin.surah); requestMushafPage(origin.page)
        setRestoringQuick(origin)
        return
      }
      const route = readingRoute(current)
      if (route?.kind === 'search') {
        latest.current.onSearch(route.state, lastSearchUrl.current === current)
        return
      }
      if (route?.kind === 'verse') {
        setMode('flow')
        setSurah(route.address.s)
        latest.current.onVerse(route.address)
        return
      }
      latest.current.onReading()
      if (route?.kind === 'surah') { setMode('flow'); setSurah(route.s) }
      else if (route?.kind === 'page') { setMode('mushaf'); requestMushafPage(route.p) }
    }
    restore()
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [requestMushafPage])

  // Wait for the original surface/anchor to mount; restore its visual offset,
  // not just its URL. Font loading and toolbar height can change the geometry.
  useEffect(() => {
    if (!restoringQuick) return
    let frame = 0, cancelled = false
    const deadline = performance.now() + 10000
    const restore = () => {
      if (cancelled) return
      const scroll = reader.current?.querySelector<HTMLElement>('[data-reading-scroll]')
      const { s, a, pos } = restoringQuick.address
      const word = scroll?.querySelector<HTMLElement>(`[data-surah="${s}"][data-ayah="${a}"][data-pos="${pos}"]`)
      if (scroll && word) {
        scroll.scrollTop += word.getBoundingClientRect().top - scroll.getBoundingClientRect().top - restoringQuick.offset
        setRestoringQuick(null)
      } else if (performance.now() < deadline) frame = requestAnimationFrame(restore)
      else setRestoringQuick(null)
    }
    document.fonts.ready.then(() => { if (!cancelled) frame = requestAnimationFrame(() => { frame = requestAnimationFrame(restore) }) })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [restoringQuick, reader])

  // The URL is the canonical reading location: keep it in step with the route,
  // except while advanced search owns it.
  useEffect(() => {
    writeStored('mushaf.page', page)
    const url = readingLocation(window.location.href, mode, surah, page, NATIVE)
    if (url) window.history.replaceState(window.history.state, '', url.toString())
  }, [page, mode, surah])
  useEffect(() => { writeStored('mushaf.mode', mode) }, [mode])
  useEffect(() => { writeStored('mushaf.surah', surah) }, [surah])

  return { page, setPage, mode, setMode, surah, setSurah, requestMushafPage, mushafNavigationRevision, writeSearchState, leaveSearch, quickOrigin, captureQuickOrigin, prepareQuickVisit, writeReadingVerse, writePageDestination, returnFromQuick }
}
