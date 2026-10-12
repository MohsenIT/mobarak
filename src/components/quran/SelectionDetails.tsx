'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SurahData, Translations } from '@/lib/quran'
import { morphologyLabel, toFa } from '@/lib/quran'
import { analysisOccurrences, type AnalysisSelection, type AnalysisTab } from '@/lib/analysis'
import QuranText from './QuranText'

type Index = { words: Record<string, Record<string, number>>; forms: Record<string, Record<string, number>> }
let indexPromise: Promise<Index> | null = null
function loadIndex() {
  if (!indexPromise) indexPromise = fetch('/data/analysis-index.json').then(r => { if (!r.ok) throw new Error('analysis index'); return r.json() }).catch(e => { indexPromise = null; throw e })
  return indexPromise
}

interface Props {
  tab: Exclude<AnalysisTab, 'root'>
  selection: AnalysisSelection
  surah: SurahData
  trans: Translations
  translator: 'a' | 'f' | 'm'
  onPick: (a: number, pos: number) => void
  comparisonRange?: { s: number; from: number; to: number } | null
}

export default function SelectionDetails({ tab, selection, surah, trans, translator, onPick, comparisonRange }: Props) {
  const [index, setIndex] = useState<Index | null>(null)
  const [indexError, setIndexError] = useState(false)
  useEffect(() => {
    let live = true
    loadIndex().then(data => { if (live) setIndex(data) }).catch(() => { if (live) setIndexError(true) })
    return () => { live = false }
  }, [])
  const occurrences = useMemo(() => analysisOccurrences(surah, selection), [surah, selection])
  const groups = useMemo(() => {
    const result = new Map<number, number[]>()
    for (const [a, pos] of occurrences) result.set(a, [...(result.get(a) ?? []), pos])
    return [...result.entries()]
  }, [occurrences])
  const verse = surah.v.find(v => v.n === selection.a)
  const distribution = tab === 'word' ? index?.words[selection.text] : selection.form ? index?.forms[selection.form] : undefined
  const total = distribution ? Object.values(distribution).reduce((a, b) => a + b, 0) : null
  const distinctRoots = new Set(occurrences.map(([a, pos]) => surah.v[a - 1].w[pos - 1].r).filter(Boolean)).size

  if (tab === 'form' && !selection.form) return <p className="text-sm leading-8">برای این واژه باب صرفی در منبع ثبت نشده است؛ باب از روی ریشه حدس زده نمی‌شود.</p>

  return (
    <>
      {tab === 'form' && (
        <div className="rounded-xl border p-3 mb-3 text-sm" style={{ borderColor: 'var(--line)' }}>
          <p>باب / ساخت صرفی: <b>{morphologyLabel(selection.form!)}</b> <span dir="ltr">({selection.form})</span></p>
          <p className="text-xs leading-6 mt-1">واژه‌های دارای همین باب در این سوره، با هر ریشه‌ای، انتخاب شده‌اند.</p>
          <a className="text-xs underline" href="https://corpus.quran.com" target="_blank" rel="noreferrer">Quranic Arabic Corpus</a>{' · '}
          <a className="text-xs underline" href="/data/morphology-source.txt" target="_blank" rel="noreferrer">حقوق و مشخصات داده</a>
        </div>
      )}
      {tab === 'word' && <p className="text-xs leading-6 mb-3">انتخاب این تب فقط همین واژه است. آمار و فهرست زیر برای تکرارهای دقیق همین صورت نوشتاری است.</p>}
      {tab === 'verse' ? (
        <div className="flex gap-2 mb-4">
          <div className="stat"><b>{toFa(verse?.w.length ?? 0)}</b><span>واژه در آیه</span></div>
          <div className="stat"><b>{toFa(distinctRoots)}</b><span>ریشهٔ متفاوت</span></div>
          <div className="stat"><b>{toFa(verse?.p ?? 0)}</b><span>صفحه · جزء {toFa(verse?.j ?? 0)}</span></div>
        </div>
      ) : (
        <div className="flex gap-2 mb-4">
          <div className="stat"><b>{toFa(occurrences.length)}</b><span>بار در سوره</span></div>
          <div className="stat"><b>{total === null ? '…' : toFa(total)}</b><span>بار در قرآن</span></div>
          <div className="stat"><b>{toFa(groups.length)}</b><span>آیه در این سوره</span></div>
        </div>
      )}
      {indexError && tab !== 'verse' && <p role="alert" className="text-xs mb-2">آمار کل قرآن بارگیری نشد؛ آمار این سوره نمایش داده می‌شود.</p>}
      {tab === 'word' && <p className="text-xs mb-3" style={{ color: 'var(--ink-soft)' }}>ترجمهٔ مستقل واژه در داده‌ها موجود نیست؛ ترجمهٔ آیهٔ حاوی آن در زیر آمده است.</p>}
      <h3 className="text-xs font-bold mb-2">{tab === 'verse' ? `متن و ترجمهٔ آیه ${toFa(selection.a)}` : tab === 'form' ? 'کاربردهای این باب و ترجمهٔ آیات' : 'کاربردهای این واژه و ترجمهٔ آیات'}</h3>
      <div className="flex flex-col gap-3">
        {groups.map(([a, positions]) => {
          const v = surah.v[a - 1]
          const inRange = comparisonRange?.s === surah.n && a >= comparisonRange.from && a <= comparisonRange.to
          return (
            <div key={a} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
              <button className="w-full text-right" onClick={() => onPick(a, positions[0])} aria-label={`رفتن به آیه ${toFa(a)}`}>
                <span className="chip mb-2">آیه {toFa(a)} · {tab === 'verse' ? 'همهٔ واژه‌ها' : `${toFa(positions.length)} کاربرد`}</span>
                <p className="font-quran text-justify" dir="rtl" style={{ fontSize: 20, lineHeight: 2 }}>
                  {v.w.map((w, i) => <span key={i}><span className={positions.includes(i + 1) ? `hl${comparisonRange?.s === surah.n ? (inRange ? ' range-inside' : ' range-outside') : ''}` : ''}><QuranText text={w.t} /></span>{' '}</span>)}
                </p>
              </button>
              {trans[String(a)]?.[translator] && <p className="text-sm leading-7 mt-2 pt-2 border-t text-justify" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>{trans[String(a)][translator]}</p>}
              {tab !== 'verse' && positions.length > 1 && <div className="flex flex-wrap gap-2 mt-2">{positions.map(pos => <button key={pos} className="chip" onClick={() => onPick(a, pos)}>واژه {toFa(pos)}</button>)}</div>}
            </div>
          )
        })}
      </div>
    </>
  )
}
