'use client'
import {occurrenceScopeSurahs,type OccurrenceScope} from '@/lib/occurrence-scope'
import {useStudyWorkspace} from '@/lib/study-store'
import {t,useUiLanguage} from '@/lib/i18n'
import {LanguageOnboarding} from '@/components/quran/LanguageSettings'
import { writeVerseAddress, readingUrl, readVerseAddress } from '@/lib/verse-link'
import type { SearchLinkState } from '@/lib/search-link'
import { readStored, writeStored } from '@/lib/reader-storage'
import { clampScale, rememberSurah, removeBookmark, resolveInitialTranslator, stepScale, togglePinnedSurah } from '@/lib/reader-settings'
import { useReadingRoute } from '@/components/quran/useReadingRoute'
import { useComparison } from '@/components/quran/useComparison'
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
import {syncNativeAppearance} from '@/lib/native-appearance'
import { useVisibleSelection } from '@/components/quran/useVisibleSelection'
import QuranClipboard from '@/components/quran/QuranClipboard'
import NavDrawer, { type Translator } from '@/components/quran/NavDrawer'
import SettingsScreen from '@/components/quran/SettingsScreen'
import SurahIndex from '@/components/quran/SurahIndex'
import type { AnalysisSelection } from '@/lib/analysis'
import RangeComparison from '@/components/quran/RangeComparison'
import { ArrowRight, Search, Settings, ChevronDown, Play, LoaderCircle, AudioLines } from 'lucide-react'
import QuranSearch, { type SearchStart } from '@/components/quran/QuranSearch'
import QuickSurahSearch from '@/components/quran/QuickSurahSearch'
import ReaderSearchHighlights,{type ReaderSearchState} from '@/components/quran/ReaderSearchHighlights'
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
  const [showTrans, setShowTrans] = useState(() => readStored('mushaf.showTrans', false))
  const [theme, setTheme] = useState<'paper' | 'night'>(() => readStored('mushaf.theme', 'paper'))
  const [translator, setTranslator] = useState<Translator>(() => resolveInitialTranslator(readStored('mushaf.tr', 's'), readStored('mushaf.safavi-default.v1', false)))
  const [scale, setScale] = useState(() => readStored('mushaf.scale', 1))
  const [bookmarks, setBookmarks] = useState<number[]>(() => readStored('mushaf.marks', []))
  const [pinnedSurahs, setPinnedSurahs] = useState<number[]>(() => readStored('mushaf.pinned-surahs', []))
  const [recentSurahs, setRecentSurahs] = useState<number[]>(() => readStored('mushaf.recent-surahs', []))
  const [drawerView, setDrawerView] = useState<'navigation' | 'tools'>('navigation')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [desktopSurah,setDesktopSurah]=useState<number|null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [quickSearchOpen, setQuickSearchOpen] = useState(false)
  const [quickHighlights,setQuickHighlights]=useState<ReaderSearchState|null>(null)
  const [searchStart, setSearchStart] = useState<SearchStart | null>(null)
  const [occurrenceSearch, setOccurrenceSearch] = useState<AnalysisSelection | null>(null)
  const [returnToSearch, setReturnToSearch] = useState(false)
  const [searchTarget, setSearchTarget] = useState<{ s: number; a: number; pos: number; align?: 'start'; wholeVerse?: boolean } | null>(null)
  const [sel, setSel] = useState<Selection | null>(null)
  const [analysisSelection, setAnalysisSelection] = useState<AnalysisSelection | null>(null)
  const [flash, setFlash] = useState<{ s: number; a: number; pos: number } | null>(null)
  /**
   * The three ways a location can describe the reader. Only the route hook
   * knows a navigation happened; only this screen knows what it means for the
   * surrounding panels, so the two are joined here rather than inside the hook.
   */
  const applySearchEntry = useCallback((state: SearchLinkState, sameEntry: boolean) => {
    if (sameEntry) { setTranslator(state.translator); setSearchOpen(true); return }
    setSearchStart({ query: state.query, mode: state.mode, surahs: state.surahs, revision: Date.now(), state })
    setOccurrenceSearch(state.occurrence); setTranslator(state.translator); setSearchOpen(true)
  }, [])
  /** A verse address in the location: drop selection and reveal it once loaded. */
  const applyVerseEntry = useCallback((address: VerseAddress) => {
    setSearchOpen(false)
    setSel(null)
    loadSurah(address.s).then(data => {
      const verse = data.v[address.a - 1]
      if (!verse) return
      const pos = Math.min(address.pos, verse.w.length)
      setFlash({ ...address, pos })
      setSearchTarget({ ...address, pos, wholeVerse:pos===1 })
    })
  }, [])
  /** A surah or page in the location: only transient selection state is dropped. */
  const clearTransientSelection = useCallback(() => { setSearchOpen(false); setSel(null); setFlash(null) }, [])
  const route = useReadingRoute({ onSearch: applySearchEntry, onVerse: applyVerseEntry, onReading: clearTransientSelection })
  const { page, setPage, mode, setMode, surah, setSurah, requestMushafPage, mushafNavigationRevision, writeSearchState, leaveSearch } = route
  const changeSearchOpen = (open: boolean) => {
    setSearchOpen(open)
    if (!open) leaveSearch()
  }
  const [pageData, setPageData] = useState<Map<number, SurahData>>(new Map())
  const pullArrival = useRef<{ s: number; end: boolean } | null>(null)
  const [flowSurah, setFlowSurah] = useState<SurahData | null>(null)
  const [flowTrans, setFlowTrans] = useState<Translations | null>(null)
  const [loadingPage, setLoadingPage] = useState(true)
  const [startupComplete, setStartupComplete] = useState(false)
  const [startupMinimumElapsed, setStartupMinimumElapsed] = useState(false)
  const [startupLeaving, setStartupLeaving] = useState(false)
  const [startupHeld, setStartupHeld] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setStartupMinimumElapsed(true), 1000)
    return () => clearTimeout(timer)
  }, [])
  const [mushafContentRevision, setMushafContentRevision] = useState(0)
  const onMushafContentReady = useCallback(() => setMushafContentRevision(n => n + 1), [])
  const [audioOpen, setAudioOpen] = useState(false)
  const [audioControlsVisible,setAudioControlsVisible]=useState(true)
  const [audioStatus,setAudioStatus]=useState<RecitationTransportStatus>('idle')
  const [audioPlayRequest,setAudioPlayRequest]=useState(0)
  const [audioVerse, setAudioVerse] = useState<{s:number;a:number}|null>(null)
  useEffect(()=>{if(!audioOpen)setAudioVerse(null)},[audioOpen])
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
  } = comparison

  const compareContext = comparison.startContext
  /** The analysis panel reports its selection here; a context comparison follows it. */
  const onAnalysisSelection = useCallback((selection: AnalysisSelection) => {
    setAnalysisSelection(selection)
    comparison.followContext(selection)
  }, [comparison.followContext])

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
  const focusComparisonRoot = useCallback((root: string) => { comparison.solo(root); setSel(null) }, [comparison.solo])
  useComparisonHold(mainRef, !!comparisonRange && Object.keys(comparisonRoots).length > 0 && !showComparison && !showIndex, focusComparisonRoot)
  const pinchRef = useRef<{ d: number; s: number } | null>(null)

  useEffect(() => { loadMeta().then(setMeta) }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme==='night'?'dark':'light'
    void syncNativeAppearance(theme)
    writeStored('mushaf.theme', theme)
  }, [theme])
  useEffect(() => {
    const color = !startupComplete ? '#faf4df' : getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }, [theme, startupComplete])
  useEffect(() => { writeStored('mushaf.showTrans', showTrans) }, [showTrans])
  useEffect(() => { writeStored('mushaf.tr', translator); writeStored('mushaf.safavi-default.v1', true) }, [translator])
  useEffect(() => {
    const timer = window.setTimeout(() => writeStored('mushaf.scale', scale), 200)
    return () => window.clearTimeout(timer)
  }, [scale])
  useEffect(() => { writeStored('mushaf.marks', bookmarks) }, [bookmarks])

  const segs = useMemo(() => (meta ? meta.pages[page - 1] || [] : []), [meta, page])
  const curSurahN = mode === 'mushaf' ? (desktopSurah&&segs.some(segment=>segment.s===desktopSurah)?desktopSurah:segs[0]?.s??1) : surah
  useEffect(() => {
    if (!meta || loadingPage) return
    setRecentSurahs(previous => { const next = rememberSurah(previous, curSurahN); writeStored('mushaf.recent-surahs', next); return next })
  }, [curSurahN, meta, loadingPage])

  // close panel-max when selection changes / panel closes
  useEffect(() => { if (!sel) setPanelMax(false) }, [sel])

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
  useEffect(()=>{
    if(mode!=='flow')return
    let live=true
    setFlowTrans(null)
    loadTrans(surah,translator).then(data=>{if(live)setFlowTrans(data)}).catch(()=>{if(live)setFlowTrans({})})
    return()=>{live=false}
  },[mode,surah,translator])

  useEffect(() => {
    if (!startupHeld && !startupComplete && startupMinimumElapsed && meta && !loadingPage && (mode === 'flow' ? flowSurah?.n === surah : segs.every(seg => pageData.has(seg.s)))) setStartupLeaving(true)
  }, [startupHeld, startupComplete, startupMinimumElapsed, meta, loadingPage, mode, flowSurah?.n, surah, segs, pageData])

  useEffect(() => {
    if (!startupLeaving || startupHeld) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => setStartupComplete(true), reduced ? 0 : 180)
    return () => clearTimeout(timer)
  }, [startupLeaving, startupHeld])

  // flash cleanup
  useEffect(() => {
    if (!flash || quickSearchOpen) return
    const t = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(t)
  }, [flash, quickSearchOpen])

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
      pullArrival.current = null
      writeVerseAddress(target)
      setSurah(first.s)
      setFlash(target)
      setSearchTarget({ ...target, align: 'start', wholeVerse:true })
    } else requestMushafPage(destination)
    setSel(null)
    comparison.setPickedRoot(null)
  }, [mode, meta, requestMushafPage, comparison.setPickedRoot])

  const tapWord = useCallback((word: Selection) => {
    setPlaybackTarget(null)
    if (!showComparison && !showIndex && comparisonRange?.s === word.s && word.root && comparisonRoots[word.root] !== undefined) {
      comparison.toggleRoot(word.root)
      setSel(null)
      return
    }
    writeVerseAddress(word)
    setFlash(null)
    comparison.setPickedRoot(null)
    setSel(current => current?.s === word.s && current.a === word.a && current.pos === word.pos && (current.part ?? 'stem') === (word.part ?? 'stem') ? null : word)
  }, [comparisonRange, comparisonRoots, showComparison, showIndex, comparison.toggleRoot, comparison.setPickedRoot])

  const goSurah = useCallback((n: number) => {
    pullArrival.current = null
    const nn = clamp(n, 1, 114)
    if (!meta) return
    if (mode === 'mushaf') goPage(meta.surahs[nn - 1].pg)
    else setSurah(nn)
  }, [meta, mode, goPage])

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
  }, [mode, requestMushafVerse])

  const goVerse = useCallback((s: number, a: number, pos = 1, align?: 'start', wholeVerse = true) => {
    pullArrival.current = null
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

  const openOccurrenceSearch = (selection: AnalysisSelection, scope: OccurrenceScope) => {
    const surahs = occurrenceScopeSurahs(scope, selection.s)
    if (!surahs) return
    setSearchStart({ query: selection.tab === 'root' ? selection.root || selection.text : selection.text, mode: selection.tab === 'root' ? 'root' : selection.tab === 'word' ? 'lemma' : 'text', surahs, revision: Date.now() })
    setOccurrenceSearch(selection)
    setSearchOpen(true)
  }

  const navigateDestination = (destination: Destination) => {
    setQuickSearchOpen(false);setSel(null)
    if(searchOpen){setReturnToSearch(true);setSearchOpen(false)}
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
      reveal(scroll,word,searchTarget.align === 'start' || quickSearchOpen || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth')
      setSearchTarget(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [searchTarget, quickSearchOpen, loadingPage, mode, page, surah, flowSurah?.n, pageData, mushafContentRevision])

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
      if (searchOpen || drawerOpen || showIndex || showComparison || (e.target instanceof HTMLElement && e.target.matches('input, textarea, select'))) return
      if (sel||window.getSelection()?.toString()) return
      // Mushaf follows native up/down scrolling; flow retains surah shortcuts.
      if (mode !== 'flow') return
      if (e.key === 'ArrowLeft') goSurah(surah + 1)
      else if (e.key === 'ArrowRight') goSurah(surah - 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [page, surah, mode, drawerOpen, showIndex, showComparison, goPage, goSurah, sel, searchOpen])

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

  return (
    <>
    {!startupComplete && <StartupSplash leaving={startupLeaving} onHoldChange={held => { setStartupHeld(held); if (held) setStartupLeaving(false) }} />}
    {meta && <div className={`reader-app h-dvh overflow-hidden flex flex-col relative${drawerOpen || showIndex || showComparison ? ' has-overlay' : ''}`} data-side-navigation={drawerOpen||showIndex||showComparison?'open':undefined} data-portaled-analysis={sel&&(showIndex||showComparison)&&!panelMax?'open':undefined} style={{ background: 'var(--paper)', ['--desktop-navigation-width' as string]: `${desktopPaneWidths.navigation}px`, ['--desktop-analysis-width' as string]: `${desktopPaneWidths.analysis}px` }}>
      <CarStudySync reader={mainRef} revision={`${mode}:${surah}:${page}:${mushafContentRevision}:${showTrans}:${flowSurah?.n}:${loadingPage}`} />
      <PatternBG />

      <QuranSearch onNavigate={navigateDestination} key={searchStart?.revision ?? 0} onStateChange={writeSearchState} initialSearch={searchStart} occurrenceFilter={occurrenceSearch} onClearOccurrenceFilter={() => setOccurrenceSearch(null)} translator={translator} open={searchOpen} onOpenChange={changeSearchOpen} meta={meta} currentSurah={curSurahN} onPick={(s, a, pos) => {
        setReturnToSearch(true); setSearchOpen(false); setQuickSearchOpen(false); setSel(null); comparison.setPickedRoot(null); goVerse(s, a, pos,undefined,false)
      }} />

      {/* Desktop has explicit previous/next controls in the reading pane below. */}
      <header dir="rtl" className="reader-toolbar relative z-10 shrink-0 flex items-center gap-1 px-2 sm:px-4 border-b"
        style={{
          borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--paper) 82%, transparent)',
          backdropFilter: 'blur(8px)', paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: '0.5rem',
        }}>
        {quickSearchOpen ? <QuickSurahSearch meta={meta} onNavigate={navigateDestination} surah={meta.surahs[curSurahN - 1]} onClose={() => setQuickSearchOpen(false)}
          onHighlights={setQuickHighlights}
          onPick={(s, a, pos) => { setSel(null); goVerse(s, a, pos,undefined,false) }}
          onAdvanced={start => { setOccurrenceSearch(null); setSearchStart({ ...start, revision: Date.now() }); setSearchOpen(true) }} /> : <>
        <button className="icon-btn" onClick={() => { setDrawerView('tools'); setDrawerOpen(true) }} aria-label={t("ui.b563f0690c")} title={t("ui.b563f0690c")}><IconMenu /></button>

        <button className="reader-surah-link flex-1 min-w-0" aria-label={t("ui.450d6bd970")} aria-haspopup="dialog" aria-expanded={drawerOpen && drawerView === 'navigation'} onClick={() => { setDrawerView('navigation'); setDrawerOpen(true) }}>
          <span className="font-bold text-[14px] sm:text-[15px] truncate" style={{ color: 'var(--ink)' }}>
            {mode === 'mushaf' ? pageInfo.names : meta.surahs[surah - 1]?.ar}
          </span><ChevronDown size={16} aria-hidden="true" />
        </button>

        <button className="icon-btn" aria-label={t("ui.cd32ebbeba")} title={t("ui.cd32ebbeba")} onClick={() => { setSel(null); setQuickSearchOpen(true) }}><Search size={20} /></button>

        <button className="icon-btn" aria-label={!audioOpen?t("ui.facfd50c31"):audioControlsVisible?t("ui.feabb65c6a"):audioStatus==='playing'?t("ui.7851ddb1df"):t("ui.f432f383bf")} title={!audioOpen?t("ui.1f7cc9473a"):audioControlsVisible?t("ui.0b17cf0f81"):t("ui.0884ec3e62")} aria-expanded={audioOpen&&audioControlsVisible} aria-busy={audioStatus==='loading'} style={audioOpen?{color:'var(--sage)',background:'var(--word-root)'}:undefined} onClick={()=>{if(!audioOpen){setAudioControlsVisible(true);setAudioOpen(true)}else if(audioControlsVisible)setAudioControlsVisible(false);else{setAudioControlsVisible(true);if(audioStatus!=='loading')setAudioPlayRequest(value=>value+1)}}}>{audioStatus==='playing'&&audioOpen?<span className="recitation-activity" aria-hidden="true">{[0,1,2,3,4].map(i=><i key={i} style={{animationDelay:`${i*0.12}s`}}/>)}</span>:audioStatus==='loading'&&audioOpen?<LoaderCircle size={20} className="recitation-start-spinner animate-spin"/>:audioOpen&&audioControlsVisible?<AudioLines size={20}/>:<Play size={20} fill="currentColor"/>}</button>

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
      <RecitationPlayer onNativeActive={()=>setAudioOpen(true)} playRequest={audioPlayRequest} onStatusChange={setAudioStatus} controlsVisible={audioControlsVisible} open={audioOpen} surah={meta.surahs[curSurahN-1]} selectedAyah={sel?(analysisSelection??sel).a:null} onPlaying={(s,a)=>{setAudioVerse({s,a});if(sel)setPlaybackTarget({s,a})}} previousSurahVerses={meta.surahs[curSurahN-2]?.vc} onNextSurah={(s,a=1)=>{setAudioVerse({s,a});if(sel)setPlaybackTarget({s,a});goVerse(s,a)}} startAyah={sel?.s===curSurahN?(analysisSelection??sel).a:(typeof window!=='undefined'?readVerseAddress(window.location.search,window.location.pathname)?.a:1)??1} onClose={() => setAudioOpen(false)} onFollow={(s,a) => goVerse(s,a)} />

      {returnToSearch && !searchOpen && (
        <div className="relative z-10 shrink-0 flex items-center justify-between gap-2 px-3 py-1 border-b" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
          <button type="button" className="chip gap-1.5 py-1.5" onClick={() => { setSel(null); setSearchOpen(true) }}>
            <ArrowRight size={14} aria-hidden="true" />{t("ui.15868c5aa7")}</button>
          <button type="button" className="icon-btn sm" aria-label={t("ui.4d21d96f48")} onClick={() => setReturnToSearch(false)}>×</button>
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
          <ReaderSearchHighlights value={quickSearchOpen?quickHighlights:null}>
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
              enabled={!(sel && panelMax) && !drawerOpen && !searchOpen && !showComparison && !showIndex}
              arriveAtEnd={pullArrival.current?.s === surah && pullArrival.current.end}
              onNavigate={async (n, end) => {
                // Keep the completed preview visible until all destination data is ready.
                const [data, translations] = await Promise.all([loadSurah(n), loadTrans(n,translator), document.fonts.ready])
                pullArrival.current = { s: n, end }
                setFlowSurah(data); setFlowTrans(translations); setLoadingPage(false)
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
          ? createPortal(
              <RootPanel
            playbackTarget={playbackTarget}
            onOpenOccurrences={openOccurrenceSearch}
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
            /* When the index drawer is also open, the panel needs to sit
               on top of it — pass a flag so the panel can bump its z-index. */
            stackedOverIndex={showIndex || showComparison}
            comparisonRange={comparisonRange}
          />, document.body)
          : (
              <RootPanel
            playbackTarget={playbackTarget}
            onOpenOccurrences={openOccurrenceSearch}
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
            /* When the index drawer is also open, the panel needs to sit
               on top of it — pass a flag so the panel can bump its z-index. */
            stackedOverIndex={showIndex || showComparison}
            comparisonRange={comparisonRange}
          />
            ))}      </div>

      {/* ===== Drawer ===== */}
      {drawerOpen && (
        <NavDrawer key={drawerView} view={drawerView}
          meta={meta}
          bookmarks={bookmarks}
          recentSurahs={recentSurahs}
          pinnedSurahs={pinnedSurahs}
          onTogglePin={n => setPinnedSurahs(old => { const next = togglePinnedSurah(old, n); writeStored('mushaf.pinned-surahs', next); return next })}
          onClearRecent={() => { setRecentSurahs([]); writeStored('mushaf.recent-surahs', []) }}
          onAdvancedSearch={() => { setDrawerOpen(false); setOccurrenceSearch(null); setSel(null); setSearchStart({ query: '', mode: 'text', surahs: [], revision: Date.now() }); setSearchOpen(true) }}
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
          onPickRoot={root => { comparison.setPickedRoot(root); setPanelMax(false); pickRootFromIndex(root, comparisonSurah) }} />
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
