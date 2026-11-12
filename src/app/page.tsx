'use client'
import {useStudyWorkspace} from '@/lib/study-store'
import {t,useUiLanguage} from '@/lib/i18n'
import {LanguageOnboarding} from '@/components/quran/LanguageSettings'
import { writeVerseAddress, readingUrl, readVerseAddress } from '@/lib/verse-link'
import { readStored, writeStored } from '@/lib/reader-storage'
import { clampScale, rememberSurah, removeBookmark, stepScale, togglePinnedSurah } from '@/lib/reader-settings'
import { useReadingRoute } from '@/components/quran/useReadingRoute'
import { useStartupSplash } from '@/components/quran/useStartupSplash'
import { useReaderPresentation } from '@/components/quran/useReaderPresentation'
import { useComparison } from '@/components/quran/useComparison'
import { useSearchNavigation } from '@/components/quran/useSearchNavigation'
import type { ReadingMode } from '@/lib/reading-route'
import type { VerseAddress } from '@/lib/verse-link'
import type { Destination } from '@/lib/navigation'
import { wordTarget } from '@/lib/word-parts'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { ArrowRight, Search, Settings, ChevronDown } from 'lucide-react'
import AudioToolbarButton from '@/components/quran/AudioToolbarButton'
import QuranSearch from '@/components/quran/QuranSearch'
import QuickSurahSearch from '@/components/quran/QuickSurahSearch'
import ReaderSearchHighlights from '@/components/quran/ReaderSearchHighlights'
import {
  PatternBG, IconMenu,
  IconTranslate,
} from '@/components/quran/Ornaments'

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
  const { showTrans, setShowTrans, theme, setTheme, translator, setTranslator, scale, setScale, bookmarks, setBookmarks, pinnedSurahs, setPinnedSurahs } = presentation
  const [recentSurahs, setRecentSurahs] = useState<number[]>(() => readStored('mushaf.recent-surahs', []))
  const [drawerView, setDrawerView] = useState<'navigation' | 'tools'>('navigation')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [desktopSurah,setDesktopSurah]=useState<number|null>(null)
  /** The reveal a search click (or a verse deep link) asked the reader for. */
  const [searchTarget, setSearchTarget] = useState<{ s: number; a: number; pos: number; align?: 'start'; wholeVerse?: boolean } | null>(null)
  const [sel, setSel] = useState<Selection | null>(null)
  const [analysisSelection, setAnalysisSelection] = useState<AnalysisSelection | null>(null)
  const [flash, setFlash] = useState<{ s: number; a: number; pos: number } | null>(null)
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
  })
  // Destructured so these callbacks depend on a specific function rather than
  // on the whole hook result; the compiler cannot otherwise preserve them.
  const { close: closeSearch, applyEntry: applySearchEntry, setAdvancedOpen: setAdvancedSearchOpen } = search
  // The route hook is created after the search hook because a search location
  // is applied to the search UI; the reveal it asks for is the reader's.
  const applyVerseEntry = useCallback((address: VerseAddress) => {
    closeSearch()
    setSel(null)
    loadSurah(address.s).then(data => {
      const verse = data.v[address.a - 1]
      if (!verse) return
      const pos = Math.min(address.pos, verse.w.length)
      setFlash({ ...address, pos })
      setSearchTarget({ ...address, pos, wholeVerse:pos===1 })
    })
  }, [closeSearch])
  /** A surah or page in the location: only transient selection state is dropped. */
  const clearTransientSelection = useCallback(() => { closeSearch(); setSel(null); setFlash(null) }, [closeSearch])
  const route = useReadingRoute({ onSearch: applySearchEntry, onVerse: applyVerseEntry, onReading: clearTransientSelection })
  const { page, setPage, mode, setMode, surah, setSurah, requestMushafPage, mushafNavigationRevision, writeSearchState, leaveSearch } = route
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

  const mainRef = useRef<HTMLElement>(null)
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

  useEffect(() => { loadMeta().then(setMeta) }, [])
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
  }, [meta])

  const goPage = useCallback((p: number) => {
    const destination = clamp(p, 1, 604)
    if (mode === 'flow') {
      const first = meta?.pages[destination - 1]?.[0]
      if (!first) return
      const target = { s: first.s, a: first.f, pos: 1 }
      setPullArrival(null)
      writeVerseAddress(target)
      setSurah(first.s)
      setFlash(target)
      setSearchTarget({ ...target, align: 'start', wholeVerse:true })
    } else requestMushafPage(destination)
    setSel(null)
    setComparisonRoot(null)
  }, [mode, meta, requestMushafPage, setComparisonRoot, setSurah])

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
  }, [comparisonRange, comparisonRoots, showComparison, showIndex, toggleComparisonRoot, setComparisonRoot])

  const goSurah = useCallback((n: number) => {
    setPullArrival(null)
    const nn = clamp(n, 1, 114)
    if (!meta) return
    if (mode === 'mushaf') goPage(meta.surahs[nn - 1].pg)
    else setSurah(nn)
  }, [meta, mode, goPage, setSurah])

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

  const goVerse = useCallback((s: number, a: number, pos = 1, align?: 'start', wholeVerse = true) => {
    setPullArrival(null)
    loadSurah(s).then(d => {
      const v = d.v[a - 1]
      if (v) {
        revealVerse(s, a, pos, v.p)
        writeVerseAddress({ s, a, pos })
        setFlash({ s, a, pos })
        setSearchTarget({ s, a, pos, align, wholeVerse })
      }
    })
  }, [revealVerse])

  const navigateDestination = (destination: Destination) => {
    search.leaveForReading();setSel(null)
    if(destination.kind==='page') {
      if(mode==='mushaf') {
        const url=readingUrl(window.location.href,'mushaf',surah,destination.p,process.env.NEXT_PUBLIC_DESKTOP==='1')
        if(url.href!==window.location.href)window.history.pushState(window.history.state,'',url)
      }
      goPage(destination.p)
    }
    else goVerse(destination.s,destination.kind==='surah'?1:destination.kind==='context'?destination.from:destination.a,1,'start')
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
      if (search.advancedOpen || drawerOpen || showIndex || showComparison || (e.target instanceof HTMLElement && e.target.matches('input, textarea, select'))) return
      if (sel||window.getSelection()?.toString()) return
      // Mushaf follows native up/down scrolling; flow retains surah shortcuts.
      if (mode !== 'flow') return
      if (e.key === 'ArrowLeft') goSurah(surah + 1)
      else if (e.key === 'ArrowRight') goSurah(surah - 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [page, surah, mode, drawerOpen, showIndex, showComparison, goPage, goSurah, sel, search.advancedOpen])

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

  const flowFont = 22 * scale
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
      onOpenOccurrences={search.startOccurrence}
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

  return (
    <>
    {!startupComplete && <StartupSplash leaving={startupLeaving} onHoldChange={setStartupHeld} />}
    {meta && <div className={`reader-app h-dvh overflow-hidden flex flex-col relative${drawerOpen || showIndex || showComparison ? ' has-overlay' : ''}`} data-side-navigation={drawerOpen||showIndex||showComparison?'open':undefined} data-portaled-analysis={sel&&(showIndex||showComparison)&&!panelMax?'open':undefined} style={{ background: 'var(--paper)', ['--desktop-navigation-width' as string]: `${desktopPaneWidths.navigation}px`, ['--desktop-analysis-width' as string]: `${desktopPaneWidths.analysis}px` }}>
      <CarStudySync reader={mainRef} revision={`${mode}:${surah}:${page}:${mushafContentRevision}:${showTrans}:${flowSurah?.n}:${loadingPage}`} />
      <PatternBG />

      <QuranSearch onNavigate={navigateDestination} key={search.start?.revision ?? 0} onStateChange={writeSearchState} initialSearch={search.start} occurrenceFilter={search.occurrence} onClearOccurrenceFilter={search.clearOccurrence} translator={translator} open={search.advancedOpen} onOpenChange={changeSearchOpen} meta={meta} currentSurah={curSurahN} onPick={(s, a, pos) => {
        search.pick(s, a, pos); setSel(null); setComparisonRoot(null); goVerse(s, a, pos,undefined,false)
      }} />

      {/* Desktop has explicit previous/next controls in the reading pane below. */}
      <header dir="rtl" className="reader-toolbar relative z-10 shrink-0 flex items-center gap-1 px-2 sm:px-4 border-b"
        style={{
          borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--paper) 82%, transparent)',
          backdropFilter: 'blur(8px)', paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: '0.5rem',
        }}>
        {search.quickOpen ? <QuickSurahSearch meta={meta} onNavigate={navigateDestination} surah={meta.surahs[curSurahN - 1]} onClose={() => search.setQuickOpen(false)}
          onHighlights={search.setQuickHighlights}
          onPick={(s, a, pos) => { setSel(null); goVerse(s, a, pos,undefined,false) }}
          onAdvanced={search.advance} /> : <>
        <button className="icon-btn" onClick={() => { setDrawerView('tools'); setDrawerOpen(true) }} aria-label={t("ui.b563f0690c")} title={t("ui.b563f0690c")}><IconMenu /></button>

        <button className="reader-surah-link flex-1 min-w-0" aria-label={t("ui.450d6bd970")} aria-haspopup="dialog" aria-expanded={drawerOpen && drawerView === 'navigation'} onClick={() => { setDrawerView('navigation'); setDrawerOpen(true) }}>
          <span className="font-bold text-[14px] sm:text-[15px] truncate" style={{ color: 'var(--ink)' }}>
            {mode === 'mushaf' ? pageInfo.names : meta.surahs[surah - 1]?.ar}
          </span><ChevronDown size={16} aria-hidden="true" />
        </button>

        <button className="icon-btn" aria-label={t("ui.cd32ebbeba")} title={t("ui.cd32ebbeba")} onClick={() => { setSel(null); search.openQuick() }}><Search size={20} /></button>

        <AudioToolbarButton
          open={audioOpen}
          controlsVisible={audioControlsVisible}
          status={audioStatus}
          onOpen={() => { setAudioControlsVisible(true); setAudioOpen(true) }}
          onCollapse={() => setAudioControlsVisible(false)}
          onCancelLoading={() => setAudioPauseRequest(value=>value+1)}
          onExpandAndResume={() => { setAudioControlsVisible(true); if (audioStatus !== 'loading') setAudioPlayRequest(value => value + 1) }}
        />

          <button className="icon-btn" aria-label={t("ui.2d6258b160")}
            title={t("ui.37e2fdb79c")}
            aria-pressed={showTrans}
            style={{ color: showTrans ? 'var(--sage)' : undefined, background: showTrans ? 'var(--word-root)' : undefined }}
            onClick={() => setShowTrans(v => !v)}>
            <IconTranslate />
          </button>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label={t("ui.6badcac8c1")} title={t("ui.6badcac8c1")}><Settings size={20} /></button>


        </>}
      </header>

      <LanguageOnboarding knownPersianReader={knownPersianReader} onTranslation={id=>{setTranslator(id);setShowTrans(true)}}/>
      <RecitationPlayer onNativeActive={()=>setAudioOpen(true)} playRequest={audioPlayRequest} pauseRequest={audioPauseRequest} onStatusChange={setAudioStatus} controlsVisible={audioControlsVisible} open={audioOpen} surah={meta.surahs[curSurahN-1]} selectedAyah={sel?(analysisSelection??sel).a:null} onPlaying={(s,a)=>{setAudioVerse({s,a});if(sel)setPlaybackTarget({s,a})}} previousSurahVerses={meta.surahs[curSurahN-2]?.vc} onNextSurah={(s,a=1)=>{setAudioVerse({s,a});if(sel)setPlaybackTarget({s,a});goVerse(s,a)}} startAyah={sel?.s===curSurahN?(analysisSelection??sel).a:(typeof window!=='undefined'?readVerseAddress(window.location.search,window.location.pathname)?.a:1)??1} onClose={() => { setAudioOpen(false); setAudioVerse(null) }} onFollow={(s,a) => goVerse(s,a)} />

      {search.returnToSearch && !search.advancedOpen && (
        <div className="relative z-10 shrink-0 flex items-center justify-between gap-2 px-3 py-1 border-b" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
          <button type="button" className="chip gap-1.5 py-1.5" onClick={() => { setSel(null); search.setAdvancedOpen(true) }}>
            <ArrowRight size={14} aria-hidden="true" />{t("ui.15868c5aa7")}</button>
          <button type="button" className="icon-btn sm" aria-label={t("ui.4d21d96f48")} onClick={search.dismissReturn}>×</button>
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
          <ReaderSearchHighlights value={search.quickOpen?search.quickHighlights:null}>
          {mode === 'mushaf' ? (
            <ContinuousMushaf meta={meta} page={page} navigationRevision={mushafNavigationRevision}
              onPageChange={setPage} onContentReady={onMushafContentReady} showTrans={showTrans} translator={translator} scale={scale}
              selection={sel ? analysisSelection ?? sel : null}
              highlightRoot={sel ? (analysisSelection?.tab === 'root' ? analysisSelection.root : null) : comparisonRoot}
              analysisSelection={sel ? analysisSelection : audioVerse ? {...audioVerse,tab:'verse',pos:1,root:null,text:''} : null} comparisonRange={comparisonRange}
              comparisonRoots={comparisonRoots} mutedComparisonRoots={mutedComparisonRoots} flash={flash} onOpenSurahs={() => { setDrawerView('navigation'); setDrawerOpen(true) }} onWordTap={tapWord} />
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
                    onOpenSurahs={() => { setDrawerView('navigation'); setDrawerOpen(true) }} onWordTap={tapWord}
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

      {/* ===== Drawer ===== */}
      {drawerOpen && (
        <NavDrawer key={drawerView} view={drawerView}
          meta={meta}
          bookmarks={bookmarks}
          recentSurahs={recentSurahs}
          pinnedSurahs={pinnedSurahs}
          onTogglePin={n => setPinnedSurahs(old => { const next = togglePinnedSurah(old, n); writeStored('mushaf.pinned-surahs', next); return next })}
          onClearRecent={() => { setRecentSurahs([]); writeStored('mushaf.recent-surahs', []) }}
          onAdvancedSearch={() => { setDrawerOpen(false); setSel(null); search.openAdvanced() }}
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
