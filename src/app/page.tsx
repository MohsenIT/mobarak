'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Meta, SurahData, Translations } from '@/lib/quran'
import { loadMeta, loadSurah, loadTrans, toFa } from '@/lib/quran'
import MushafPage, { type Selection } from '@/components/quran/MushafPage'
import FlowPage from '@/components/quran/FlowPage'
import RootPanel from '@/components/quran/RootPanel'
import NavDrawer, { type Translator } from '@/components/quran/NavDrawer'
import SurahIndex from '@/components/quran/SurahIndex'
import {
  PatternBG, IconMenu, IconStar,
  IconTranslate, IconSortIndex, Bismillah,
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
    const q = new URLSearchParams(window.location.search).get('p')
    const fromUrl = q ? parseInt(q, 10) : NaN
    return clamp(Number.isFinite(fromUrl) ? fromUrl : LS.get('mushaf.page', 1), 1, 604)
  })
  const [mode, setMode] = useState<'mushaf' | 'flow'>(() => LS.get('mushaf.mode', 'flow'))
  const [surah, setSurah] = useState(() => LS.get('mushaf.surah', 1))
  const [showTrans, setShowTrans] = useState(() => LS.get('mushaf.showTrans', false))
  const [theme, setTheme] = useState<'paper' | 'night'>(() => LS.get('mushaf.theme', 'paper'))
  const [translator, setTranslator] = useState<Translator>(() => LS.get('mushaf.tr', 'f'))
  const [scale, setScale] = useState(() => LS.get('mushaf.scale', 1))
  const [bookmarks, setBookmarks] = useState<number[]>(() => LS.get('mushaf.marks', []))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sel, setSel] = useState<Selection | null>(null)
  const [flash, setFlash] = useState<{ s: number; a: number; pos: number } | null>(null)
  const [pageData, setPageData] = useState<Map<number, SurahData>>(new Map())
  const [flowSurah, setFlowSurah] = useState<SurahData | null>(null)
  const [flowTrans, setFlowTrans] = useState<Translations | null>(null)
  const [loadingPage, setLoadingPage] = useState(true)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [panelMax, setPanelMax] = useState(false)
  const [showIndex, setShowIndex] = useState(false)

  const frameRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const pinchRef = useRef<{ d: number; s: number } | null>(null)

  useEffect(() => { loadMeta().then(setMeta) }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme; LS.set('mushaf.theme', theme) }, [theme])
  useEffect(() => {
    LS.set('mushaf.page', page)
    const url = new URL(window.location.href)
    url.searchParams.set('p', String(page))
    window.history.replaceState(null, '', url.toString())
  }, [page])
  useEffect(() => { LS.set('mushaf.mode', mode) }, [mode])
  useEffect(() => { LS.set('mushaf.surah', surah) }, [surah])
  useEffect(() => { LS.set('mushaf.showTrans', showTrans) }, [showTrans])
  useEffect(() => { LS.set('mushaf.tr', translator) }, [translator])
  useEffect(() => { LS.set('mushaf.scale', scale) }, [scale])
  useEffect(() => { LS.set('mushaf.marks', bookmarks) }, [bookmarks])

  const segs = useMemo(() => (meta ? meta.pages[page - 1] || [] : []), [meta, page])
  const curSurahN = mode === 'mushaf' ? (segs[0]?.s ?? 1) : surah

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
    if (mode !== 'flow') return
    let live = true
    setLoadingPage(true)
    loadSurah(surah).then(d => {
      if (!live) return
      setFlowSurah(d)
      setLoadingPage(false)
      const pg = d.v[0]?.p
      if (pg) setPage(pg)
    })
    loadTrans(surah).then(t => live && setFlowTrans(t))
    return () => { live = false }
  }, [mode, surah])

  // measure mushaf frame for font fitting
  useEffect(() => {
    if (!frameRef.current || mode !== 'mushaf') return
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect
      setBox({ w: r.width, h: r.height })
    })
    ro.observe(frameRef.current)
    return () => ro.disconnect()
  }, [meta, mode])

  // flash cleanup
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(t)
  }, [flash])

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

  const goPage = useCallback((p: number) => {
    setPage(clamp(p, 1, 604))
  }, [])

  const goSurah = useCallback((n: number) => {
    const nn = clamp(n, 1, 114)
    if (!meta) return
    if (mode === 'mushaf') goPage(meta.surahs[nn - 1].pg)
    else setSurah(nn)
  }, [meta, mode, goPage])

  const goVerse = useCallback((s: number, a: number, pos = 1) => {
    loadSurah(s).then(d => {
      const v = d.v[a - 1]
      if (v) {
        if (mode === 'mushaf') setPage(v.p)
        else setSurah(s)
        setFlash({ s, a, pos })
      }
    })
  }, [mode])

  // panel jump: keep panel open, highlight target
  const panelJump = useCallback((s: number, a: number, pos: number, p: number) => {
    if (mode === 'mushaf') setPage(p)
    else setSurah(s)
    setFlash({ s, a, pos })
  }, [mode])

  // jump to root occurrence in another surah; retarget panel selection
  const jumpSurahRoot = useCallback((surahN: number, root: string) => {
    loadSurah(surahN).then(d => {
      const occ = d.ri[root]
      if (!occ || occ.length === 0) return
      const [a, pos] = occ[0]
      const w = d.v[a - 1]?.w[pos - 1]
      if (!w) return
      setSel({ s: surahN, a, pos, text: w.t, root })
      if (mode === 'mushaf') setPage(d.v[a - 1].p)
      else setSurah(surahN)
      setFlash({ s: surahN, a, pos })
    })
  }, [mode])

  // SurahIndex: pick a root from the index page → open RootPanel for first occurrence
  // NOTE: the index STAYS OPEN — user wants to return to the same scroll position
  // after closing the panel. The RootPanel renders at a higher z-index than the
  // drawer so it overlays the index.
  const pickRootFromIndex = useCallback((root: string) => {
    const targetSurah = mode === 'mushaf' ? curSurahN : surah
    loadSurah(targetSurah).then(d => {
      const occ = d.ri[root]
      if (!occ || occ.length === 0) return
      const [a, pos] = occ[0]
      const w = d.v[a - 1]?.w[pos - 1]
      if (!w) return
      setSel({ s: targetSurah, a, pos, text: w.t, root })
      // deliberately NOT calling setShowIndex(false) — index stays open
      setFlash({ s: targetSurah, a, pos })
    })
  }, [mode, curSurahN, surah])

  // Navigate to the previous/next ROOT in the current surah.
  //
  // Per user request: when a word with a root is selected, ArrowRight
  // jumps to the previous root and ArrowLeft to the next root (RTL
  // convention: right = backward/previous, left = forward/next).
  //
  // Roots are ordered by their first occurrence (ayah, wordPos) so
  // "previous" = a root that first appeared earlier in the surah.
  // Words without a root are never destinations — only roots are
  // navigated to. Navigation wraps around (last → first, first → last).
  const goToRoot = useCallback((direction: 'prev' | 'next') => {
    if (!sel) return
    loadSurah(sel.s).then(d => {
      // Build a list of all roots in the surah, sorted by first occurrence
      const rootList = Object.entries(d.ri)
        .map(([root, occ]) => ({ root, firstOcc: occ[0] }))
        .filter(r => r.firstOcc)  // skip roots with no occurrences
        .sort((a, b) => {
          const [aA, aP] = a.firstOcc
          const [bA, bP] = b.firstOcc
          if (aA !== bA) return aA - bA
          return aP - bP
        })
      if (rootList.length === 0) return

      // Find the current root's index in the sorted list
      let currentIdx = -1
      if (sel.root) {
        currentIdx = rootList.findIndex(r => r.root === sel.root)
      }

      // Compute the new index, wrapping around
      let newIdx: number
      if (currentIdx === -1) {
        // Current word has no root — start from the beginning (next) or end (prev)
        newIdx = direction === 'prev' ? rootList.length - 1 : 0
      } else if (direction === 'prev') {
        newIdx = (currentIdx - 1 + rootList.length) % rootList.length
      } else {
        newIdx = (currentIdx + 1) % rootList.length
      }

      const newRoot = rootList[newIdx]
      if (!newRoot) return
      const [a, pos] = newRoot.firstOcc
      const w = d.v[a - 1]?.w[pos - 1]
      if (!w) return

      setSel({ s: sel.s, a, pos, text: w.t, root: newRoot.root })
      const verse = d.v[a - 1]
      if (verse) {
        if (mode === 'mushaf') setPage(verse.p)
        setFlash({ s: sel.s, a, pos })
      }
    })
  }, [sel, mode])

  // keyboard navigation (RTL: ArrowLeft = forward)
  //
  // When a word with a root is selected, arrows navigate between roots
  // (ArrowRight = previous root, ArrowLeft = next root). When no word
  // is selected, arrows navigate pages/surahs as before.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (drawerOpen || showIndex) return
      if (sel && sel.root) {
        // A word with a root is selected — navigate between roots
        if (e.key === 'ArrowRight') { e.preventDefault(); goToRoot('prev') }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); goToRoot('next') }
      } else {
        // No root selection — navigate pages/surahs
        if (e.key === 'ArrowLeft') mode === 'mushaf' ? goPage(page + 1) : goSurah(surah + 1)
        else if (e.key === 'ArrowRight') mode === 'mushaf' ? goPage(page - 1) : goSurah(surah - 1)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [page, surah, mode, drawerOpen, showIndex, goPage, goSurah, sel, goToRoot])

  // touch: pinch-zoom + swipe
  const touchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { d: touchDist(e.touches), s: scale }
      touchRef.current = null
    } else if (e.touches.length === 1) {
      const t = e.touches[0]
      touchRef.current = { x: t.clientX, y: t.clientY }
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (pinchRef.current && e.touches.length === 2) {
      const d = touchDist(e.touches)
      const ratio = d / pinchRef.current.d
      setScale(round05(clamp(pinchRef.current.s * ratio, 0.55, 1.9)))
    }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (pinchRef.current) { pinchRef.current = null; return }
    const start = touchRef.current
    touchRef.current = null
    if (!start || sel || mode !== 'mushaf') return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      if (dx < 0) goPage(page + 1)
      else goPage(page - 1)
    }
  }

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

  const mushafFont = useMemo(() => {
    if (box.w === 0 || box.h === 0) return 22
    return Math.max(11, Math.min(box.h / 29, box.w / 14, 48)) * scale
  }, [box, scale])

  const flowFont = 22 * scale
  const isBookmarked = bookmarks.includes(page)
  const toggleBookmark = () =>
    setBookmarks(b => (b.includes(page) ? b.filter(x => x !== page) : [...b, page]))

  const switchMode = (m: 'mushaf' | 'flow') => {
    if (m === 'flow') setSurah(curSurahN)
    setMode(m)
  }

  if (!meta) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-6" style={{ background: 'var(--paper)' }}>
        <PatternBG />
        <Bismillah size="clamp(22px, 5vw, 34px)" />
        <p className="text-sm animate-pulse" style={{ color: 'var(--ink-soft)' }}>در حال آماده‌سازی مصحف…</p>
      </div>
    )
  }

  return (
    <div className={`h-dvh flex flex-col relative${drawerOpen || showIndex ? ' has-overlay' : ''}`} style={{ background: 'var(--paper)' }}>
      <PatternBG />

      {/* ===== Top bar =====
          Removed the prev/next-surah chevrons (< >) — user said the
          constant-surah-jumping UX was weird. Surah switching now happens
          via the drawer (tap the title) or the slider in the drawer. */}
      <header className="relative z-10 flex items-center gap-1 px-2 sm:px-4 border-b"
        style={{
          borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--paper) 82%, transparent)',
          backdropFilter: 'blur(8px)', paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: '0.5rem',
        }}>
        <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="فهرست"><IconMenu /></button>

        <button className="flex-1 min-w-0 text-center" onClick={() => setDrawerOpen(true)}>
          <p className="font-bold text-[14px] sm:text-[15px] truncate" style={{ color: 'var(--ink)' }}>
            {mode === 'mushaf' ? pageInfo.names : meta.surahs[surah - 1]?.ar}
          </p>
          <p className="text-[10px] sm:text-[11px] truncate" style={{ color: 'var(--ink-faint)' }}>
            {mode === 'mushaf'
              ? `${pageInfo.juz ? `جزء ${toFa(pageInfo.juz)} · ` : ''}صفحه ${toFa(page)} از ${toFa(604)}`
              : `سوره ${toFa(surah)} از ${toFa(114)} · ${toFa(meta.surahs[surah - 1]?.vc ?? 0)} آیه · متن پیوسته`}
          </p>
        </button>

        {/* surah keyword index — opens the sorted-keywords page */}
        <button className="icon-btn" onClick={() => setShowIndex(true)} aria-label="فهرست کلیدواژه‌های سوره" title="فهرست کلیدواژه‌های سوره">
          <IconSortIndex />
        </button>

        <button className="icon-btn" onClick={toggleBookmark} aria-label="نشان کردن صفحه"
          style={{ color: isBookmarked ? 'var(--gold-deep)' : undefined }}>
          <IconStar filled={isBookmarked} />
        </button>

        {mode === 'flow' && (
          <button className="icon-btn" aria-label="نمایش ترجمه"
            title="ترجمه"
            style={{ color: showTrans ? 'var(--sage)' : undefined, background: showTrans ? 'var(--word-root)' : undefined }}
            onClick={() => setShowTrans(v => !v)}>
            <IconTranslate />
          </button>
        )}
      </header>

      {/* ===== Main + side root panel ===== */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col lg:flex-row lg:items-stretch">
        <main ref={mainRef} className="flex-1 min-h-0 min-w-0 flex flex-col quran-main"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          {mode === 'mushaf' ? (
            <div className="flex-1 min-h-0 flex items-stretch justify-center px-2 py-2 sm:px-6 sm:py-3">
              <div ref={frameRef} className="w-full max-w-[640px] min-h-0">
                <div key={page} className="mushaf-frame page-enter h-full overflow-hidden">
                  {loadingPage ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-sm animate-pulse" style={{ color: 'var(--ink-faint)' }}>…</p>
                    </div>
                  ) : (
                    <MushafPage
                      meta={meta}
                      page={page}
                      pageData={pageData}
                      fontSize={mushafFont}
                      selection={sel}
                      highlightRoot={sel?.root ?? null}
                      flash={flash}
                      onWordTap={setSel}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div key={`f-${surah}`} className="page-enter flex-1 min-h-0 overflow-y-auto nice-scroll">
              <div className="max-w-[720px] mx-auto px-4 py-4 pb-24">
                {loadingPage || !flowSurah ? (
                  <p className="text-sm animate-pulse text-center py-10" style={{ color: 'var(--ink-faint)' }}>…</p>
                ) : (
                  <FlowPage
                    sm={meta.surahs[surah - 1]}
                    surah={flowSurah}
                    trans={flowTrans}
                    showTrans={showTrans}
                    translator={translator}
                    fontSize={flowFont}
                    selection={sel}
                      highlightRoot={sel?.root ?? null}
                    flash={flash}
                    onWordTap={setSel}
                  />
                )}
              </div>
            </div>
          )}
        </main>

        {sel && (
          <RootPanel
            sel={sel}
            meta={meta}
            translator={translator}
            maximized={panelMax}
            onToggleMax={() => setPanelMax(v => !v)}
            onOpenIndex={() => { setPanelMax(false); setShowIndex(true) }}
            onClose={() => setSel(null)}
            onJump={panelJump}
            onJumpSurah={jumpSurahRoot}
            /* When the index drawer is also open, the panel needs to sit
               on top of it — pass a flag so the panel can bump its z-index. */
            stackedOverIndex={showIndex}
          />
        )}
      </div>

      {/* ===== Drawer ===== */}
      {drawerOpen && (
        <NavDrawer
          meta={meta}
          bookmarks={bookmarks}
          theme={theme}
          mode={mode}
          onMode={switchMode}
          translator={translator}
          scale={scale}
          currentSurah={curSurahN}
          onClose={() => setDrawerOpen(false)}
          onGoPage={goPage}
          onGoSurah={goSurah}
          onGoVerse={(s, a) => goVerse(s, a)}
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
      {showIndex && (
        <SurahIndex
          surahN={curSurahN}
          meta={meta}
          activeRoot={sel?.root ?? null}
          onClose={() => setShowIndex(false)}
          onPickRoot={pickRootFromIndex}
        />
      )}
    </div>
  )
}
