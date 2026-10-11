'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Meta, SurahData } from '@/lib/quran'
import { compareRootRange, loadGlobalRoots, loadSurah, spacedRoot, toFa } from '@/lib/quran'
import { IconClose } from './Ornaments'

interface Props {
  surahN: number
  meta: Meta
  onClose: () => void
  onPickRoot: (root: string) => void
}

function parseVerse(value: string) {
  const normalized = value.trim().replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  return /^\d+$/.test(normalized) ? Number(normalized) : NaN
}

export default function RangeComparison({ surahN, meta, onClose, onPickRoot }: Props) {
  const [surah, setSurah] = useState<SurahData | null>(null)
  const [roots, setRoots] = useState<Record<string, Record<string, number>> | null>(null)
  const [error, setError] = useState(false)
  const [fromText, setFromText] = useState('1')
  const [toText, setToText] = useState(String(Math.min(5, meta.surahs[surahN - 1].vc - 1)))
  const [sort, setSort] = useState<'connection' | 'frequency' | 'keyword'>('connection')

  useEffect(() => {
    let live = true
    Promise.all([loadSurah(surahN), loadGlobalRoots()]).then(([s, r]) => {
      if (live) { setSurah(s); setRoots(r) }
    }).catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [surahN])

  const from = parseVerse(fromText)
  const to = parseVerse(toText)
  const vc = meta.surahs[surahN - 1].vc
  const valid = fromText.trim() !== '' && toText.trim() !== '' &&
    Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to <= vc && from <= to
  const whole = valid && from === 1 && to === vc
  const rows = useMemo(() => {
    if (!surah || !roots || !valid || whole) return []
    const result = compareRootRange(surah, roots, from, to)
    if (sort === 'frequency') result.sort((a, b) => Math.min(b.inside, b.outside) - Math.min(a.inside, a.outside) || b.connection - a.connection)
    if (sort === 'keyword') result.sort((a, b) => b.keyword - a.keyword || b.connection - a.connection)
    return result
  }, [surah, roots, valid, whole, from, to, sort])

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="surah-index-drawer" role="dialog" aria-modal="true" aria-label="ارتباط ریشه‌ای بازه آیات" dir="rtl">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sm">ارتباط ریشه‌ای · {meta.surahs[surahN - 1].fa}</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>مقایسهٔ بازهٔ انتخابی با باقی همین سوره</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="بستن مقایسه"><IconClose /></button>
        </div>
        <div className="px-4 pb-3 flex gap-3">
          {[
            { label: 'از آیه', value: fromText, change: setFromText },
            { label: 'تا آیه', value: toText, change: setToText },
          ].map(field => (
            <label key={field.label} className="flex-1 min-w-0 text-xs">
              {field.label}
              <input inputMode="numeric" value={field.value} onChange={e => field.change(e.target.value)}
                className="block w-full rounded-lg border p-2 mt-1 bg-transparent text-base"
                style={{ borderColor: 'var(--line-strong)' }} aria-invalid={!valid} />
            </label>
          ))}
        </div>
        <div className="px-4 pb-3 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
          {!valid ? <p role="alert">بازه باید بین ۱ و {toFa(vc)} باشد؛ آیهٔ شروع نباید از پایان بزرگ‌تر باشد.</p>
            : whole ? <p role="status">برای مقایسه، دست‌کم یک آیه باید بیرون بازه بماند.</p>
              : <p aria-live="polite">آیات {toFa(from)} تا {toFa(to)} در برابر {toFa(vc - (to - from + 1))} آیهٔ باقی‌مانده · {toFa(rows.length)} ریشهٔ مشترک</p>}
          <details className="mt-1">
            <summary className="cursor-pointer">رتبه‌ها چطور محاسبه می‌شوند؟</summary>
            <p>قدرت ارتباط از میانگین هندسی شاخص کلیدواژگی در دو بخش به دست می‌آید؛ طول هر بخش و تکرار ریشه در کل قرآن لحاظ می‌شود. تکرار مشترک، کمینهٔ تعداد کاربرد در دو بخش است. کلیدواژگی سوره همان شاخص فهرست ریشه‌هاست. این مقایسه، اشتراک واژگانی را نشان می‌دهد و اثبات ارتباط معنایی نیست.</p>
          </details>
        </div>
        <div className="flex border-b px-2" style={{ borderColor: 'var(--line)' }}>
          {([['connection', 'قدرت ارتباط'], ['frequency', 'تکرار مشترک'], ['keyword', 'کلیدواژگی سوره']] as const).map(([key, label]) => (
            <button key={key} className={`tab-btn${sort === key ? ' active' : ''}`} onClick={() => setSort(key)}>{label}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto nice-scroll p-3">
          {error ? <p role="alert" className="text-center py-6">داده‌ها بارگیری نشدند. ابزار را ببندید و دوباره باز کنید.</p>
            : !surah || !roots ? <p role="status" className="text-center py-6">در حال بارگیری…</p>
              : valid && !whole && !rows.length ? <p className="text-center py-6 text-sm">ریشهٔ مشترکی بین این بازه و باقی سوره پیدا نشد.</p>
                : rows.map((row, index) => (
                  <button key={row.root} className="w-full text-right rounded-xl border p-3 mb-2"
                    style={{ borderColor: 'var(--line)' }} onClick={() => onPickRoot(row.root)}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs">{toFa(index + 1)}</span>
                      <b className="font-quran text-xl flex-1">{spacedRoot(row.root)}</b>
                      <span className="text-xs">ارتباط {toFa(Math.round(row.connection * 100))}٪</span>
                    </div>
                    <div className="dist-track my-2"><div className="dist-fill cur" style={{ width: `${row.connection * 100}%`, height: '100%' }} /></div>
                    <p className="text-xs leading-6">در بازه: {toFa(row.inside)} بار · بیرون: {toFa(row.outside)} بار · کلیدواژگی سوره: {toFa(Math.round(row.keyword * 100))}٪</p>
                    <p className="text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>آیات بازه: {row.insideAyahs.map(toFa).join('، ')}<br />آیات بیرون: {row.outsideAyahs.map(toFa).join('، ')}</p>
                  </button>
                ))}
        </div>
      </section>
    </>
  )
}
