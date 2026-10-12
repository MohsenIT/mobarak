'use client'

import { useEffect, useRef } from 'react'
import type { SurahData, SurahMeta, Translations } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import { AyahMarker, Bismillah, SurahBand } from './Ornaments'
import QuranText from './QuranText'
import { matchesAnalysis, type AnalysisSelection } from '@/lib/analysis'
import type { Selection } from './MushafPage'

interface Props {
  sm: SurahMeta
  surah: SurahData
  trans: Translations | null
  showTrans: boolean
  translator: 'a' | 'f' | 'm'
  fontSize: number
  selection: Selection | null
  comparisonRange?: { s: number; from: number; to: number } | null
  analysisSelection?: AnalysisSelection | null
  highlightRoot: string | null
  flash: { s: number; a: number; pos: number } | null
  onWordTap: (sel: Selection) => void
}

/** Continuous, flowing surah view (متن پیوسته) */
export default function FlowPage({ sm, surah, trans, showTrans, translator, fontSize, selection, highlightRoot, comparisonRange, analysisSelection, flash, onWordTap }: Props) {
  const textRef = useRef<HTMLParagraphElement>(null)
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
      <p ref={textRef} className="font-quran text-justify mt-2" dir="rtl"
        style={{ fontSize, lineHeight: 2.05, color: 'var(--ink)' }}>
        {surah.v.map(v => (
          <span key={v.n}>
            {v.w.map((w, i) => {
              const isFlash = flash && flash.s === surah.n && flash.a === v.n && flash.pos === i + 1
              const isSelected = selection?.s === surah.n && selection.a === v.n && selection.pos === i + 1
              const isSameRoot = highlightRoot && w.r === highlightRoot
              const isAnalysis = analysisSelection?.tab !== 'root' && matchesAnalysis(analysisSelection, surah.n, v.n, i + 1, w)
              return (
                <span key={i}>
                  <span
                    data-ayah={v.n}
                    data-pos={i + 1}
                    className={`quran-word${isFlash ? ' flash' : ''}${isSameRoot ? ' same-root' : ''}${isSameRoot && comparisonRange?.s === surah.n ? (v.n >= comparisonRange.from && v.n <= comparisonRange.to ? ' range-inside' : ' range-outside') : ''}${isAnalysis ? ' analysis-selected' : ''}${isSelected && (!analysisSelection || analysisSelection.tab === 'root' || analysisSelection.tab === 'word') ? ' selected-word' : ''}`}
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => onWordTap({ s: surah.n, a: v.n, pos: i + 1, text: w.t, root: w.r ?? null })}
                  ><QuranText text={w.t} /></span>{' '}
                </span>
              )
            })}
            <AyahMarker n={v.n} />{' '}
          </span>
        ))}
      </p>

      {showTrans && trans && (
        <div className="mt-6 flex flex-col" style={{ borderTop: '1px solid var(--line-strong)' }}>
          <p className="text-xs font-medium py-3" style={{ color: 'var(--ink-faint)' }}>ترجمهٔ آیات</p>
          {surah.v.map(v => {
            const t = trans[String(v.n)]?.[translator]
            if (!t) return null
            return (
              <p key={v.n} className="py-2.5 text-justify"
                style={{ color: 'var(--ink-soft)', fontSize: 14.5, lineHeight: 2, borderBottom: '1px solid var(--line)' }}>
                <span className="chip ml-2" style={{ verticalAlign: 'middle' }}>{toFa(v.n)}</span>
                {t}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}
