'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { readingUrl, readVerseAddress, reportReadingAddress, writeVerseAddress, type VerseAddress } from '@/lib/verse-link'
import { readSearchLink, SEARCH_AND_GO_PHASE_2, type SearchLinkState, type SearchResultPosition, type SearchResultSnapshot } from '@/lib/search-link'
import { readStored, writeStored } from '@/lib/reader-storage'
import { captureReadingAnchor } from '@/lib/reading-visibility'
import { readSurahPosition, rememberSurahPosition, SURAH_POSITIONS_KEY } from '@/lib/surah-position'
import { initialReading, readingLocation, readingRoute, searchEntry, searchExit, searchAndGoReadingUrl, type ReadingJump, type ReadingMode } from '@/lib/reading-route'

const clampPage = (value: number) => Math.min(604, Math.max(1, value))
const NATIVE = process.env.NEXT_PUBLIC_DESKTOP === '1'
type ReadingSnapshot = { href: string; mode: ReadingMode; surah: number; page: number; address: VerseAddress; offset: number; activeSurah?: number }
type SearchAndGoArrival = { href: string; mode: ReadingMode; jump: ReadingJump; result?: SearchResultSnapshot }
type SearchAndGoJourney = { id: string; result: SearchResultSnapshot }
const dismissedJourneyKey = (id: string) => `mushaf.search-and-go-dismissed.${id}`

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
  onSearch: (state: SearchLinkState, sameEntry: boolean, unified?: SearchResultSnapshot) => void
  /** The location addresses a verse; the caller reveals it once loaded. */
  onVerse: (address: VerseAddress, align?: 'start', isCurrent?: () => boolean) => void
  /** The location is a surah or page: the caller drops transient selection state. */
  onReading: () => void
  onQuickReturn: () => void
  onSearchAndGoOpen: (open: boolean) => void
  onSearchAndGoReturn: (activeSurah?: number, result?: SearchResultSnapshot) => void
  onSearchAndGoContext: (result?: SearchResultSnapshot) => void
  dismissSearchAndGoKeyboard: () => boolean
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
export function useReadingRoute(handlers: ReadingRouteHandlers, reader: React.RefObject<HTMLElement | null>, searchAndGoEnabled = false) {
  // The popstate listener is registered once, so it reads the newest handlers
  // from a ref rather than re-subscribing on every render.
  const latest = useRef(handlers)
  useEffect(() => { latest.current = handlers })

  const [initial] = useState(() =>
    initialReading(
      { page: readStored('mushaf.page', 1), mode: 'flow', surah: readStored('mushaf.surah', 1) },
      typeof window === 'undefined' ? null : window.location,
    ),
  )
  const [page, setPage] = useState(initial.page)
  const [mode, setMode] = useState<ReadingMode>(initial.mode)
  const [surah, setSurah] = useState(initial.surah)
  const rememberReadingPosition = useCallback(() => {
    if (!searchAndGoEnabled) return
    const arrival = window.history.state?.searchAndGoArrival as SearchAndGoArrival | undefined
    const address = arrival?.href === window.location.href && arrival.jump.kind === 'verse'
      ? arrival.jump.address
      : readVerseAddress(window.location.search, window.location.pathname) ?? undefined
    const anchor = captureReadingAnchor(reader.current, address, mode === 'mushaf' && !!address)
    if (!anchor || (mode === 'flow' && anchor.address.s !== surah)
      || (mode === 'mushaf' && !anchor.page)) return
    const stored = readStored<unknown>(SURAH_POSITIONS_KEY, {})
    const next = rememberSurahPosition(stored, { ...anchor.address, mode })
    if (stored !== next) writeStored(SURAH_POSITIONS_KEY, next)
  }, [reader, mode, surah, searchAndGoEnabled])

  useEffect(() => {
    if (!searchAndGoEnabled) return
    let lastScroll: ReturnType<typeof setTimeout> | undefined
    const onScroll = (event: Event) => {
      const element = event.target
      if (!(element instanceof HTMLElement) || !element.matches('[data-reading-scroll]') || !reader.current?.contains(element)) return
      clearTimeout(lastScroll)
      lastScroll = setTimeout(rememberReadingPosition, 200)
    }
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('pagehide', rememberReadingPosition)
    return () => {
      clearTimeout(lastScroll)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('pagehide', rememberReadingPosition)
    }
  }, [reader, rememberReadingPosition, searchAndGoEnabled])

  const lastSurahPosition = (s: number, verseCount: number) =>
    readSurahPosition(readStored<unknown>(SURAH_POSITIONS_KEY, {}), s, verseCount)

  const [mushafNavigationRevision, setMushafNavigationRevision] = useState(0)
  const [quickOrigin, setQuickOrigin] = useState<ReadingSnapshot | null>(null)
  const [restoringReading, setRestoringReading] = useState<ReadingSnapshot | null>(null)
  const searchAndGoHref = useRef<string | null>(null)
  const closingSearchAndGo = useRef(false)
  const searchAndGoRevision = useRef(0)
  const dismissedJourneys = useRef(new Set<string>())
  const activeJourney = useCallback((journey: SearchAndGoJourney | null | undefined) => {
    if (!journey || dismissedJourneys.current.has(journey.id)) return undefined
    try {
      if (sessionStorage.getItem(dismissedJourneyKey(journey.id))) return undefined
    } catch { /* In-memory dismissal still applies. */ }
    return journey
  }, [])
  const openSearchAndGo = useCallback((activeSurah: number) => {
    const href = window.location.href
    const state = window.history.state
    if (state?.searchAndGoOverlay) return
    const anchor = captureReadingAnchor(reader.current)
    const origin: ReadingSnapshot | null = anchor ? {
      href, mode, surah, page: anchor.page ?? page, address: anchor.address, offset: anchor.offset, activeSurah,
    } : null
    window.history.replaceState({ ...state, searchAndGoOrigin: origin }, '', href)
    window.history.pushState({
      ...state, searchAndGoOverlay: true, searchAndGoOrigin: null, searchAndGoArrival: null,
      quickJourney: null, quickReadingOrigin: null, quranSearchEntry: null, unifiedSearchPosition: null, unifiedSearchSnapshot: null,
    }, '', href)
    searchAndGoHref.current = href
    searchAndGoRevision.current++
  }, [mode, page, reader, surah])
  const closeSearchAndGo = useCallback(() => {
    const state = window.history.state
    const current = window.location.href
    const phase2Search = SEARCH_AND_GO_PHASE_2 && readSearchLink(current)
    if ((!state?.searchAndGoOverlay && !state?.unifiedSearchPosition && !phase2Search) || closingSearchAndGo.current) return
    if (phase2Search && !state?.quranSearchEntry) {
      searchAndGoRevision.current++
      const fallback = readingUrl(new URL('/', current).href, mode, surah, page, NATIVE)
      window.history.replaceState({ ...state, unifiedSearchPosition: null, unifiedSearchSnapshot: null }, '', fallback)
      latest.current.onSearchAndGoOpen(false)
      return
    }
    closingSearchAndGo.current = true
    searchAndGoRevision.current++
    window.history.back()
  }, [mode, page, surah])
  const prepareSearchAndGoDestination = useCallback(() => {
    const revision = ++searchAndGoRevision.current
    return (jump: ReadingJump) => {
      const state = window.history.state
      if (revision !== searchAndGoRevision.current || (!state?.searchAndGoOverlay && !state?.unifiedSearchPosition
        && !(SEARCH_AND_GO_PHASE_2 && readSearchLink(window.location.href)))) return false
      const href = searchAndGoReadingUrl(window.location.href, mode, jump, NATIVE).href
      window.history.replaceState({
        ...state, searchAndGoOverlay: false, quranSearchEntry: null, unifiedSearchPosition: null, unifiedSearchSnapshot: null,
        searchAndGoArrival: { href, mode, jump },
      }, '', href)
      if (jump.kind === 'verse') reportReadingAddress(jump.address)
      searchAndGoHref.current = null
      setQuickOrigin(null)
      return true
    }
  }, [mode])

  const capturedQuick = useRef<ReadingSnapshot | null>(null)
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

  const requestMushafPage = useCallback((p: number) => {
    setPage(clampPage(p))
    setMushafNavigationRevision(n => n + 1)
  }, [])

  const writeSearchState = useCallback((state: SearchLinkState, unifiedSearchPosition?: SearchResultPosition, snapshot?: SearchResultSnapshot) => {
    const current = window.location.href
    const { href, entering } = searchEntry(current, state, NATIVE)
    if (entering) readingBeforeSearch.current = current
    lastSearchUrl.current = href
    if (href === current && !unifiedSearchPosition) return
    const prior = window.history.state
    const fromSearchAndGo = entering && prior?.searchAndGoOverlay
    if (entering) setQuickOrigin(null)
    if (fromSearchAndGo) {
      searchAndGoHref.current = null
      searchAndGoRevision.current++
    }
    window.history[entering && !fromSearchAndGo ? 'pushState' : 'replaceState'](entering ? {
      ...prior, quranSearchEntry: true, quickJourney: null, quickReadingOrigin: null,
      searchAndGoOverlay: false, unifiedSearchPosition: unifiedSearchPosition ?? null, unifiedSearchSnapshot: snapshot ?? null,
    } : { ...prior, unifiedSearchPosition: unifiedSearchPosition ?? null, unifiedSearchSnapshot: snapshot ?? null }, '', href)
  }, [])

  const openSearchAndGoWithState = useCallback((activeSurah: number, snapshot: SearchResultSnapshot) => {
    if (!readSearchLink(window.location.href)) openSearchAndGo(activeSurah)
    if (snapshot.state) writeSearchState(snapshot.state, snapshot.position, snapshot)
  }, [openSearchAndGo, writeSearchState])

  const updateSearchAndGoState = useCallback((state: SearchLinkState) => {
    if (readSearchLink(window.location.href)) writeSearchState(state)
  }, [writeSearchState])

  const prepareSearchAndGoResult = useCallback((searchState: SearchLinkState, position: SearchResultPosition) => {
    const revision = ++searchAndGoRevision.current
    return (jump: ReadingJump) => {
      const state = window.history.state
      if (revision !== searchAndGoRevision.current || (!state?.searchAndGoOverlay && !state?.unifiedSearchPosition
        && !(SEARCH_AND_GO_PHASE_2 && readSearchLink(window.location.href)))) return false
      const result: SearchResultSnapshot = SEARCH_AND_GO_PHASE_2
        ? { query: searchState.query, position, state: searchState, selected: jump.kind === 'verse' ? jump.address : undefined }
        : { query: searchState.query, position }
      const previousJourney = state?.unifiedSearchSnapshot?.selected ? activeJourney(state.searchAndGoJourney) : undefined
      const searchAndGoJourney: SearchAndGoJourney | null = SEARCH_AND_GO_PHASE_2
        ? { id: previousJourney?.id ?? `${Date.now()}-${revision}-${Math.random()}`, result }
        : null
      writeSearchState(searchState, position, SEARCH_AND_GO_PHASE_2 ? result : undefined)
      const href = searchAndGoReadingUrl(window.location.href, mode, jump, NATIVE).href
      const arrival: SearchAndGoArrival = { href, mode, jump, result }
      if (searchAndGoJourney) window.history.replaceState({ ...window.history.state, searchAndGoJourney }, '', window.location.href)
      window.history.pushState({
        ...window.history.state, quranSearchEntry: null, unifiedSearchPosition: null, unifiedSearchSnapshot: null, searchAndGoArrival: arrival,
      }, '', href)
      if (jump.kind === 'verse') reportReadingAddress(jump.address)
      return true
    }
  }, [mode, writeSearchState, activeJourney])

  const returnToSearchAndGoResult = useCallback(() => {
    const state = window.history.state
    const arrival = state?.searchAndGoArrival as SearchAndGoArrival | undefined
    if (!arrival?.result || arrival.href !== window.location.href) return false
    if (SEARCH_AND_GO_PHASE_2 && !activeJourney(state?.searchAndGoJourney)) return false
    window.history.back()
    return true
  }, [activeJourney])

  const dismissSearchAndGoResult = useCallback(() => {
    const state = window.history.state
    if (SEARCH_AND_GO_PHASE_2) {
      const journey = activeJourney(state?.searchAndGoJourney)
      if (!journey) return
      dismissedJourneys.current.add(journey.id)
      try { sessionStorage.setItem(dismissedJourneyKey(journey.id), '1') } catch { /* In-memory dismissal still applies. */ }
      return
    }
    const arrival = state?.searchAndGoArrival as SearchAndGoArrival | undefined
    if (arrival?.result) window.history.replaceState({ ...state, searchAndGoArrival: { ...arrival, result: undefined } }, '', window.location.href)
  }, [activeJourney])

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
    const restore = (event?: PopStateEvent) => {
      quickVisitRevision.current++
      const revision = ++searchAndGoRevision.current
      const current = window.location.href
      const state = window.history.state
      const route = readingRoute(current)
      if (SEARCH_AND_GO_PHASE_2 && route?.kind !== 'search') latest.current.onSearchAndGoContext(activeJourney(state?.searchAndGoJourney)?.result)
      if (event && searchAndGoEnabled) setRestoringReading(null)
      if (searchAndGoEnabled) {
        const leavingOverlay = searchAndGoHref.current === current && !state?.searchAndGoOverlay
        const closing = closingSearchAndGo.current
        closingSearchAndGo.current = false
        if (leavingOverlay && !closing && latest.current.dismissSearchAndGoKeyboard()) {
          window.history.forward()
          return
        }
        searchAndGoHref.current = state?.searchAndGoOverlay ? current : null
        latest.current.onSearchAndGoOpen(!!state?.searchAndGoOverlay)
        if (event && (leavingOverlay || state?.searchAndGoOverlay)) return

        const origin = state?.searchAndGoOrigin as ReadingSnapshot | null
        const arrival = state?.searchAndGoArrival as SearchAndGoArrival | null
        if (origin?.href === current && event) {
          setQuickOrigin(state.quickJourney ?? null)
          latest.current.onSearchAndGoReturn(origin.activeSurah, arrival?.href === current ? arrival.result : undefined)
          setMode(origin.mode)
          setSurah(origin.surah)
          requestMushafPage(origin.page)
          setRestoringReading(origin)
          return
        }
        if (arrival?.href === current) {
          setQuickOrigin(null)
          latest.current.onSearchAndGoReturn(undefined, arrival.result)
          setMode(arrival.mode)
          const { jump } = arrival
          if (arrival.mode === 'mushaf') requestMushafPage(jump.page)
          if (jump.kind === 'verse') {
            if (arrival.mode === 'flow') setSurah(jump.address.s)
            latest.current.onVerse(jump.address, 'start', () => revision === searchAndGoRevision.current)
          }
          return
        }
      }
      const origin = window.history.state?.quickReadingOrigin as ReadingSnapshot | undefined
      const journey = window.history.state?.quickJourney as ReadingSnapshot | undefined
      setQuickOrigin(journey ?? null)
      if (origin && !journey && origin.href === current) {
        capturedQuick.current = null
        latest.current.onQuickReturn()
        setMode(origin.mode); setSurah(origin.surah); requestMushafPage(origin.page)
        setRestoringReading(origin)
        return
      }
      if (route?.kind === 'search') {
        const position = state?.unifiedSearchPosition as SearchResultPosition | undefined
        const snapshot: SearchResultSnapshot | undefined = SEARCH_AND_GO_PHASE_2
          ? { ...state?.unifiedSearchSnapshot, query: route.state.query, position: position ?? { scrollTop: 0, visible: 20 }, state: route.state }
          : searchAndGoEnabled && position ? { query: route.state.query, position } : undefined
        latest.current.onSearch(route.state, lastSearchUrl.current === current, snapshot)
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
  }, [requestMushafPage, searchAndGoEnabled, activeJourney])

  // Wait for the original surface/anchor to mount; restore its visual offset,
  // not just its URL. Font loading and toolbar height can change the geometry.
  useEffect(() => {
    if (!restoringReading) return
    let frame = 0, cancelled = false
    const deadline = performance.now() + 10000
    const restore = () => {
      if (cancelled) return
      const scroll = reader.current?.querySelector<HTMLElement>('[data-reading-scroll]')
      const { s, a, pos } = restoringReading.address
      const word = scroll?.querySelector<HTMLElement>(`[data-surah="${s}"][data-ayah="${a}"][data-pos="${pos}"]`)
      if (scroll && word) {
        scroll.scrollTop += word.getBoundingClientRect().top - scroll.getBoundingClientRect().top - restoringReading.offset
        setRestoringReading(null)
      } else if (performance.now() < deadline) frame = requestAnimationFrame(restore)
      else setRestoringReading(null)
    }
    document.fonts.ready.then(() => { if (!cancelled) frame = requestAnimationFrame(() => { frame = requestAnimationFrame(restore) }) })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [restoringReading, reader])

  // The URL is the canonical reading location: keep it in step with the route,
  // except while advanced search owns it.
  useEffect(() => {
    writeStored('mushaf.page', page)
    writeStored('mushaf.mode', mode)
    const url = readingLocation(window.location.href, mode, surah, page, NATIVE)
    if (url) window.history.replaceState(window.history.state, '', url.toString())
  }, [page, mode, surah])
  useEffect(() => { writeStored('mushaf.surah', surah) }, [surah])

  return { page, setPage, mode, setMode, surah, setSurah, requestMushafPage, mushafNavigationRevision, writeSearchState, leaveSearch, quickOrigin, captureQuickOrigin, prepareQuickVisit, writeReadingVerse, writePageDestination, returnFromQuick, rememberReadingPosition, lastSurahPosition, openSearchAndGo, openSearchAndGoWithState, updateSearchAndGoState, closeSearchAndGo, prepareSearchAndGoDestination, prepareSearchAndGoResult, returnToSearchAndGoResult, dismissSearchAndGoResult }
}
