'use client'
import { readVerseAddress, writeVerseAddress, readSurahNumber, readPageNumber, readingUrl } from '@/lib/verse-link'
import { readSearchLink, searchLink, type SearchLinkState } from '@/lib/search-link'
import { wordTarget } from '@/lib/word-parts'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Meta, SurahData, Translations } from '@/lib/quran'
import { loadMeta, loadSurah, loadTrans, loadGlobalRoots, compareRootRange, toFa } from '@/lib/quran'
import type { Selection } from '@/components/quran/MushafPage'
import ContinuousMushaf from '@/components/quran/ContinuousMushaf'
import FlowPage, { FlowSurface } from '@/components/quran/FlowPage'
import SurahPull from '@/components/quran/SurahPull'
import RootPanel from '@/components/quran/RootPanel'
import StartupSplash from '@/components/quran/StartupSplash'
import { rootHue } from '@/lib/comparison-colors'
import { useComparisonHold } from '@/components/quran/useComparisonHold'
import { useVisibleSelection } from '@/components/quran/useVisibleSelection'
import NavDrawer, { type Translator } from '@/components/quran/NavDrawer'
import SurahIndex from '@/components/quran/SurahIndex'
import type { AnalysisSelection } from '@/lib/analysis'
import RangeComparison from '@/components/quran/RangeComparison'
import { ArrowRight, GitCompareArrows, Search, MoreHorizontal, ChevronDown } from 'lucide-react'
import QuranSearch, { type SearchStart } from '@/components/quran/QuranSearch'
import QuickSurahSearch from '@/components/quran/QuickSurahSearch'
import {
  PatternBG, IconMenu,
  IconTranslate, IconSortIndex,
} from '@/components/quran/Ornaments'

const LS = {
  get: <T,>(k: string, d: T): T => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d }
  },
  set: (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const round05 = (v: number) => Math.round(v * 20) / 20

export default function Home() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [page, setPage] = useState(() => {
    if (typeof window === 'undefined') return LS.get('mushaf.page', 1)
    const fromUrl = readPageNumber(window.location.search, window.location.pathname) ?? NaN
    return clamp(Number.isFinite(fromUrl) ? fromUrl : LS.get('mushaf.page', 1), 1, 604)
  })
  const [mode, setMode] = useState<'mushaf' | 'flow'>(() => {
    if (typeof window !== 'undefined') {
      if (readSurahNumber(window.location.search, window.location.pathname)) return 'flow'
      if (readPageNumber(window.location.search, window.location.pathname)) return 'mushaf'
    }
    return LS.get('mushaf.mode', 'flow')
  })
  const [surah, setSurah] = useState(() => {
    const value = typeof window !== 'undefined' ? readSurahNumber(window.location.search, window.location.pathname) ?? NaN : NaN
    return Number.isInteger(value) && value >= 1 && value <= 114 ? value : LS.get('mushaf.surah', 1)
  })
  const [showTrans, setShowTrans] = useState(() => LS.get('mushaf.showTrans', false))
  const [theme, setTheme] = useState<'paper' | 'night'>(() => LS.get('mushaf.theme', 'paper'))
  const [translator, setTranslator] = useState<Translator>(() => LS.get('mushaf.safavi-default.v1', false) ? LS.get('mushaf.tr', 's') : 's')
  const [scale, setScale] = useState(() => LS.get('mushaf.scale', 1))
  const [bookmarks, setBookmarks] = useState<number[]>(() => LS.get('mushaf.marks', []))
  const [pinnedSurahs, setPinnedSurahs] = useState<number[]>(() => LS.get('mushaf.pinned-surahs', []))
  const [recentSurahs, setRecentSurahs] = useState<number[]>(() => LS.get('mushaf.recent-surahs', []))
  const [drawerView, setDrawerView] = useState<'navigation' | 'tools'>('navigation')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [quickSearchOpen, setQuickSearchOpen] = useState(false)
  const [searchStart, setSearchStart] = useState<SearchStart | null>(null)
  const [occurrenceSearch, setOccurrenceSearch] = useState<AnalysisSelection | null>(null)
  const readingBeforeSearch = useRef<string | null>(null)
  const lastSearchUrl = useRef<string | null>(null)
  const writeSearchState = useCallback((state: SearchLinkState) => {
    const current = window.location.href
    const entering = !readSearchLink(current)
    if (entering) readingBeforeSearch.current = current
    const url = searchLink(current, state, process.env.NEXT_PUBLIC_DESKTOP === '1')
    lastSearchUrl.current = url.href
    if (url.href !== current) window.history[entering ? 'pushState' : 'replaceState'](entering ? { ...window.history.state, quranSearchEntry: true } : window.history.state, '', url)
  }, [])
  const changeSearchOpen = (open: boolean) => {
    setSearchOpen(open)
    if (!open && readSearchLink(window.location.href)) {
      if (window.history.state?.quranSearchEntry) window.history.back()
      else window.history.replaceState(window.history.state, '', readingBeforeSearch.current || readingUrl(new URL('/', window.location.href).href, mode, surah, page, process.env.NEXT_PUBLIC_DESKTOP === '1'))
    }
  }
  const [returnToSearch, setReturnToSearch] = useState(false)
  const [searchTarget, setSearchTarget] = useState<{ s: number; a: number; pos: number; align?: 'start' } | null>(null)
  const [sel, setSel] = useState<Selection | null>(null)
  const [analysisSelection, setAnalysisSelection] = useState<AnalysisSelection | null>(null)
  const [flash, setFlash] = useState<{ s: number; a: number; pos: number } | null>(null)
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
  const [mushafNavigationRevision, setMushafNavigationRevision] = useState(0)
  const [mushafContentRevision, setMushafContentRevision] = useState(0)
  const onMushafContentReady = useCallback(() => setMushafContentRevision(n => n + 1), [])
  const [panelMax, setPanelMax] = useState(false)
  const [sheetH, setSheetH] = useState(46)
  const [showIndex, setShowIndex] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [contextComparison, setContextComparison] = useState(false)
  const [comparisonSurah, setComparisonSurah] = useState(1)
  const [hiddenComparisonRoots, setHiddenComparisonRoots] = useState<Set<string>>(new Set())
  const [soloComparisonRoot, setSoloComparisonRoot] = useState<string | null>(null)
  const [comparisonRoots, setComparisonRoots] = useState<Record<string, number>>({})
  const [comparisonRoot, setComparisonRoot] = useState<string | null>(null)
  const [comparisonRange, setComparisonRange] = useState<{ s: number; from: number; to: number } | null>(null)

  const compareContext = useCallback((s: number, from: number, to: number) => {
    setComparisonSurah(s)
    setComparisonRange({ s, from, to })
    setComparisonRoot(null)
    setShowComparison(false)
    setContextComparison(true)
  }, [])

  useEffect(() => {
    if (!contextComparison || !sel || analysisSelection?.tab !== 'context' || !analysisSelection.from || !analysisSelection.to) return
    const { s, from, to } = analysisSelection
    setComparisonSurah(s)
    setComparisonRange(current => current?.s === s && current.from === from && current.to === to ? current : { s, from, to })
  }, [contextComparison, sel, analysisSelection])

  useEffect(() => {
    if (!contextComparison || showComparison || !comparisonRange) return
    let live = true
    const { s, from, to } = comparisonRange
    setComparisonRoots({})
    Promise.all([loadSurah(s), loadGlobalRoots()]).then(([data, roots]) => {
      if (live) setComparisonRoots(Object.fromEntries(compareRootRange(data, roots, from, to).map(row => [row.root, rootHue(row.root)])))
    }).catch(() => { if (live) setComparisonRoots({}) })
    return () => { live = false }
  }, [contextComparison, showComparison, comparisonRange])

  const mainRef = useRef<HTMLElement>(null)
  useVisibleSelection(mainRef, flash ?? analysisSelection ?? sel, !!sel && !panelMax && !showIndex && !showComparison, `${mode}:${page}:${surah}:${showTrans}:${loadingPage}:${mushafContentRevision}`)
  const focusComparisonRoot = useCallback((root: string) => { setSoloComparisonRoot(root); setSel(null) }, [])
  useComparisonHold(mainRef, !!comparisonRange && Object.keys(comparisonRoots).length > 0 && !showComparison && !showIndex, focusComparisonRoot)
  useEffect(() => { setHiddenComparisonRoots(new Set()); setSoloComparisonRoot(null) }, [comparisonRange?.s, comparisonRange?.from, comparisonRange?.to])
  const mutedComparisonRoots = useMemo(() => new Set(Object.keys(comparisonRoots).filter(root => soloComparisonRoot ? root !== soloComparisonRoot : hiddenComparisonRoots.has(root))), [comparisonRoots, hiddenComparisonRoots, soloComparisonRoot])
  const pinchRef = useRef<{ d: number; s: number } | null>(null)

  useEffect(() => { loadMeta().then(setMeta) }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    LS.set('mushaf.theme', theme)
  }, [theme])
  useEffect(() => {
    const color = !startupComplete ? '#faf4df' : theme === 'night' ? '#0e2a22' : '#f2ecdc'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }, [theme, startupComplete])
  useEffect(() => {
    LS.set('mushaf.page', page)
    if (readSearchLink(window.location.href)) return
    const url = readingUrl(window.location.href, mode, surah, page, process.env.NEXT_PUBLIC_DESKTOP === '1')
    window.history.replaceState(window.history.state, '', url.toString())
  }, [page, mode, surah])
  useEffect(() => { LS.set('mushaf.mode', mode) }, [mode])
  useEffect(() => { LS.set('mushaf.surah', surah) }, [surah])
  useEffect(() => { LS.set('mushaf.showTrans', showTrans) }, [showTrans])
  useEffect(() => { LS.set('mushaf.tr', translator); LS.set('mushaf.safavi-default.v1', true) }, [translator])
  useEffect(() => { LS.set('mushaf.scale', scale) }, [scale])
  useEffect(() => { LS.set('mushaf.marks', bookmarks) }, [bookmarks])

  const segs = useMemo(() => (meta ? meta.pages[page - 1] || [] : []), [meta, page])
  const curSurahN = mode === 'mushaf' ? (segs[0]?.s ?? 1) : surah
  useEffect(() => {
    if (!meta || loadingPage) return
    setRecentSurahs(previous => { const next = [curSurahN, ...previous.filter(n => n !== curSurahN && Number.isInteger(n) && n >= 1 && n <= 114)].slice(0, 12); LS.set('mushaf.recent-surahs', next); return next })
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

  // flow mode: load current surah (+ translation)
  useEffect(() => {
    if (mode !== 'flow' || flowSurah?.n === surah) return
    let live = true
    setLoadingPage(true)
    Promise.all([loadSurah(surah), loadTrans(surah)]).then(([d, translations]) => {
      if (!live) return
      setFlowSurah(d)
      setFlowTrans(translations)
      setLoadingPage(false)
      const pg = d.v[0]?.p
      if (pg) setPage(pg)
    })
    return () => { live = false }
  }, [mode, surah])

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
      setScale(s => round05(clamp(s + (e.deltaY < 0 ? 0.1 : -0.1), 0.55, 1.9)))
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [meta])

  const requestMushafPage = useCallback((p: number) => {
    setPage(clamp(p, 1, 604))
    setMushafNavigationRevision(n => n + 1)
  }, [])

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
      setSearchTarget({ ...target, align: 'start' })
    } else requestMushafPage(destination)
    setSel(null)
    setComparisonRoot(null)
  }, [mode, meta, requestMushafPage])

  const tapWord = useCallback((word: Selection) => {
    if (!showComparison && !showIndex && comparisonRange?.s === word.s && word.root && comparisonRoots[word.root] !== undefined) {
      const root = word.root
      setHiddenComparisonRoots(current => {
        const next = new Set(current)
        if (soloComparisonRoot && root !== soloComparisonRoot || next.has(root)) next.delete(root)
        else next.add(root)
        return next
      })
      setSoloComparisonRoot(null)
      setSel(null)
      return
    }
    writeVerseAddress(word)
    setFlash(null)
    setComparisonRoot(null)
    setSel(current => current?.s === word.s && current.a === word.a && current.pos === word.pos && (current.part ?? 'stem') === (word.part ?? 'stem') ? null : word)
  }, [comparisonRange, comparisonRoots, soloComparisonRoot, showComparison, showIndex])

  const goSurah = useCallback((n: number) => {
    pullArrival.current = null
    const nn = clamp(n, 1, 114)
    if (!meta) return
    if (mode === 'mushaf') goPage(meta.surahs[nn - 1].pg)
    else setSurah(nn)
  }, [meta, mode, goPage])

  const goVerse = useCallback((s: number, a: number, pos = 1, align?: 'start') => {
    pullArrival.current = null
    loadSurah(s).then(d => {
      const v = d.v[a - 1]
      if (v) {
        if (mode === 'mushaf') requestMushafPage(v.p)
        else setSurah(s)
        writeVerseAddress({ s, a, pos })
        setFlash({ s, a, pos })
        setSearchTarget({ s, a, pos, align })
      }
    })
  }, [mode, requestMushafPage])

  useEffect(() => {
    const restore = () => {
      const search = readSearchLink(window.location.href)
      if (search) {
        if (lastSearchUrl.current === window.location.href) { setTranslator(search.translator); setSearchOpen(true); return }
        setSearchStart({ query: search.query, mode: search.mode, surahs: search.surahs, revision: Date.now(), state: search })
        setOccurrenceSearch(search.occurrence); setTranslator(search.translator); setSearchOpen(true)
        return
      }
      setSearchOpen(false)
      const target = readVerseAddress(window.location.search, window.location.pathname)
      if (target) {
        setMode('flow')
        setSurah(target.s)
        setSel(null)
        loadSurah(target.s).then(data => {
          const verse = data.v[target.a - 1]
          if (!verse) return
          const pos = Math.min(target.pos, verse.w.length)
          setFlash({ ...target, pos })
          setSearchTarget({ ...target, pos })
        })
      } else {
        const s = readSurahNumber(window.location.search, window.location.pathname) ?? 0, p = readPageNumber(window.location.search, window.location.pathname) ?? 0
        setSel(null); setFlash(null)
        if (s >= 1 && s <= 114) { setMode('flow'); setSurah(s) }
        else if (p >= 1 && p <= 604) { setMode('mushaf'); requestMushafPage(p) }
      }
    }
    restore()
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [requestMushafPage])

  useEffect(() => {
    if (!searchTarget || loadingPage || (mode === 'flow' && flowSurah?.n !== searchTarget.s)) return
    const main = mainRef.current
    const reading = mode === 'flow' ? main?.querySelector('.surah-pull-content') : main?.querySelector('[data-reading-scroll]')
    const word = reading?.querySelector<HTMLElement>(`[data-surah="${searchTarget.s}"][data-ayah="${searchTarget.a}"][data-pos="${searchTarget.pos}"]`)
    if (!main || !word) return
    const scroll = main.querySelector<HTMLElement>('[data-reading-scroll]') ?? main
    const frame = requestAnimationFrame(() => {
      const top = scroll.scrollTop + word.getBoundingClientRect().top - scroll.getBoundingClientRect().top - (searchTarget.align === 'start' ? 12 : scroll.clientHeight * 0.35)
      scroll.scrollTo({ top: Math.max(0, top), behavior: searchTarget.align === 'start' || quickSearchOpen || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      setSearchTarget(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [searchTarget, quickSearchOpen, loadingPage, mode, page, surah, flowSurah?.n, pageData, mushafContentRevision])

  // panel jump: keep panel open, highlight target
  const panelJump = useCallback((s: number, a: number, pos: number, p: number) => {
    writeVerseAddress({ s, a, pos })
    if (mode === 'mushaf') requestMushafPage(p)
    else setSurah(s)
    setFlash({ s, a, pos })
  }, [mode, requestMushafPage])

  // jump to root occurrence in another surah; retarget panel selection
  const jumpSurahRoot = useCallback((surahN: number, root: string) => {
    loadSurah(surahN).then(d => {
      const occ = d.ri[root]
      if (!occ || occ.length === 0) return
      const [a, pos] = occ[0]
      const w = d.v[a - 1]?.w[pos - 1]
      if (!w) return
      setSel({ s: surahN, a, pos, ...wordTarget(w), root })
      if (mode === 'mushaf') requestMushafPage(d.v[a - 1].p)
      else setSurah(surahN)
      setFlash({ s: surahN, a, pos })
    })
  }, [mode, requestMushafPage])

  // SurahIndex: pick a root from the index page → open RootPanel for first occurrence
  // NOTE: the index STAYS OPEN — user wants to return to the same scroll position
  // after closing the panel. The RootPanel renders at a higher z-index than the
  // drawer so it overlays the index.
  const pickRootFromIndex = useCallback((root: string, sourceSurah?: number) => {
    const targetSurah = sourceSurah ?? (mode === 'mushaf' ? curSurahN : surah)
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
  }, [mode, curSurahN, surah])

  // The sheet handles its active tab's keyboard navigation.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (searchOpen || drawerOpen || showIndex || showComparison || (e.target instanceof HTMLElement && e.target.matches('input, textarea, select'))) return
      if (sel) return
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
      setScale(round05(clamp(pinchRef.current.s * ratio, 0.55, 1.9)))
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
  const switchMode = (m: 'mushaf' | 'flow') => {
    if (m === 'flow') setSurah(curSurahN)
    setMode(m)
  }

  return (
    <>
    {!startupComplete && <StartupSplash leaving={startupLeaving} onHoldChange={held => { setStartupHeld(held); if (held) setStartupLeaving(false) }} />}
    {meta && <div className={`h-dvh overflow-hidden flex flex-col relative${drawerOpen || showIndex || showComparison ? ' has-overlay' : ''}`} style={{ background: 'var(--paper)' }}>
      <PatternBG />

      <QuranSearch key={searchStart?.revision ?? 0} onStateChange={writeSearchState} initialSearch={searchStart} occurrenceFilter={occurrenceSearch} onClearOccurrenceFilter={() => setOccurrenceSearch(null)} translator={translator} open={searchOpen} onOpenChange={changeSearchOpen} meta={meta} currentSurah={curSurahN} onPick={(s, a, pos) => {
        setReturnToSearch(true); setSearchOpen(false); setQuickSearchOpen(false); setSel(null); setComparisonRoot(null); goVerse(s, a, pos)
      }} />

      {/* ===== Top bar =====
          Removed the prev/next-surah chevrons (< >) — user said the
          constant-surah-jumping UX was weird. Surah switching now happens
          via the drawer (tap the title) or the slider in the drawer. */}
      <header className="relative z-10 shrink-0 flex items-center gap-1 px-2 sm:px-4 border-b"
        style={{
          borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--paper) 82%, transparent)',
          backdropFilter: 'blur(8px)', paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: '0.5rem',
        }}>
        {quickSearchOpen ? <QuickSurahSearch surah={meta.surahs[curSurahN - 1]} onClose={() => setQuickSearchOpen(false)}
          onPick={(s, a, pos) => { setSel(null); goVerse(s, a, pos) }}
          onAdvanced={start => { setOccurrenceSearch(null); setSearchStart({ ...start, revision: Date.now() }); setSearchOpen(true) }} /> : <>
        <button className="icon-btn" onClick={() => { setDrawerView('tools'); setDrawerOpen(true) }} aria-label="ابزارها و تنظیمات" title="ابزارها و تنظیمات"><MoreHorizontal size={22} /></button>

        <button className="reader-surah-link flex-1 min-w-0" aria-label="بازکردن فهرست سوره‌ها" aria-haspopup="dialog" aria-expanded={drawerOpen && drawerView === 'navigation'} onClick={() => { setDrawerView('navigation'); setDrawerOpen(true) }}>
          <span className="font-bold text-[14px] sm:text-[15px] truncate" style={{ color: 'var(--ink)' }}>
            {mode === 'mushaf' ? pageInfo.names : meta.surahs[surah - 1]?.ar}
          </span><ChevronDown size={16} aria-hidden="true" />
        </button>

        <button className="icon-btn" aria-label="جست‌وجو در قرآن" title="جست‌وجو در قرآن" onClick={() => { setSel(null); setQuickSearchOpen(true) }}><Search size={20} /></button>

          <button className="icon-btn" aria-label="نمایش ترجمه"
            title="ترجمه"
            aria-pressed={showTrans}
            style={{ color: showTrans ? 'var(--sage)' : undefined, background: showTrans ? 'var(--word-root)' : undefined }}
            onClick={() => setShowTrans(v => !v)}>
            <IconTranslate />
          </button>


        </>}
      </header>

      {returnToSearch && !searchOpen && (
        <div className="relative z-10 shrink-0 flex items-center justify-between gap-2 px-3 py-1 border-b" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
          <button type="button" className="chip gap-1.5 py-1.5" onClick={() => { setSel(null); setSearchOpen(true) }}>
            <ArrowRight size={14} aria-hidden="true" /> بازگشت به نتایج جست‌وجو
          </button>
          <button type="button" className="icon-btn sm" aria-label="بستن نوار بازگشت به جست‌وجو" onClick={() => setReturnToSearch(false)}>×</button>
        </div>
      )}

      {!showComparison && comparisonRange?.s === curSurahN && (contextComparison || Object.keys(comparisonRoots).length > 0) && (
        <div className="relative z-10 flex flex-wrap items-center gap-2 px-3 py-2 text-xs" style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
          <span className="comparison-range-band rounded px-2 py-1">درون بازه {toFa(comparisonRange.from)}–{toFa(comparisonRange.to)}</span>
          {soloComparisonRoot ? <button className="chip" aria-label="نمایش همهٔ ریشه‌ها" onClick={() => { setSoloComparisonRoot(null); setHiddenComparisonRoots(new Set()) }}>فقط {soloComparisonRoot.split('').join(' ')} ×</button>
            : hiddenComparisonRoots.size > 0 ? <button className="chip" aria-label="روشن کردن همهٔ ریشه‌ها" onClick={() => setHiddenComparisonRoots(new Set())}>{toFa(hiddenComparisonRoots.size)} ریشه پنهان · بازنشانی</button> : <span>هر ریشه یک رنگ</span>}
          <span className="basis-full" style={{ color: 'var(--ink-soft)' }}>تپ: خاموش/روشن · نگه‌داشتن: فقط این ریشه</span>
          <button className="underline mr-auto" onClick={() => setShowComparison(true)}>بازگشت به مقایسه</button>
          <button aria-label="پاک کردن هایلایت مقایسه" onClick={() => { setContextComparison(false); setComparisonRoot(null); setComparisonRoots({}); setComparisonRange(null); setSel(null) }}>×</button>
        </div>
      )}
      {/* ===== Main + side root panel ===== */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col lg:flex-row lg:items-stretch">
        <main ref={mainRef} className="flex-1 min-h-0 min-w-0 flex flex-col quran-main"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
          {mode === 'mushaf' ? (
            <ContinuousMushaf meta={meta} page={page} navigationRevision={mushafNavigationRevision}
              onPageChange={setPage} onContentReady={onMushafContentReady} showTrans={showTrans} translator={translator} scale={scale}
              selection={sel ? analysisSelection ?? sel : null}
              highlightRoot={sel ? (analysisSelection?.tab === 'root' ? analysisSelection.root : null) : comparisonRoot}
              analysisSelection={sel ? analysisSelection : null} comparisonRange={comparisonRange}
              comparisonRoots={comparisonRoots} mutedComparisonRoots={mutedComparisonRoots} flash={flash} onOpenSurahs={() => { setDrawerView('navigation'); setDrawerOpen(true) }} onWordTap={tapWord} />
          ) : (
            <SurahPull key={`f-${surah}`} surah={surah} meta={meta.surahs} fontSize={flowFont} showTrans={showTrans} translator={translator}
              ready={!loadingPage && flowSurah?.n === surah}
              enabled={!sel && !drawerOpen && !searchOpen && !showComparison && !showIndex}
              arriveAtEnd={pullArrival.current?.s === surah && pullArrival.current.end}
              onNavigate={async (n, end) => {
                // Keep the completed preview visible until all destination data is ready.
                const [data, translations] = await Promise.all([loadSurah(n), loadTrans(n), document.fonts.ready])
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
                    analysisSelection={sel ? analysisSelection : null}
                    comparisonRange={comparisonRange}
                    comparisonRoots={comparisonRoots} mutedComparisonRoots={mutedComparisonRoots}
                    flash={flash}
                    onOpenSurahs={() => { setDrawerView('navigation'); setDrawerOpen(true) }} onWordTap={tapWord}
                  />
                )}
              </FlowSurface>
            </SurahPull>
          )}
        </main>

        {sel && (showIndex || showComparison
          ? createPortal(
              <RootPanel
            onOpenOccurrences={(selection, scope) => { setSearchStart({ query: selection.root || selection.text, mode: selection.tab === 'root' ? 'root' : 'text', surahs: scope === 'surah' ? [selection.s] : [], revision: Date.now() }); setOccurrenceSearch(selection); setSearchOpen(true) }}
            onSelectionChange={setAnalysisSelection}
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
            onOpenOccurrences={(selection, scope) => { setSearchStart({ query: selection.root || selection.text, mode: selection.tab === 'root' ? 'root' : 'text', surahs: scope === 'surah' ? [selection.s] : [], revision: Date.now() }); setOccurrenceSearch(selection); setSearchOpen(true) }}
            onSelectionChange={setAnalysisSelection}
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
          onShowKeywords={() => { setDrawerOpen(false); setShowIndex(true) }}
          onCompare={() => { setDrawerOpen(false); setContextComparison(false); setComparisonSurah(curSurahN); setShowComparison(true); setSel(null) }}
          meta={meta}
          bookmarks={bookmarks}
          recentSurahs={recentSurahs}
          pinnedSurahs={pinnedSurahs}
          onTogglePin={n => setPinnedSurahs(old => { const next = old.includes(n) ? old.filter(s => s !== n) : [...old, n]; LS.set('mushaf.pinned-surahs', next); return next })}
          onClearRecent={() => { setRecentSurahs([]); LS.set('mushaf.recent-surahs', []) }}
          onAdvancedSearch={() => { setDrawerOpen(false); setOccurrenceSearch(null); setSel(null); setSearchStart({ query: '', mode: 'text', surahs: [], revision: Date.now() }); setSearchOpen(true) }}
          theme={theme}
          mode={mode}
          onMode={switchMode}
          translator={translator}
          scale={scale}
          currentSurah={curSurahN}
          onClose={() => setDrawerOpen(false)}
          onGoPage={goPage}
          onGoSurah={goSurah}
          onGoVerse={(s, a) => goVerse(s, a, 1, 'start')}
          onRemoveBookmark={p => setBookmarks(b => b.filter(x => x !== p))}
          onTheme={setTheme}
          onTranslator={setTranslator}
          onScale={setScale}
        />
      )}

      {/* ===== Sorted Surah Index drawer =====
          Rendered as a right-side drawer that stays open while the
          RootPanel is open. The activeRoot prop highlights the currently
          selected row in the list so the user knows where they are. */}
      {showComparison && (
        <RangeComparison key={comparisonSurah} surahN={comparisonSurah} meta={meta}
          onRangeChange={setComparisonRange}
          onRootsChange={setComparisonRoots}
          initialRange={comparisonRange?.s === comparisonSurah ? comparisonRange : null}
          onClose={() => { setShowComparison(false); setSel(null) }}
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
