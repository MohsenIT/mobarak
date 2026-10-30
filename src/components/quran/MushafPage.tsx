'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import type { Meta, SurahData, SurahMeta } from '@/lib/quran'
import { AyahMarker, Bismillah, SurahBand } from './Ornaments'
import SelectableWord from './SelectableWord'
import { rootColorStyle } from '@/lib/comparison-colors'
import { matchesAnalysis, type AnalysisSelection } from '@/lib/analysis'

export interface Selection {
  s: number
  a: number
  pos: number
  text: string
  root: string | null
  part?: 'prefix' | 'stem'
}

type LineItem =
  | { kind: 'band'; sm: SurahMeta }
  | { kind: 'bism' }
  | { kind: 'word'; s: number; a: number; pos: number; t: string; r: string | null; form?: string; wa?: boolean }
  | { kind: 'marker'; n: number }

interface Props {
  meta: Meta
  page: number
  pageData: Map<number, SurahData>
  fontSize: number
  selection: Selection | null
  mutedComparisonRoots?: Set<string>
  comparisonRoots?: Record<string, number>
  comparisonRange?: { s: number; from: number; to: number } | null
  analysisSelection?: AnalysisSelection | null
  highlightRoot: string | null
  flash: { s: number; a: number; pos: number } | null
  onOpenSurahs?: () => void
  onWordTap: (sel: Selection) => void
}

export default function MushafPage({ meta, page, pageData, fontSize, selection, highlightRoot, mutedComparisonRoots, comparisonRoots, comparisonRange, analysisSelection, flash, onWordTap, onOpenSurahs }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const lines = useMemo(() => {
    const map = new Map<number, LineItem[]>()
    const push = (ln: number, item: LineItem) => {
      if (!map.has(ln)) map.set(ln, [])
      map.get(ln)!.push(item)
    }
    const segs = meta.pages[page - 1] || []
    for (const seg of segs) {
      const surah = pageData.get(seg.s)
      if (!surah) continue
      const sm = meta.surahs[seg.s - 1]
      for (const v of surah.v) {
        if (v.n < seg.f || v.n > seg.t || v.p !== page) continue
        const vLines = v.w.map(w => w.l).filter((x): x is number => x != null)
        if (vLines.length === 0) continue
        if (v.n === 1) {
          const first = Math.min(...vLines)
          const headerLine = first - (sm.b ? 2 : 1)
          if (headerLine >= 1) push(headerLine, { kind: 'band', sm })
          if (sm.b && headerLine + 1 >= 1) push(headerLine + 1, { kind: 'bism' })
        }
        let lastLn = vLines[vLines.length - 1]
        v.w.forEach((w, i) => {
          const ln = w.l ?? lastLn
          push(ln, { kind: 'word', s: seg.s, a: v.n, pos: i + 1, t: w.t, r: w.r ?? null, form: w.form, wa: w.wa })
          lastLn = ln
        })
        push(lastLn, { kind: 'marker', n: v.n })
      }
    }
    return map
  }, [meta, page, pageData])

  const lineNums = Array.from({ length: 15 }, (_, i) => i + 1).filter(ln => {
    const items = lines.get(ln)
    return items && items.length > 0
  })

  // lines containing the highlighted root → edge ticks (at-a-glance root map)
  const tickIdx = useMemo(() => {
    if (!highlightRoot) return []
    const out: number[] = []
    lineNums.forEach((ln, idx) => {
      const items = lines.get(ln) || []
      if (items.some(it => it.kind === 'word' && it.r === highlightRoot)) out.push(idx)
    })
    return out
  }, [lines, lineNums, highlightRoot])

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let live = true
    const measure = () => {
      if (!live) return
      // Fit the whole page uniformly to its available width. A narrow phone
      // must never lose words beyond the left edge of a fixed mushaf line.
      frame.style.fontSize = `${fontSize}px`
      const pageLines = [...frame.querySelectorAll<HTMLElement>('.mushaf-line')]
      let fit = 1
      for (const line of pageLines) {
        const children = [...line.children] as HTMLElement[]
        const gap = parseFloat(getComputedStyle(line).columnGap) || 0
        const needed = children.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) + gap * Math.max(0, children.length - 1)
        if (needed > line.clientWidth && needed > 0) fit = Math.min(fit, line.clientWidth / needed)
      }
      if (fit < 1) frame.style.fontSize = `${Math.floor(fontSize * fit * 100) / 100}px`
      for (const line of pageLines) {
        line.removeAttribute('data-comparison-band')
        const comparisonWords = [...line.querySelectorAll<HTMLElement>('[data-comparison-range="true"]')]
        if (comparisonWords.length) {
          const bounds = line.getBoundingClientRect()
          const rects = comparisonWords.map(word => word.getBoundingClientRect())
          const left = Math.min(...rects.map(rect => rect.left))
          const right = Math.max(...rects.map(rect => rect.right))
          line.style.setProperty('--comparison-left', `${left - bounds.left}px`)
          line.style.setProperty('--comparison-width', `${right - left}px`)
          line.setAttribute('data-comparison-band', 'true')
        }
        line.removeAttribute('data-analysis-range')
        if (analysisSelection?.tab !== 'verse' && analysisSelection?.tab !== 'context') continue
        const words = [...line.querySelectorAll<HTMLElement>('.analysis-selected')].map(word => word.closest<HTMLElement>('[data-surah][data-ayah]') ?? word)
        words.push(...line.querySelectorAll<HTMLElement>('[data-analysis-marker]'))
        if (!words.length) continue
        const bounds = line.getBoundingClientRect()
        const rects = words.map(word => word.getBoundingClientRect())
        const left = Math.min(...rects.map(rect => rect.left))
        const right = Math.max(...rects.map(rect => rect.right))
        line.style.setProperty('--range-left', `${left - bounds.left}px`)
        line.style.setProperty('--range-width', `${right - left}px`)
        line.setAttribute('data-analysis-range', 'true')
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    document.fonts.ready.then(measure)
    return () => { live = false; observer.disconnect() }
  }, [analysisSelection, comparisonRange, pageData, fontSize, page])

  const n = lineNums.length

  return (
    <div
      ref={frameRef} data-quran-copy-surface
      className="font-quran relative h-full w-full flex flex-col justify-between px-3 py-2 sm:px-6 sm:py-3"
      style={{ fontSize, lineHeight: 1.75, color: 'var(--ink)' }}
      dir="rtl"
    >
      {tickIdx.map(idx => (
        <span
          key={`tick-${idx}`}
          className="root-tick"
          style={{ top: n > 1 ? `${(idx / (n - 1)) * 96 + 2}%` : '50%' }}
        />
      ))}
      {lineNums.map(ln => {
        const items = lines.get(ln)!
        if (items.length === 1 && items[0].kind === 'band')
          return <SurahBand key={ln} sm={items[0].sm} onNavigate={onOpenSurahs} />
        if (items.length === 1 && items[0].kind === 'bism')
          return <Bismillah key={ln} />
        return (
          <div key={ln} className="mushaf-line">
            {items.map((it, i) => {
              if (it.kind === 'marker') {
                const preceding = items.slice(0, i).reverse().find(item => item.kind === 'word')
                const inRange = preceding?.kind === 'word' && comparisonRange?.s === preceding.s && it.n >= comparisonRange.from && it.n <= comparisonRange.to
                const analysisMarker=preceding?.kind==='word' && analysisSelection?.s===preceding.s && (analysisSelection.tab==='verse' ? analysisSelection.a===preceding.a : analysisSelection.tab==='context' && analysisSelection.from!==undefined && analysisSelection.to!==undefined && preceding.a>=analysisSelection.from && preceding.a<=analysisSelection.to)
                return <span key={i} data-analysis-marker={analysisMarker?'true':undefined} data-comparison-range={inRange ? 'true' : undefined}><AyahMarker n={it.n} /></span>
              }
              if (it.kind !== 'word') return null
              const isFlash = flash && flash.s === it.s && flash.a === it.a && flash.pos === it.pos
              const activeSelection = analysisSelection?.tab === 'verse' || analysisSelection?.tab === 'context' ? null : analysisSelection?.tab === 'word' ? analysisSelection : selection
              const isSelected = activeSelection?.s === it.s && activeSelection.a === it.a && activeSelection.pos === it.pos
              const isSameRoot = highlightRoot && it.r === highlightRoot
              const hue = comparisonRange?.s === it.s && it.r ? comparisonRoots?.[it.r] : undefined
              const isAnalysis = analysisSelection?.tab !== 'root' && matchesAnalysis(analysisSelection, it.s, it.a, it.pos, { t: it.t, l: null, r: it.r ?? undefined, form: it.form })
              return (
                <SelectableWord word={{ t: it.t, l: null, r: it.r ?? undefined, wa: it.wa }} location={{ s: it.s, a: it.a, pos: it.pos }} selection={activeSelection} onWordTap={onWordTap}
                  key={i}
                  style={hue !== undefined ? rootColorStyle(hue) : undefined}
                  data-comparison-root={hue !== undefined ? it.r : undefined}
                  data-comparison-range={comparisonRange?.s === it.s && it.a >= comparisonRange.from && it.a <= comparisonRange.to ? 'true' : undefined}
                  className={`quran-word${hue !== undefined ? ` comparison-shared${mutedComparisonRoots?.has(it.r!) ? ' comparison-muted' : ''}${it.a >= comparisonRange!.from && it.a <= comparisonRange!.to ? ' comparison-inside' : ' comparison-outside'}` : ''}${isFlash ? ' flash' : ''}${isSameRoot ? ' same-root' : ''}${isSameRoot && comparisonRange?.s === it.s ? (it.a >= comparisonRange.from && it.a <= comparisonRange.to ? ' range-inside' : ' range-outside') : ''}${isAnalysis ? ' analysis-selected' : ''}${isSelected && (!analysisSelection || analysisSelection.tab === 'root' || analysisSelection.tab === 'word') ? ' selected-word' : ''}`}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
