'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import type { Meta, SurahData, SurahMeta } from '@/lib/quran'
import { AyahMarker, Bismillah, SurahBand } from './Ornaments'
import QuranText from './QuranText'
import { rootColorStyle } from '@/lib/comparison-colors'
import { matchesAnalysis, type AnalysisSelection } from '@/lib/analysis'

export interface Selection {
  s: number
  a: number
  pos: number
  text: string
  root: string | null
}

type LineItem =
  | { kind: 'band'; sm: SurahMeta }
  | { kind: 'bism' }
  | { kind: 'word'; s: number; a: number; pos: number; t: string; r: string | null; form?: string }
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
  onWordTap: (sel: Selection) => void
}

export default function MushafPage({ meta, page, pageData, fontSize, selection, highlightRoot, mutedComparisonRoots, comparisonRoots, comparisonRange, analysisSelection, flash, onWordTap }: Props) {
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
          push(ln, { kind: 'word', s: seg.s, a: v.n, pos: i + 1, t: w.t, r: w.r ?? null, form: w.form })
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
      for (const line of frame.querySelectorAll<HTMLElement>('.mushaf-line')) {
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
        const words = [...line.querySelectorAll<HTMLElement>('.analysis-selected')]
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
      ref={frameRef}
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
          return <SurahBand key={ln} ar={items[0].sm.ar} />
        if (items.length === 1 && items[0].kind === 'bism')
          return <Bismillah key={ln} />
        return (
          <div key={ln} className="mushaf-line">
            {items.map((it, i) => {
              if (it.kind === 'marker') {
                const preceding = items.slice(0, i).reverse().find(item => item.kind === 'word')
                const inRange = preceding?.kind === 'word' && comparisonRange?.s === preceding.s && it.n >= comparisonRange.from && it.n <= comparisonRange.to
                return <span key={i} data-comparison-range={inRange ? 'true' : undefined}><AyahMarker n={it.n} /></span>
              }
              if (it.kind !== 'word') return null
              const isFlash = flash && flash.s === it.s && flash.a === it.a && flash.pos === it.pos
              const isSelected = selection?.s === it.s && selection.a === it.a && selection.pos === it.pos
              const isSameRoot = highlightRoot && it.r === highlightRoot
              const hue = comparisonRange?.s === it.s && it.r ? comparisonRoots?.[it.r] : undefined
              const isAnalysis = analysisSelection?.tab !== 'root' && matchesAnalysis(analysisSelection, it.s, it.a, it.pos, { t: it.t, l: null, r: it.r ?? undefined, form: it.form })
              return (
                <span
                  key={i}
                  style={hue !== undefined ? rootColorStyle(hue) : undefined}
                  data-comparison-root={hue !== undefined ? it.r : undefined}
                  data-comparison-range={comparisonRange?.s === it.s && it.a >= comparisonRange.from && it.a <= comparisonRange.to ? 'true' : undefined}
                  data-surah={it.s} data-ayah={it.a} data-pos={it.pos}
                  className={`quran-word${hue !== undefined ? ` comparison-shared${mutedComparisonRoots?.has(it.r!) ? ' comparison-muted' : ''}${it.a >= comparisonRange!.from && it.a <= comparisonRange!.to ? ' comparison-inside' : ' comparison-outside'}` : ''}${isFlash ? ' flash' : ''}${isSameRoot ? ' same-root' : ''}${isSameRoot && comparisonRange?.s === it.s ? (it.a >= comparisonRange.from && it.a <= comparisonRange.to ? ' range-inside' : ' range-outside') : ''}${isAnalysis ? ' analysis-selected' : ''}${isSelected && (!analysisSelection || analysisSelection.tab === 'root' || analysisSelection.tab === 'word') ? ' selected-word' : ''}`}
                    aria-current={isSelected ? 'true' : undefined}
                  onClick={() => onWordTap({ s: it.s, a: it.a, pos: it.pos, text: it.t, root: it.r })}
                >
                  <QuranText text={it.t} />
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
