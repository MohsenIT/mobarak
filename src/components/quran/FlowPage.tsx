'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import type { Translator, SurahData, SurahMeta, Translations } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import { AyahMarker, Bismillah, SurahBand } from './Ornaments'
import SelectableWord from './SelectableWord'
import { rootColorStyle } from '@/lib/comparison-colors'
import FlowTranslations from './FlowTranslations'
import { matchesAnalysis, type AnalysisSelection } from '@/lib/analysis'
import type { Selection } from './MushafPage'

interface Props {
  sm: SurahMeta
  surah: SurahData
  trans: Translations | null
  showTrans: boolean
  translator: Translator
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

/** One reading surface for both the reader and adjacent-surah previews. */
export function FlowSurface({ children }: { children: ReactNode }) {
  return <div className="max-w-[720px] mx-auto px-4 py-4 pb-8">{children}</div>
}

/** Continuous, flowing surah view (متن پیوسته) */
export default function FlowPage({ sm, surah, trans, showTrans, translator, fontSize, selection, highlightRoot, mutedComparisonRoots, comparisonRoots, comparisonRange, analysisSelection, flash, onWordTap }: Props) {
  const textRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!flash || flash.s !== surah.n) return
    textRef.current?.querySelector(`[data-ayah="${flash.a}"][data-pos="${flash.pos}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [flash, surah.n])
  return (
    <div>
      <div style={{ fontSize: fontSize * 1.12 }}>
        <SurahBand ar={sm.ar} />
        {sm.b && <Bismillah size={`${fontSize}px`} />}
      </div>
      <div ref={textRef} className="font-quran text-justify mt-2 relative" dir="rtl"
        style={{ fontSize, lineHeight: 2.05, color: 'var(--ink)' }}>
        {surah.v.map(v => {
          const isRange = analysisSelection && (analysisSelection.tab === 'verse' || analysisSelection.tab === 'context') && matchesAnalysis(analysisSelection, surah.n, v.n, 1, v.w[0])
          const isComparisonRange = comparisonRange?.s === surah.n && v.n >= comparisonRange.from && v.n <= comparisonRange.to
          const continues = isComparisonRange ? v.n < comparisonRange.to
            : isRange && v.n < surah.vc && matchesAnalysis(analysisSelection, surah.n, v.n + 1, 1, v.w[0])
          return (
          <span key={v.n} data-verse={v.n}>
          <span className={`${isRange ? 'analysis-range' : ''}${isComparisonRange ? ' comparison-range-band' : ''}`} data-comparison-range={isComparisonRange ? 'true' : undefined}>
            {v.w.map((w, i) => {
              const hue = comparisonRange?.s === surah.n && w.r ? comparisonRoots?.[w.r] : undefined
              const isFlash = flash && flash.s === surah.n && flash.a === v.n && flash.pos === i + 1
              const activeSelection = analysisSelection?.tab === 'word' ? analysisSelection : selection
              const isSelected = activeSelection?.s === surah.n && activeSelection.a === v.n && activeSelection.pos === i + 1
              const isSameRoot = highlightRoot && w.r === highlightRoot
              const isAnalysis = analysisSelection?.tab !== 'root' && matchesAnalysis(analysisSelection, surah.n, v.n, i + 1, w)
              return (
                <span key={i}>
                  <SelectableWord word={w} location={{ s: surah.n, a: v.n, pos: i + 1 }} selection={activeSelection} onWordTap={onWordTap}
                    style={hue !== undefined ? rootColorStyle(hue) : undefined}
                    data-comparison-root={hue !== undefined ? w.r : undefined}
                    className={`quran-word${hue !== undefined ? ` comparison-shared${mutedComparisonRoots?.has(w.r!) ? ' comparison-muted' : ''}${v.n >= comparisonRange!.from && v.n <= comparisonRange!.to ? ' comparison-inside' : ' comparison-outside'}` : ''}${isFlash ? ' flash' : ''}${isSameRoot ? ' same-root' : ''}${isSameRoot && comparisonRange?.s === surah.n ? (v.n >= comparisonRange.from && v.n <= comparisonRange.to ? ' range-inside' : ' range-outside') : ''}${isAnalysis ? ' analysis-selected' : ''}${isSelected && (!analysisSelection || analysisSelection.tab === 'root' || analysisSelection.tab === 'word') ? ' selected-word' : ''}`}
                  />{' '}
                </span>
              )
            })}
            <AyahMarker n={v.n} />{continues ? ' ' : null}
          </span>{!continues ? ' ' : null}
          </span>
        )})}
        {showTrans && <FlowTranslations container={textRef} surah={surah} trans={trans} translator={translator} fontSize={fontSize} />}
      </div>


    </div>
  )
}
