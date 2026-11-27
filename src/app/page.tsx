'use client'
import {useStudyWorkspace} from '@/lib/study-store'
import {t,useUiLanguage} from '@/lib/i18n'
import {LanguageOnboarding} from '@/components/quran/LanguageSettings'
import { writeVerseAddress, readVerseAddress } from '@/lib/verse-link'
import { readStored, writeStored } from '@/lib/reader-storage'
import { clampScale, readerFontSize, rememberSurah, removeBookmark, stepScale, togglePinnedSurah } from '@/lib/reader-settings'
import { useReadingRoute } from '@/components/quran/useReadingRoute'
import { useStartupSplash } from '@/components/quran/useStartupSplash'
import { useReaderPresentation } from '@/components/quran/useReaderPresentation'
import { useComparison } from '@/components/quran/useComparison'
import { occurrenceSearchStart, useSearchNavigation } from '@/components/quran/useSearchNavigation'
import type { ReadingJump, ReadingMode } from '@/lib/reading-route'
import type { VerseAddress } from '@/lib/verse-link'
import type { Destination } from '@/lib/navigation'
import { textSearchOperation } from '@/lib/search-and-go-history'
import { initialSearchLinkState, SEARCH_AND_GO_PHASE_2, SEARCH_AND_GO_PHASE_3, type SearchLinkState, type SearchResultPosition, type SearchResultSnapshot } from '@/lib/search-link'
import type { OccurrenceScope } from '@/lib/occurrence-scope'
import { wordTarget } from '@/lib/word-parts'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { Meta, SurahData, Translations } from '@/lib/quran'
import { loadMeta, loadSurah, loadTrans, toFa } from '@/lib/quran'
import type { Selection } from '@/components/quran/MushafPage'
import ContinuousMushaf from '@/components/quran/ContinuousMushaf'
import FlowPage, { FlowSurface } from '@/components/quran/FlowPage'
import SurahPull from '@/components/quran/SurahPull'
import RootPanel from '@/components/quran/RootPanel'
import StartupSplash from '@/components/quran/StartupSplash'
import RecitationPlayer,{type RecitationTransportStatus} from '@/components/quran/RecitationPlayer'
import { useComparisonHold } from '@/components/quran/useComparisonHold'
import {revealReadingTarget,revealReadingVerse} from '@/lib/reading-visibility'
import CarStudySync from '@/components/quran/CarStudySync'
import { useVisibleSelection } from '@/components/quran/useVisibleSelection'
import QuranClipboard from '@/components/quran/QuranClipboard'
import NavDrawer, { type Translator } from '@/components/quran/NavDrawer'
import SettingsScreen from '@/components/quran/SettingsScreen'
import SurahIndex from '@/components/quran/SurahIndex'
import type { AnalysisSelection } from '@/lib/analysis'
import RangeComparison from '@/components/quran/RangeComparison'
import { ArrowRight, ChevronDown, X } from 'lucide-react'
import AudioToolbarButton from '@/components/quran/AudioToolbarButton'
import ReaderDisplayMenu from '@/components/quran/ReaderDisplayMenu'
import { AdvancedSearchIcon, QuickSearchIcon } from '@/components/quran/ReaderSearchIcon'
import QuranSearch, { type SearchStart } from '@/components/quran/QuranSearch'
import SearchAndGo from '@/components/quran/SearchAndGo'
import QuickSurahSearch from '@/components/quran/QuickSurahSearch'
import type { QuranSearchHighlight } from '@/lib/quran-search'
import ReaderSearchHighlights from '@/components/quran/ReaderSearchHighlights'
import {
  PatternBG,
} from '@/components/quran/Ornaments'

type CommitReadingJump = (jump: ReadingJump) => boolean

const SEARCH_AND_GO = process.env.NEXT_PUBLIC_SEARCH_AND_GO === '1'
const wideReaderQuery = '(min-width: 1024px)'
const isWideReader = () => window.matchMedia(wideReaderQuery).matches
function subscribeWideReader(notify: () => void) {
  const media = window.matchMedia(wideReaderQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export default function Home() {
  useUiLanguage()
  useStudyWorkspace()
  const [knownPersianReader]=useState(()=>readStored('mushaf.safavi-default.v1',false)&&['s','f','a','m'].includes(readStored('mushaf.tr','s')))
  const [desktopPaneWidths] = useState(() => ({ navigation: clamp(readStored('mushaf.desktop-navigation-width', 300), 240, 420), analysis: clamp(readStored('mushaf.desktop-analysis-width', 360), 280, 520) }))
  const [meta, setMeta] = useState<Meta | null>(null)
  // Presentation preferences (theme, translation, scale, bookmarks, pins) and
  // their mushaf.* persistence live in useReaderPresentation.
  const presentation = useReaderPresentation()
  const { showTrans, setShowTrans, theme, setTheme, translator, setTranslator, bookmarks, setBookmarks, pinnedSurahs, setPinnedSurahs } = presentation
  const [recentSurahs, setRecentSurahs] = useState<number[]>(() => readStored('mushaf.recent-surahs', []))
  const [drawerView, setDrawerView] = useState<'navigation' | 'tools'>('navigation')
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Browsing beside the reader does not add a search entry to reading history.
  const [navigationDockOpen, setNavigationDockOpen] = useState(false)
  const wideReader = useSyncExternalStore(subscribeWideReader, isWideReader, () => false)
  const navigationDocked = wideReader && navigationDockOpen
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [desktopSurah,setDesktopSurah]=useState<number|null>(null)
  /** The reveal a search click (or a verse deep link) asked the reader for. */
  const [searchTarget, setSearchTarget] = useState<{ s: number; a: number; pos: number; align?: 'start'; wholeVerse?: boolean } | null>(null)
  const [sel, setSel] = useState<Selection | null>(null)
  const [analysisSelection, setAnalysisSelection] = useState<AnalysisSelection | null>(null)
  const [flash, setFlash] = useState<{ s: number; a: number; pos: number } | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const [quickResultsBar, setQuickResultsBar] = useState<HTMLDivElement | null>(null)
  /**
   * The three ways a location can describe the reader. Only the route hook
   * knows a navigation happened; only this screen knows what it means for the
   * surrounding panels, so the two are joined here rather than inside the hook.
   */
  // Search UI state, and what a location change means for it. See
  // useSearchNavigation.ts for the ownership split.
  const search = useSearchNavigation({
    onReveal: useCallback((s: number, a: number, pos: number) => setSearchTarget({ s, a, pos }), []),
    onTranslator: setTranslator,
    operationMeta: SEARCH_AND_GO ? meta : null,
  })
  // Destructured so these callbacks depend on a specific function rather than
  // on the whole hook result; the compiler cannot otherwise preserve them.
  const { close: closeSearch, applyEntry: applySearchEntry, setAdvancedOpen: setAdvancedSearchOpen } = search
  // The route hook is created after the search hook because a search location
  // is applied to the search UI; the reveal it asks for is the reader's.
  const applyVerseEntry = useCallback((address: VerseAddress, align?: 'start', isCurrent?: () => boolean) => {
    closeSearch()
    setSel(null)
    if (align) setDesktopSurah(address.s)
    loadSurah(address.s).then(data => {
      if (isCurrent && !isCurrent()) return
      const verse = data.v[address.a - 1]
      if (!verse) return
      const pos = Math.min(address.pos, verse.w.length)
      setFlash({ ...address, pos })
      setSearchTarget({ ...address, pos, align, wholeVerse:pos===1 })
    })
  }, [closeSearch])
  /** A surah or page in the location: only transient selection state is dropped. */
  const clearTransientSelection = useCallback(() => { closeSearch(); setSel(null); setFlash(null) }, [closeSearch])
  const route = useReadingRoute({
    onSearch: (state, sameEntry, snapshot) => {
      setNavigationDockOpen(false)
      applySearchEntry(state, sameEntry, snapshot)
    },
    onVerse: applyVerseEntry, onReading: clearTransientSelection,
    onQuickReturn: () => { clearTransientSelection(); search.setQuickOpen(false); setSearchTarget(null) },
    onSearchAndGoOpen: open => {
      if (open) setNavigationDockOpen(false)
      search.setSearchAndGoOpen(open)
    },
    onSearchAndGoReturn: (activeSurah, result) => {
      clearTransientSelection()
      if (!SEARCH_AND_GO_PHASE_2) {
        search.setQuickOpen(false)
        search.restoreUnifiedReturn(result)
      }
      setSearchTarget(null)
      setDesktopSurah(activeSurah ?? null)
    },
    onSearchAndGoContext: search.restoreUnifiedReturn,
    dismissSearchAndGoKeyboard: search.dismissSearchAndGoKeyboard,
  }, mainRef, SEARCH_AND_GO)
  const { page, setPage, mode, setMode, surah, setSurah, requestMushafPage, mushafNavigationRevision, writeSearchState, leaveSearch, writeReadingVerse, prepareQuickVisit } = route
  const scale = presentation.scaleFor(mode)
  const { setScaleFor } = presentation
  const setScale = useCallback((value: React.SetStateAction<number>) => setScaleFor(mode, value), [mode, setScaleFor])
  /**
   * QuranSearch's close control: the panel owns its own open flag, but only the
   * route hook knows how to unwind the search URL it wrote.
   */
  const changeSearchOpen = useCallback((open: boolean) => {
    setAdvancedSearchOpen(open)
    if (!open) leaveSearch()
  }, [setAdvancedSearchOpen, leaveSearch])
  const [pageData, setPageData] = useState<Map<number, SurahData>>(new Map())
  /**
   * How a surah was arrived at: pulling backwards lands at the end of the
   * previous surah, pulling forwards at its start. It must be state, not a ref:
   * the value is read while rendering SurahPull's `arriveAtEnd`.
   */
  const [pullArrival, setPullArrival] = useState<{ s: number; end: boolean } | null>(null)
  const [flowSurah, setFlowSurah] = useState<SurahData | null>(null)
  /** Translations are stored with the key they were loaded for. */
  const [flowTransState, setFlowTransState] = useState<{ key: string; data: Translations } | null>(null)
  const [loadingPage, setLoadingPage] = useState(true)
  const segs = useMemo(() => (meta ? meta.pages[page - 1] || [] : []), [meta, page])
  // The splash starts leaving as soon as the first screen is really ready; a
  // reader holding it pauses that departure. Both live in useStartupSplash.
  const startupReady = !!meta && !loadingPage &&
    (mode === 'flow' ? flowSurah?.n === surah : segs.every(seg => pageData.has(seg.s)))
  const splash = useStartupSplash(startupReady)
  const { complete: startupComplete, leaving: startupLeaving, setHeld: setStartupHeld } = splash
  const [mushafContentRevision, setMushafContentRevision] = useState(0)
  const onMushafContentReady = useCallback(() => setMushafContentRevision(n => n + 1), [])
  const [audioOpen, setAudioOpen] = useState(false)
  const [audioControlsVisible,setAudioControlsVisible]=useState(true)
  const [audioStatus,setAudioStatus]=useState<RecitationTransportStatus>('idle')
  const [audioPlayRequest,setAudioPlayRequest]=useState(0)
  const [audioPauseRequest,setAudioPauseRequest]=useState(0)
  const [audioVerse, setAudioVerse] = useState<{s:number;a:number}|null>(null)
  const [playbackTarget, setPlaybackTarget] = useState<{s:number;a:number}|null>(null)
  const [panelMax, setPanelMax] = useState(false)
  const [sheetH, setSheetH] = useState(46)
  const [showIndex, setShowIndex] = useState(false)
  // Range comparison is one owned piece of state; see useComparison.ts.
  const comparison = useComparison({ selected: !!sel, analysisSelection })
  const {
    show: showComparison, context: contextComparison, surah: comparisonSurah, range: comparisonRange,
    roots: comparisonRoots, pickedRoot: comparisonRoot, muted: mutedComparisonRoots,
    visibility: comparisonVisibility,
    // Destructured for the same reason as the search callbacks: a callback
    // depending on one function is preservable, one depending on the whole
    // hook result is not.
    startContext: compareContext, followContext: followComparisonContext, solo: soloComparisonRoot,
    setPickedRoot: setComparisonRoot, toggleRoot: toggleComparisonRoot,
  } = comparison

  /** The analysis panel reports its selection here; a context comparison follows it. */
  const onAnalysisSelection = useCallback((selection: AnalysisSelection) => {
    setAnalysisSelection(selection)
    followComparisonContext(selection)
  }, [followComparisonContext])

  useEffect(()=>{
    const app=mainRef.current?.closest<HTMLElement>('.reader-app'),header=app?.querySelector<HTMLElement>('.reader-toolbar')
    if(!app||!header)return
    const measure=()=>{const height=`${header.getBoundingClientRect().height}px`;app.style.setProperty('--reader-toolbar-height',height);document.documentElement.style.setProperty('--reader-toolbar-height',height)}
    const observer=new ResizeObserver(measure);observer.observe(header);measure()
    return()=>{observer.disconnect();app.style.removeProperty('--reader-toolbar-height');document.documentElement.style.removeProperty('--reader-toolbar-height')}
  },[!!meta])
  const followingVerse=!!(audioOpen&&audioVerse&&flash?.s===audioVerse.s&&flash?.a===audioVerse.a)
  useVisibleSelection(mainRef, flash ?? analysisSelection ?? sel, (!!sel||followingVerse) && !panelMax && !showIndex && !showComparison, `${mode}:${page}:${surah}:${showTrans}:${loadingPage}:${mushafContentRevision}:${!!sel}:${audioOpen}:${audioControlsVisible}`, followingVerse||analysisSelection?.tab==='verse'||analysisSelection?.tab==='context')
  const focusComparisonRoot = useCallback((root: string) => { soloComparisonRoot(root); setSel(null) }, [soloComparisonRoot])
  useComparisonHold(mainRef, !!comparisonRange && Object.keys(comparisonRoots).length > 0 && !showComparison && !showIndex, focusComparisonRoot)
  const pinchRef = useRef<{ d: number; s: number } | null>(null)

  useEffect(() => { loadMeta().then(setMeta).catch(() => { /* Splash offers retry. */ }) }, [])
  // The splash and the theme share the theme-color meta tag: the splash's
  // paper tone while it is up, the reading theme's paper once it is gone.
  useEffect(() => {
    const color = !startupComplete ? '#faf4df' : getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }, [theme, startupComplete])

  const curSurahN = mode === 'mushaf' ? (desktopSurah&&segs.some(segment=>segment.s===desktopSurah)?desktopSurah:segs[0]?.s??1) : surah
  useEffect(() => {
    if (!meta || loadingPage) return
    setRecentSurahs(previous => { const next = rememberSurah(previous, curSurahN); writeStored('mushaf.recent-surahs', next); return next })
  }, [curSurahN, meta, loadingPage])

  // The maximized flag follows the selection lifecycle without an effect:
  // when the selection closes — however it closes (close button, word
  // toggle, backdrop, navigation) — reset it here, during render. Retargeting
  // while the panel stays open deliberately keeps it maximized.
  const [selectionOpen, setSelectionOpen] = useState(false)
  if (!!sel !== selectionOpen) {
    setSelectionOpen(!!sel)
    if (!sel) setPanelMax(false)
  }

  // mushaf mode: load surahs of current page
  useEffect(() => {
    if (!meta || mode !== 'mushaf') return
    let live = true
    setLoadingPage(true)
    Promise.all(segs.map(sg => loadSurah(sg.s))).then(datas => {
      if (!live) return
      setPageData(new Map(datas.map(d => [d.n, d])))
      setLoadingPage(false)
    })
    return () => { live = false }
  }, [meta, page, segs, mode])

  // Quran navigation stays independent of translation downloads and failures.
  useEffect(() => {
    if (mode !== 'flow' || flowSurah?.n === surah) return
    let live=true
    setLoadingPage(true)
    loadSurah(surah).then(data=>{
      if(!live)return
      setFlowSurah(data);setLoadingPage(false)
      const pg=data.v[0]?.p
      if(pg)setPage(pg)
    }).catch(()=>{if(live)setLoadingPage(false)})
    return()=>{live=false}
  },[mode,surah])
  const flowTransKey = `${surah}:${translator}`
  // A translation belongs to the surah and translator it was loaded for: until
  // that one arrives, the reader shows none. Storing the key alongside the
  // translations makes the "clear it first" step a derivation instead of a
  // setState at the top of the loading effect.
  const flowTrans = flowTransState?.key === flowTransKey ? flowTransState.data : null
  useEffect(()=>{
    if(mode!=='flow')return
    let live=true
    loadTrans(surah,translator)
      .then(data=>{if(live)setFlowTransState({key:flowTransKey,data})})
      .catch(()=>{if(live)setFlowTransState({key:flowTransKey,data:{}})})
    return()=>{live=false}
  },[mode,surah,translator,flowTransKey])

  // flash cleanup
  useEffect(() => {
    if (!flash || search.quickOpen) return
    const t = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(t)
  }, [flash, search.quickOpen])

  // ctrl+wheel zoom on main area
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const h = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setScale(s => stepScale(s, e.deltaY))
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [meta, setScale])

  const goPage = useCallback((p: number, commit?: CommitReadingJump) => {
    const destination = clamp(p, 1, 604)
    if (mode === 'flow') {
      const first = meta?.pages[destination - 1]?.[0]
      if (!first) return
      const target = { s: first.s, a: first.f, pos: 1 }
      setPullArrival(null)
      if (commit) {
        if (!commit({ kind: 'verse', address: target, page: destination })) return
      } else writeVerseAddress(target)
      setSurah(first.s)
      setFlash(target)
      setSearchTarget({ ...target, align: 'start', wholeVerse:true })
    } else {
      if (commit && !commit({ kind: 'page', page: destination })) return
      requestMushafPage(destination)
    }
    setSel(null)
    setComparisonRoot(null)
  }, [mode, meta, requestMushafPage, setComparisonRoot, setSurah, setPullArrival, setFlash, setSearchTarget, setSel])

  const tapWord = useCallback((word: Selection) => {
    setPlaybackTarget(null)
    if (!showComparison && !showIndex && comparisonRange?.s === word.s && word.root && comparisonRoots[word.root] !== undefined) {
      toggleComparisonRoot(word.root)
      setSel(null)
      return
    }
    writeVerseAddress(word)
    setFlash(null)
    setComparisonRoot(null)
    setSel(current => current?.s === word.s && current.a === word.a && current.pos === word.pos && (current.part ?? 'stem') === (word.part ?? 'stem') ? null : word)
  }, [comparisonRange, comparisonRoots, showComparison, showIndex, toggleComparisonRoot, setComparisonRoot, setPlaybackTarget, setSel, setFlash])

  const goSurah = useCallback((n: number) => {
    setPullArrival(null)
    const nn = clamp(n, 1, 114)
    if (!meta) return
    if (mode === 'mushaf') goPage(meta.surahs[nn - 1].pg)
    else setSurah(nn)
  }, [meta, mode, goPage, setSurah, setPullArrival])

  const requestMushafVerse = useCallback((p:number,s:number,a:number,pos:number)=>{
    const mounted=mainRef.current?.querySelector(`[data-reading-scroll] [data-surah="${s}"][data-ayah="${a}"][data-pos="${pos}"]`)
    if(!mounted)requestMushafPage(p)
  },[requestMushafPage])

  // Reveal a verse on whichever surface is active: mushaf scrolls to its page
  // (unless already mounted), flow switches surah. Shared by goVerse,
  // panelJump and jumpSurahRoot, which otherwise differ in what else they do
  // (write the URL, set flash, retarget the analysis panel, ...).
  const revealVerse = useCallback((s: number, a: number, pos: number, p: number) => {
    if (mode === 'mushaf') requestMushafVerse(p, s, a, pos)
    else setSurah(s)
  }, [mode, requestMushafVerse, setSurah])

  const goVerse = useCallback((s: number, a: number, pos = 1, align?: 'start', wholeVerse = true, quick = false, commit?: CommitReadingJump) => {
    setPullArrival(null)
    const isCurrent = quick ? prepareQuickVisit() : () => true
    loadSurah(s).then(d => {
      if (!isCurrent()) return
      const v = d.v[a - 1]
      if (v) {
        pos = Math.min(pos, v.w.length)
        if (commit && !commit({ kind: 'verse', address: { s, a, pos }, page: v.p })) return
        revealVerse(s, a, pos, v.p)
        if (!commit) writeReadingVerse({ s, a, pos }, quick)
        setFlash({ s, a, pos })
        setSearchTarget({ s, a, pos, align, wholeVerse })
      }
    })
  }, [revealVerse, writeReadingVerse, prepareQuickVisit, setPullArrival, setFlash, setSearchTarget])

  const navigateDestination = (destination: Destination, quick = false) => {
    search.leaveForReading();setSel(null)
    if(destination.kind==='page') {
      goPage(destination.p, jump => {
        if (jump.kind === 'verse') route.writeReadingVerse(jump.address, quick)
        else route.writePageDestination(jump.page, quick)
        return true
      })
    }
    else goVerse(destination.s,destination.kind==='surah'?1:destination.kind==='context'?destination.from:destination.a,1,'start',true,quick)
  }

  const openUnifiedSearch = (state: SearchLinkState, snapshot?: SearchResultSnapshot) => {
    setNavigationDockOpen(false)
    const start = snapshot ?? { query: state.query, position: { scrollTop: 0, visible: 20 }, state }
    route.rememberReadingPosition()
    route.openSearchAndGoWithState(curSurahN, start)
    search.showUnified(start)
  }

  const openAdvancedSearch = (start?: Omit<SearchStart, 'revision'>) => {
    if (SEARCH_AND_GO_PHASE_2) openUnifiedSearch(initialSearchLinkState(translator, start))
    else if (start) search.advance(start)
    else search.openAdvanced()
  }

  const openOccurrences = (selection: AnalysisSelection, scope: OccurrenceScope) => {
    if (!SEARCH_AND_GO_PHASE_2) { search.startOccurrence(selection, scope); return }
    const start = occurrenceSearchStart(selection, scope)
    if (start) openUnifiedSearch(initialSearchLinkState(translator, start, selection))
  }

  const pickSearchResult = (s: number, a: number, pos: number, state: SearchLinkState, position?: SearchResultPosition, highlight?: QuranSearchHighlight) => {
    const enterReading = (selected?: VerseAddress) => {
      const operation = SEARCH_AND_GO ? textSearchOperation(state, SEARCH_AND_GO_PHASE_2) : null
      if (operation) search.recordOperation(operation)
      const snapshot = position ? { query: state.query, position, ...(SEARCH_AND_GO_PHASE_2 ? { state, selected, highlight } : {}) } : null
      search.pick(s, a, selected?.pos ?? pos, snapshot, state.query || state.occurrence?.text)
      setSel(null)
      setComparisonRoot(null)
    }
    if (position) {
      const writeResult = route.prepareSearchAndGoResult(state, position, highlight)
      goVerse(s, a, pos, undefined, false, false, jump => {
        if (!writeResult(jump)) return false
        search.setSearchAndGoOpen(false)
        setDesktopSurah(s)
        enterReading(jump.kind === 'verse' ? jump.address : undefined)
        return true
      })
    } else {
      enterReading()
      goVerse(s, a, pos, undefined, false)
    }
  }

  const closeUnifiedPanel = () => {
    if (navigationDockOpen) {
      route.preserveReadingAnchor()
      setNavigationDockOpen(false)
    } else route.closeSearchAndGo()
  }

  const activateNavigationDock = () => {
    route.openSearchAndGo(curSurahN)
    setNavigationDockOpen(false)
    search.setSearchAndGoOpen(true)
  }

  const navigateFromSearchAndGo = (destination: Destination, word?: number) => {
    if (navigationDockOpen) route.openSearchAndGo(curSurahN)
    const writeDestination = route.prepareSearchAndGoDestination()
    const commit: CommitReadingJump = jump => {
      if (!writeDestination(jump)) return false
      setNavigationDockOpen(false)
      search.setSearchAndGoOpen(false)
      if (!SEARCH_AND_GO_PHASE_2) search.dismissReturn()
      setSel(null)
      setComparisonRoot(null)
      setDesktopSurah(jump.kind === 'verse' ? jump.address.s : null)
      search.recordOperation({ type: 'navigation', destination, ...(word && word > 1 ? { word } : {}) })
      return true
    }
    if (destination.kind === 'page') goPage(destination.p, commit)
    else goVerse(destination.s, destination.kind === 'surah' ? 1 : destination.kind === 'context' ? destination.from : destination.a,
      word ?? 1, 'start', !word || word === 1, false, commit)
  }

  useEffect(() => {
    if (!searchTarget || loadingPage || (mode === 'flow' && flowSurah?.n !== searchTarget.s)) return
    const main = mainRef.current
    const reading = mode === 'flow' ? main?.querySelector('.surah-pull-content') : main?.querySelector('[data-reading-scroll]')
    const word = reading?.querySelector<HTMLElement>(`[data-surah="${searchTarget.s}"][data-ayah="${searchTarget.a}"][data-pos="${searchTarget.pos}"]`)
    if (!main || !word) return
    const scroll = main.querySelector<HTMLElement>('[data-reading-scroll]') ?? main
    const frame = requestAnimationFrame(() => {
      const reveal=searchTarget.wholeVerse?revealReadingVerse:revealReadingTarget
      reveal(scroll,word,searchTarget.align === 'start' || search.quickOpen || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth')
      setSearchTarget(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [searchTarget, search.quickOpen, loadingPage, mode, page, surah, flowSurah?.n, pageData, mushafContentRevision])

  // panel jump: keep panel open, highlight target
  const panelJump = useCallback((s: number, a: number, pos: number, p: number) => {
    writeVerseAddress({ s, a, pos })
    revealVerse(s, a, pos, p)
    setFlash({ s, a, pos })
  }, [revealVerse])

  // jump to root occurrence in another surah; retarget panel selection
  const jumpSurahRoot = useCallback((surahN: number, root: string) => {
    loadSurah(surahN).then(d => {
      const occ = d.ri[root]
      if (!occ || occ.length === 0) return
      const [a, pos] = occ[0]
      const w = d.v[a - 1]?.w[pos - 1]
      if (!w) return
      setSel({ s: surahN, a, pos, ...wordTarget(w), root })
      revealVerse(surahN, a, pos, d.v[a - 1].p)
      setFlash({ s: surahN, a, pos })
    })
  }, [revealVerse])

  // SurahIndex: pick a root from the index page → open RootPanel for first occurrence
  // NOTE: the index STAYS OPEN — user wants to return to the same scroll position
  // after closing the panel. The RootPanel renders at a higher z-index than the
  // drawer so it overlays the index.
  const pickRootFromIndex = useCallback((root: string, sourceSurah?: number) => {
    // curSurahN is already "the surah on screen" in both modes (page's first
    // surah in mushaf, the reading surah in flow).
    const targetSurah = sourceSurah ?? curSurahN
    loadSurah(targetSurah).then(d => {
      const occ = d.ri[root]
      if (!occ || occ.length === 0) return
      const [a, pos] = occ[0]
      const w = d.v[a - 1]?.w[pos - 1]
      if (!w) return
      setSel({ s: targetSurah, a, pos, ...wordTarget(w), root })
      // deliberately NOT calling setShowIndex(false) — index stays open
      setFlash({ s: targetSurah, a, pos })
    })
  }, [curSurahN])

  // The sheet handles its active tab's keyboard navigation.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (search.advancedOpen || search.searchAndGoOpen || drawerOpen || showIndex || showComparison || (e.target instanceof HTMLElement && (e.target.matches('input, textarea, select') || e.target.closest('[data-search-and-go]')))) return
      if (sel||window.getSelection()?.toString()) return
      // Mushaf follows native up/down scrolling; flow retains surah shortcuts.
      if (mode !== 'flow') return
      if (e.key === 'ArrowLeft') goSurah(surah + 1)
      else if (e.key === 'ArrowRight') goSurah(surah - 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [page, surah, mode, drawerOpen, showIndex, showComparison, goPage, goSurah, sel, search.advancedOpen, search.searchAndGoOpen])

  // Pinch zoom; page reading is vertical in both display modes.
  const touchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { d: touchDist(e.touches), s: scale }
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (pinchRef.current && e.touches.length === 2) {
      const d = touchDist(e.touches)
      const ratio = d / pinchRef.current.d
      setScale(clampScale(pinchRef.current.s * ratio))
    }
  }
  const onTouchEnd = () => { pinchRef.current = null }

  const pageInfo = useMemo(() => {
    if (!meta) return { names: '', juz: null as number | null }
    // Use Arabic names (s.ar) per user request — Persian names were confusing
    const names = [...new Set(segs.map(sg => meta.surahs[sg.s - 1]?.ar))].filter(Boolean).join('، ')
    let juz: number | null = null
    for (const sg of segs) {
      const d = pageData.get(sg.s)
      const v = d?.v.find(x => x.n >= sg.f && x.p === page)
      if (v) { juz = v.j; break }
    }
    return { names, juz }
  }, [meta, segs, pageData, page])

  const flowFont = readerFontSize(scale)
  const switchMode = (m: ReadingMode) => {
    if (m === 'flow') setSurah(curSurahN)
    setMode(m)
  }

  // The analysis panel is defined once: when the index or comparison drawer
  // is open underneath, it rises over them through a portal; otherwise it
  // mounts inline. The props are identical either way.
  const rootPanel = sel && meta ? (
    <RootPanel
      playbackTarget={playbackTarget}
      onOpenOccurrences={openOccurrences}
      onSelectionChange={onAnalysisSelection}
      onCompareContext={compareContext}
      sel={sel}
      meta={meta}
      translator={translator}
      maximized={panelMax}
      sheetH={sheetH}
      onSheetHeightChange={setSheetH}
      onToggleMax={() => setPanelMax(v => !v)}
      onClose={() => setSel(null)}
      onJump={panelJump}
      onJumpSurah={jumpSurahRoot}
      /* When the index drawer is also open, the panel needs to sit on top of
         it — passed as a flag so the panel can bump its z-index. */
      stackedOverIndex={showIndex || showComparison}
      comparisonRange={comparisonRange}
    />
  ) : null

  const query = search.returnQuery.trim().replace(/\s+/g, ' ')
  const characters = query.length > 15 && typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter().segment(query), item => item.segment)
    : Array.from(query)
  const excerpt = characters.length > 15 ? characters.slice(0, 14).join('').trimEnd() + '…' : query
  const returnLabel = query
    ? t('quickSearch.returnToQuery', { p0: excerpt })
    : t('ui.15868c5aa7')
  const searchReturnBar = search.returnToSearch && !search.advancedOpen && !search.searchAndGoOpen && (
    <div className="reader-search-band reader-search-width reader-advanced-return" dir="rtl">
      <button type="button" className="chip" data-advanced-search-return title={search.returnQuery || undefined} onClick={() => {
        setSel(null)
        if (search.returnToUnified) {
          if (!route.returnToSearchAndGoResult()) {
            const result = search.returnToUnified
            if (SEARCH_AND_GO_PHASE_2 && result.state) openUnifiedSearch(result.state, result)
            else {
              route.openSearchAndGo(curSurahN)
              search.showUnified(result)
            }
          }
        } else search.setAdvancedOpen(true)
      }}>
        <ArrowRight size={14} aria-hidden="true" /><span>{returnLabel}</span></button>
      <button type="button" className="icon-btn reader-search-dismiss" aria-label={t("ui.4d21d96f48")} onClick={() => { route.dismissSearchAndGoResult(); search.dismissReturn() }}><X size={17} aria-hidden="true" /></button>
    </div>
  )

  return (
    <>
    {!startupComplete && <StartupSplash leaving={startupLeaving} stalled={splash.stalled} onHoldChange={setStartupHeld} />}
    {meta && <div className={`reader-app h-dvh overflow-hidden flex flex-col relative${drawerOpen || showIndex || showComparison ? ' has-overlay' : ''}`} data-search-docked={navigationDocked || undefined} inert={wideReader && SEARCH_AND_GO_PHASE_3 && search.searchAndGoOpen && !navigationDockOpen || undefined} data-side-navigation={drawerOpen||showIndex||showComparison?'open':undefined} data-portaled-analysis={sel&&(showIndex||showComparison)&&!panelMax?'open':undefined} style={{ background: 'var(--paper)', ['--desktop-navigation-width' as string]: `${desktopPaneWidths.navigation}px`, ['--desktop-analysis-width' as string]: `${desktopPaneWidths.analysis}px` }}>
      <CarStudySync reader={mainRef} revision={`${mode}:${surah}:${page}:${mushafContentRevision}:${showTrans}:${flowSurah?.n}:${loadingPage}`} />
      <PatternBG />

      <QuranSearch onNavigate={navigateDestination} key={search.start?.revision ?? 0} onStateChange={writeSearchState} initialSearch={search.start} occurrenceFilter={search.occurrence} onClearOccurrenceFilter={search.clearOccurrence} translator={translator} open={search.advancedOpen} onOpenChange={changeSearchOpen} meta={meta} currentSurah={curSurahN} onPick={(s, a, pos, state) => pickSearchResult(s, a, pos, state)} />

      {/* Desktop has explicit previous/next controls in the reading pane below. */}
      <header dir="rtl" className="reader-toolbar relative z-10 shrink-0 flex items-center gap-1 px-2 sm:px-4 border-b"
        style={{
          borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--paper) 82%, transparent)',
          backdropFilter: 'blur(8px)', paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: 'var(--reader-toolbar-spacing)',
        }}>
        {search.quickOpen ? <QuickSurahSearch meta={meta} resultsBar={quickResultsBar} onNavigate={destination => navigateDestination(destination, true)} surah={meta.surahs[curSurahN - 1]} onClose={() => search.setQuickOpen(false)}
          scope={search.quickScope} onScopeChange={search.changeQuickScope}
          onHighlights={search.setQuickHighlights}
          onPick={(s, a, pos) => { setSel(null); goVerse(s, a, pos,undefined,false,true) }}
          onAdvanced={openAdvancedSearch} /> : <>

        <button className="icon-btn" onClick={() => { setNavigationDockOpen(false); setDrawerView('tools'); setDrawerOpen(true) }} aria-label={t("ui.b563f0690c")} title={t("ui.b563f0690c")}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 5h18M3 12h18M3 19h18" /></svg></button>
        <button className="reader-surah-link" title={t("searchAndGo.tooltip")} aria-label={t("ui.450d6bd970")} aria-haspopup="dialog" aria-expanded={SEARCH_AND_GO ? search.searchAndGoOpen || navigationDockOpen : drawerOpen && drawerView === 'navigation'} onClick={() => {
          if (!SEARCH_AND_GO) { setDrawerView('navigation'); setDrawerOpen(true); return }
          if (navigationDockOpen) { closeUnifiedPanel(); return }
          route.rememberReadingPosition()
          setDrawerOpen(false)
          if (wideReader && SEARCH_AND_GO_PHASE_3) {
            route.preserveReadingAnchor()
            search.showUnified(null, false)
            setNavigationDockOpen(true)
          } else {
            route.openSearchAndGo(curSurahN)
            search.showUnified()
          }
        }}>
          <AdvancedSearchIcon />
          <span className="reader-surah-name font-bold text-[14px] sm:text-[15px]" style={{ color: 'var(--ink)' }}>
            <span className="reader-surah-name-sizer" aria-hidden="true">{meta.surahs.map(item=><span key={item.n}>{item.ar}</span>)}</span>
            <span className="reader-surah-current">
            {mode === 'mushaf' ? pageInfo.names : meta.surahs[surah - 1]?.ar}
            </span>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>

        <button className="icon-btn reader-quick-search-trigger" aria-label={t("ui.cd32ebbeba")} title={t("quickSearch.tooltip")} onClick={() => { route.captureQuickOrigin(); setSel(null); search.openQuick() }}><QuickSearchIcon /></button>
        <span className="reader-toolbar-spacer" aria-hidden="true" />

        <AudioToolbarButton
          open={audioOpen}
          controlsVisible={audioControlsVisible}
          status={audioStatus}
          onOpen={() => { setAudioControlsVisible(true); setAudioOpen(true) }}
          onCollapse={() => setAudioControlsVisible(false)}
          onCancelLoading={() => setAudioPauseRequest(value=>value+1)}
          onExpandAndResume={() => { setAudioControlsVisible(true); if (audioStatus !== 'loading') setAudioPlayRequest(value => value + 1) }}
        />

          <ReaderDisplayMenu mode={mode} onMode={switchMode} scale={scale} onScale={setScale} showTranslation={showTrans} onTranslation={setShowTrans} />


        </>}
      </header>
      {searchReturnBar}

      <LanguageOnboarding knownPersianReader={knownPersianReader} onTranslation={id=>{setTranslator(id);setShowTrans(true)}}/>
      <RecitationPlayer onNativeActive={()=>setAudioOpen(true)} playRequest={audioPlayRequest} pauseRequest={audioPauseRequest} onStatusChange={setAudioStatus} controlsVisible={audioControlsVisible} open={audioOpen} surah={meta.surahs[curSurahN-1]} selectedAyah={sel?(analysisSelection??sel).a:null} onPlaying={(s,a)=>{setAudioVerse({s,a});if(sel)setPlaybackTarget({s,a})}} previousSurahVerses={meta.surahs[curSurahN-2]?.vc} onNextSurah={(s,a=1)=>{setAudioVerse({s,a});if(sel)setPlaybackTarget({s,a});goVerse(s,a)}} startAyah={sel?.s===curSurahN?(analysisSelection??sel).a:(typeof window!=='undefined'?readVerseAddress(window.location.search,window.location.pathname)?.a:1)??1} onClose={() => { setAudioOpen(false); setAudioVerse(null) }} onFollow={(s,a) => goVerse(s,a)} />

      {!search.advancedOpen && (route.quickOrigin || search.quickOpen) && (
        <div className="reader-search-band reader-search-width quick-search-return" dir="rtl">
          {route.quickOrigin && <button type="button" className="chip" data-quick-search-return onClick={route.returnFromQuick}>
            <ArrowRight size={14} aria-hidden="true" />
            <span>{t('quickSearch.returnTo', { p0: meta.surahs[route.quickOrigin.address.s - 1].fa, p1: toFa(route.quickOrigin.address.a) })}</span>
          </button>}
          {search.quickOpen && <div className="quick-search-results-slot" ref={setQuickResultsBar} />}
        </div>
      )}


      {!showComparison && comparisonRange?.s === curSurahN && (contextComparison || Object.keys(comparisonRoots).length > 0) && (
        <div className="relative z-10 flex flex-wrap items-center gap-2 px-3 py-2 text-xs" style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
          <span className="comparison-range-band rounded px-2 py-1">{t("ui.6f0ffd5c13")}{' '}{toFa(comparisonRange.from)}–{toFa(comparisonRange.to)}</span>
          {comparisonVisibility.solo ? <button className="chip" aria-label={t("ui.8ecef9ea93")} onClick={comparison.revealAll}>{t("ui.52a86c5c98")}{' '}{comparisonVisibility.solo.split('').join(' ')} ×</button>
            : comparisonVisibility.hidden.size > 0 ? <button className="chip" aria-label={t("ui.e0b2c3ffe6")} onClick={comparison.unhideAll}>{toFa(comparisonVisibility.hidden.size)}{' '}{t("ui.5277283f26")}</button> : <span>{t("ui.fbd767126d")}</span>}
          <span className="basis-full" style={{ color: 'var(--ink-soft)' }}>{t("ui.a8b5fe8641")}</span>
          <button className="underline mr-auto" onClick={comparison.openSheet}>{t("ui.e5d9ee962d")}</button>
          <button aria-label={t("ui.36fdc8888e")} onClick={() => { comparison.dismiss(); setSel(null) }}>×</button>
        </div>
      )}
      {/* ===== Main + side root panel ===== */}
      <div className="reader-workspace relative z-10 flex-1 min-h-0 flex flex-col lg:flex-row lg:items-stretch">
        <main ref={mainRef} className="flex-1 min-h-0 min-w-0 flex flex-col quran-main"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
          <QuranClipboard root={mainRef} meta={meta} />
          <ReaderSearchHighlights value={search.quickOpen?search.quickHighlights:null}
            verse={search.returnToSearch && !search.quickOpen && !search.advancedOpen && !search.searchAndGoOpen ? search.returnToUnified?.highlight : undefined}>
          {mode === 'mushaf' ? (
            <ContinuousMushaf meta={meta} page={page} navigationRevision={mushafNavigationRevision}
              onPageChange={setPage} onContentReady={onMushafContentReady} showTrans={showTrans} translator={translator} scale={scale}
              selection={sel ? analysisSelection ?? sel : null}
              highlightRoot={sel ? (analysisSelection?.tab === 'root' ? analysisSelection.root : null) : comparisonRoot}
              analysisSelection={sel ? analysisSelection : audioVerse ? {...audioVerse,tab:'verse',pos:1,root:null,text:''} : null} comparisonRange={comparisonRange}
              comparisonRoots={comparisonRoots} mutedComparisonRoots={mutedComparisonRoots} flash={flash} onOpenSurahs={() => { setNavigationDockOpen(false); setDrawerView('navigation'); setDrawerOpen(true) }} onWordTap={tapWord} />
          ) : (
            <SurahPull key={`f-${surah}`} surah={surah} meta={meta.surahs} fontSize={flowFont} showTrans={showTrans} translator={translator}
              ready={!loadingPage && flowSurah?.n === surah}
              arriveAtEnd={pullArrival?.s === surah && pullArrival.end}
              onNavigate={async (n, end) => {
                // Keep the completed preview visible until all destination data is ready.
                const [data, translations] = await Promise.all([loadSurah(n), loadTrans(n,translator), document.fonts.ready])
                setPullArrival({ s: n, end })
                setFlowSurah(data); setFlowTransState({ key: `${n}:${translator}`, data: translations }); setLoadingPage(false)
                setPage(data.v[0].p); setFlash(null); setSel(null); setSurah(n)
              }}>
              <FlowSurface>
                {loadingPage || !flowSurah || flowSurah.n !== surah ? (
                  <p className="text-sm animate-pulse text-center py-10" style={{ color: 'var(--ink-faint)' }}>…</p>
                ) : (
                  <FlowPage
                    sm={meta.surahs[surah - 1]}
                    surah={flowSurah}
                    trans={flowTrans}
                    showTrans={showTrans}
                    translator={translator}
                    fontSize={flowFont}
                    selection={sel ? analysisSelection ?? sel : null}
                    highlightRoot={sel ? (analysisSelection?.tab === 'root' ? analysisSelection.root : null) : comparisonRoot}
                    analysisSelection={sel ? analysisSelection : audioVerse ? {...audioVerse,tab:'verse',pos:1,root:null,text:''} : null}
                    comparisonRange={comparisonRange}
                    comparisonRoots={comparisonRoots} mutedComparisonRoots={mutedComparisonRoots}
                    flash={flash}
                    onOpenSurahs={() => { setNavigationDockOpen(false); setDrawerView('navigation'); setDrawerOpen(true) }} onWordTap={tapWord}
                  />
                )}
              </FlowSurface>
            </SurahPull>
          )}
          </ReaderSearchHighlights>
        </main>

        {sel && (showIndex || showComparison
          ? createPortal(rootPanel, document.body)
          : rootPanel
        )}      </div>

      {SEARCH_AND_GO && (search.searchAndGoOpen || navigationDockOpen) && <SearchAndGo key={search.unifiedRevision} meta={meta} currentSurah={curSurahN}
        pinned={pinnedSurahs} recent={recentSurahs}
        onTogglePin={n => setPinnedSurahs(old => { const next = togglePinnedSurah(old, n); writeStored('mushaf.pinned-surahs', next); return next })}
        field={search.searchAndGoInput} onClose={closeUnifiedPanel}
        wide={wideReader && SEARCH_AND_GO_PHASE_3} docked={navigationDocked}
        onActivate={navigationDockOpen ? activateNavigationDock : undefined}
        onBrowse={wideReader ? () => {
          if (!search.searchAndGoOpen) return
          setNavigationDockOpen(true)
          route.closeSearchAndGo()
        } : undefined}
        onDestination={navigateFromSearchAndGo}
        translator={translator} start={search.unifiedStart} onPick={pickSearchResult}
        onSearchStateChange={SEARCH_AND_GO_PHASE_2 ? route.updateSearchAndGoState : undefined}
        onClearOccurrenceFilter={search.clearOccurrence}
        onReplay={SEARCH_AND_GO_PHASE_2 ? openUnifiedSearch : undefined}
        history={SEARCH_AND_GO_PHASE_2 ? search.operations : undefined}
        onRecordSearch={SEARCH_AND_GO_PHASE_2 ? search.recordOperation : undefined}
        onToggleHistoryPin={search.toggleHistoryPin}
        onRecentSurah={s => {
          const position = route.lastSurahPosition(s, meta.surahs[s - 1].vc)
          if (position) navigateFromSearchAndGo({ kind: 'verse', s, a: position.a }, position.pos)
          else navigateFromSearchAndGo({ kind: 'surah', s })
        }}
      />}

      {/* ===== Drawer ===== */}
      {drawerOpen && (
        <NavDrawer key={drawerView} view={drawerView}
          meta={meta}
          bookmarks={bookmarks}
          recentSurahs={recentSurahs}
          pinnedSurahs={pinnedSurahs}
          onTogglePin={n => setPinnedSurahs(old => { const next = togglePinnedSurah(old, n); writeStored('mushaf.pinned-surahs', next); return next })}
          onClearRecent={() => { setRecentSurahs([]); writeStored('mushaf.recent-surahs', []) }}
          onAdvancedSearch={() => { setDrawerOpen(false); setSel(null); openAdvancedSearch() }}
          onOpenSettings={() => { setDrawerOpen(false); setSettingsOpen(true) }}
          onOpenKeywords={() => { setDrawerOpen(false); setShowIndex(true) }}
          onOpenComparison={() => { setDrawerOpen(false); setSel(null); comparison.open(curSurahN) }}
          theme={theme}
          translator={translator}
          scale={scale}
          currentSurah={curSurahN}
          onClose={() => setDrawerOpen(false)}
          onGoPage={goPage}
          onGoSurah={n=>{setDesktopSurah(n);goSurah(n);writeVerseAddress({s:n,a:1,pos:1})}}
          onGoVerse={(s, a) => goVerse(s, a, 1, 'start')}
          onRemoveBookmark={p => setBookmarks(b => removeBookmark(b, p))}
          onTheme={setTheme}
          onTranslator={setTranslator}
          onScale={setScale}
        />
      )}
      {settingsOpen && <SettingsScreen meta={meta} theme={theme} onTheme={setTheme} mode={mode} onMode={switchMode} translator={translator} onTranslator={setTranslator} scale={scale} onScale={setScale} onClose={() => setSettingsOpen(false)} />}

      {/* ===== Sorted Surah Index drawer =====
          Rendered as a right-side drawer that stays open while the
          RootPanel is open. The activeRoot prop highlights the currently
          selected row in the list so the user knows where they are. */}
      {showComparison && (
        <RangeComparison key={comparisonSurah} surahN={comparisonSurah} meta={meta}
          onRangeChange={comparison.setRange}
          onRootsChange={comparison.setRoots}
          initialRange={comparisonRange?.s === comparisonSurah ? comparisonRange : null}
          onClose={() => { comparison.closeSheet(); setSel(null) }}
          onPickRoot={root => { setComparisonRoot(root); setPanelMax(false); pickRootFromIndex(root, comparisonSurah) }} />
      )}
      {showIndex && (
        <SurahIndex
          surahN={curSurahN}
          meta={meta}
          activeRoot={sel?.root ?? null}
          onClose={() => setShowIndex(false)}
          onPickRoot={pickRootFromIndex}
        />
      )}
    </div>}
    </>
  )
}
