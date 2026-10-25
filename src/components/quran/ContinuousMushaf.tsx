'use client'
import {t} from '@/lib/i18n'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import { loadSurah, loadTrans, toFa, type Meta, type SurahData, type Translations, type Translator } from '@/lib/quran'
import MushafPage from './MushafPage'
import FlowPage from './FlowPage'

type ReadingProps = Pick<ComponentProps<typeof MushafPage>, 'selection' | 'highlightRoot' | 'analysisSelection' | 'comparisonRange' | 'comparisonRoots' | 'mutedComparisonRoots' | 'flash' | 'onWordTap' | 'onOpenSurahs'>
type Bundle = { data: Map<number, SurahData>; translations: Map<number, Translations> }
const bundles = new Map<string, Bundle>()
const totalPages = 604
const PAGE_GAP = 12

function PageContent({ meta, page, showTrans, translator, fontSize, flowFont, pageHeight, onReady, onMeasure, ...reading }: ReadingProps & {
  meta: Meta; page: number; showTrans: boolean; translator: Translator; fontSize: number; flowFont: number; pageHeight: number
  onReady: () => void; onMeasure: (page: number, height: number) => void
}) {
  const key = `${page}:${showTrans}:${translator}`
  const [bundle, setBundle] = useState<Bundle | null>(() => bundles.get(key) ?? null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let live = true
    setError(false)
    const cached = bundles.get(key)
    if (cached) { setBundle(cached); onReady(); return }
    setBundle(null)
    const surahs = [...new Set(meta.pages[page - 1].map(seg => seg.s))]
    Promise.all(surahs.map(async s => [s, await loadSurah(s), showTrans ? await loadTrans(s,translator) : null] as const))
      .then(entries => {
        const next = { data: new Map(entries.map(([s, data]) => [s, data])), translations: new Map(entries.flatMap(([s, , trans]) => trans ? [[s, trans] as const] : [])) }
        bundles.set(key, next)
        if (live) { setBundle(next); onReady() }
      }).catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [key, meta, page, showTrans, retry, onReady])
  useLayoutEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(entries => onMeasure(page, entries[0].borderBoxSize?.[0]?.blockSize ?? entries[0].contentRect.height))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [page, onMeasure])
  const ready = bundle && (!showTrans || bundle.translations.size > 0)
  return <div ref={ref} className="mushaf-frame continuous-mushaf-page" style={{ minHeight: pageHeight + 44 }}>
    {!ready ? <div className="flex items-center justify-center" style={{ minHeight: pageHeight }}>
      {error ? <button className="chip" onClick={() => setRetry(n => n + 1)}>{t("ui.34bee90de8")}</button>
        : <p className="text-xs" role="status" style={{ color: 'var(--ink-faint)' }}>{t("ui.d588c14502")}{' '}{toFa(page)}…</p>}
    </div> : showTrans ? <div className="px-3 py-4" style={{ minHeight: pageHeight }}>
      {meta.pages[page - 1].map(seg => {
        const data = bundle.data.get(seg.s)!
        return <FlowPage key={seg.s} sm={{ ...meta.surahs[seg.s - 1], b: seg.f === 1 && meta.surahs[seg.s - 1].b }}
          surah={{ ...data, v: data.v.filter(v => v.n >= seg.f && v.n <= seg.t) }} trans={bundle.translations.get(seg.s) ?? null}
          showTrans translator={translator} fontSize={flowFont} {...reading} />
      })}
    </div> : <div style={{ height: pageHeight }}>
      <MushafPage meta={meta} page={page} pageData={bundle.data} fontSize={fontSize} {...reading} />
    </div>}
    <div className="mushaf-page-divider" aria-label={t("ui.562b3acae1",{p0:(toFa(page))})}>
      <span>{t("ui.d2ef137028")}{' '}{toFa(page)}</span>
    </div>
  </div>
}

/** Keep cheap page placeholders, mounting Quran text only near the viewport. */
export default function ContinuousMushaf({ meta, page, navigationRevision, onPageChange, onContentReady, showTrans, translator, scale, ...reading }: ReadingProps & {
  meta: Meta; page: number; navigationRevision: number; onPageChange: (page: number) => void; onContentReady: () => void
  showTrans: boolean; translator: Translator; scale: number
}) {
  const scroll = useRef<HTMLDivElement>(null)
  const sections = useRef(new Map<number, HTMLElement>())
  const heights = useRef(new Map<number, number>())
  const current = useRef(page)
  const requested = useRef(page)
  requested.current = page
  const [size, setSize] = useState({ w: 360, h: 700 })
  const [range, setRange] = useState({ from: Math.max(1, page - 2), to: Math.min(totalPages, page + 2) })
  const frame = useRef(0)
  const report = useRef(onPageChange)
  report.current = onPageChange
  const fontSize = Math.max(11, Math.min(size.h / 29, Math.min(640, size.w - 16) / 14, 48)) * scale
  const pageHeight = Math.ceil(Math.max(size.h - 44, fontSize * 29))
  const rowHeight = pageHeight + 44 + PAGE_GAP
  const findPage = useCallback((y: number) => {
    let low = 1, high = totalPages
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      if ((sections.current.get(middle)?.offsetTop ?? Infinity) <= y) low = middle
      else high = middle - 1
    }
    return low
  }, [])
  const update = useCallback(() => {
    if (!scroll.current) return
    const el = scroll.current
    const first = findPage(el.scrollTop)
    const last = findPage(el.scrollTop + el.clientHeight)
    const next = { from: Math.max(1, first - 2), to: Math.min(totalPages, last + 2) }
    setRange(old => old.from === next.from && old.to === next.to ? old : next)
    const active = findPage(el.scrollTop + Math.min(120, el.clientHeight * .2))
    if (active !== current.current) { current.current = active; report.current(active) }
  }, [findPage])
  const schedule = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(update)
  }, [update])
  const measure = useCallback((p: number, height: number) => {
    heights.current.set(p, Math.ceil(height) + PAGE_GAP)
    schedule()
  }, [schedule])
  useLayoutEffect(() => {
    const el = scroll.current
    if (!el) return
    const resize = () => setSize(old => old.w === el.clientWidth && old.h === el.clientHeight ? old : { w: el.clientWidth, h: el.clientHeight })
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    return () => { observer.disconnect(); cancelAnimationFrame(frame.current) }
  }, [])
  useLayoutEffect(() => {
    const p = requested.current
    current.current = p
    setRange({ from: Math.max(1, p - 2), to: Math.min(totalPages, p + 2) })
    scroll.current?.scrollTo({ top: sections.current.get(p)?.offsetTop ?? 0, behavior: 'instant' })
    schedule()
  }, [navigationRevision, rowHeight, showTrans, schedule])

  return <div ref={scroll} data-reading-scroll data-continuous-mushaf className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden nice-scroll"
    onScroll={schedule} style={{ overscrollBehaviorY: 'contain' }}>
    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
      const visible = p >= range.from && p <= range.to
      return <section key={p} ref={el => { if (el) sections.current.set(p, el); else sections.current.delete(p) }}
        data-mushaf-page={p} aria-label={t("ui.f9119fddb7",{p0:(toFa(p))})} className="relative w-full max-w-[640px] mx-auto"
        style={{ minHeight: visible ? rowHeight : heights.current.get(p) ?? rowHeight, paddingBottom: PAGE_GAP }}>
        {visible && <PageContent key={`${p}:${showTrans}`} meta={meta} page={p} showTrans={showTrans} translator={translator}
          fontSize={fontSize} flowFont={22 * scale} pageHeight={pageHeight} onReady={onContentReady} onMeasure={measure} {...reading} />}
      </section>
    })}
  </div>
}
