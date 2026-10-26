'use client'
import {normalizeDigits} from '@/lib/locale-numbers'
import {t,uiDirection} from '@/lib/i18n'

import { useEffect, useMemo, useState } from 'react'
import type { Meta, SurahData } from '@/lib/quran'
import { compareRootRange, loadGlobalRoots, loadSurah, toFa } from '@/lib/quran'
import { rootHue, rootColorStyle } from '@/lib/comparison-colors'
import { getSurahContexts } from '@/lib/contexts'
import { IconClose } from './Ornaments'

interface Props {
  surahN: number
  meta: Meta
  initialRange?: { from: number; to: number } | null
  onRootsChange: (roots: Record<string, number>) => void
  onRangeChange: (range: { s: number; from: number; to: number } | null) => void
  onClose: () => void
  onPickRoot: (root: string) => void
}

function parseVerse(value: string) {
  const normalized = normalizeDigits(value).trim().replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  return /^\d+$/.test(normalized) ? Number(normalized) : NaN
}

export default function RangeComparison({ surahN, meta, onClose, onPickRoot, onRangeChange, onRootsChange, initialRange }: Props) {
  const [surah, setSurah] = useState<SurahData | null>(null)
  const [roots, setRoots] = useState<Record<string, Record<string, number>> | null>(null)
  const [error, setError] = useState(false)
  const [fromText, setFromText] = useState(String(initialRange?.from ?? 1))
  const [toText, setToText] = useState(String(initialRange?.to ?? Math.min(5, meta.surahs[surahN - 1].vc - 1)))
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
  const contexts = getSurahContexts(surahN)?.ranges ?? []
  const selectedContext = contexts.find(range => range.from === from && range.to === to)
  const vc = meta.surahs[surahN - 1].vc
  const valid = fromText.trim() !== '' && toText.trim() !== '' &&
    Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to <= vc && from <= to
  const whole = valid && from === 1 && to === vc
  useEffect(() => {
    onRangeChange(valid && !whole ? { s: surahN, from, to } : null)
  }, [valid, whole, surahN, from, to, onRangeChange])

  const rows = useMemo(() => {
    if (!surah || !roots || !valid || whole) return []
    const result = compareRootRange(surah, roots, from, to)
    if (sort === 'frequency') result.sort((a, b) => Math.min(b.inside, b.outside) - Math.min(a.inside, a.outside) || b.connection - a.connection)
    if (sort === 'keyword') result.sort((a, b) => b.keyword - a.keyword || b.connection - a.connection)
    return result
  }, [surah, roots, valid, whole, from, to, sort])

  useEffect(() => {
    onRootsChange(Object.fromEntries(rows.map(row => [row.root, rootHue(row.root)])))
  }, [rows, onRootsChange])

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="surah-index-drawer" role="dialog" aria-modal="true" aria-label={t("ui.1f253d9ad1")} dir={uiDirection()}>
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sm">{t("ui.8d88976a1f")}{' '}{meta.surahs[surahN - 1].fa}</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>{t("ui.0818c8d564")}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t("ui.5248483502")}><IconClose /></button>
        </div>
        <div className="px-4 pb-3 flex gap-3">
          {[
            { label: t("ui.b8efcc0229"), value: fromText, change: setFromText },
            { label: t("ui.d754a5658e"), value: toText, change: setToText },
          ].map(field => (
            <label key={field.label} className="flex-1 min-w-0 text-xs">
              {field.label}
              <input inputMode="numeric" value={toFa(field.value)} onChange={e => field.change(e.target.value)}
                className="block w-full rounded-lg border p-2 mt-1 bg-transparent text-base"
                style={{ borderColor: 'var(--line-strong)' }} aria-invalid={!valid} />
            </label>
          ))}
        </div>
        <div className="px-4 pb-3">
          <p className="text-xs mb-2" style={{ color: 'var(--ink-soft)' }}>{t("ui.d5dd708148")}</p>
          <div role="group" aria-label={t("ui.9fb079d3da")} className="flex gap-2 overflow-x-auto nice-scroll pb-1">
            {contexts.map(range => <button key={range.id} type="button"
              aria-pressed={selectedContext?.id === range.id}
              aria-label={t("ui.9187e771c5",{p0:(toFa(range.id)),p1:(toFa(range.from)),p2:(toFa(range.to))})}
              className="chip flex-none min-h-[36px]"
              style={{ borderColor: selectedContext?.id === range.id ? 'var(--sage)' : 'var(--line-strong)', background: selectedContext?.id === range.id ? 'var(--word-root)' : 'var(--paper)' }}
              onClick={() => { setFromText(String(range.from)); setToText(String(range.to)) }}>{t("ui.16836d5471")}{toFa(range.id)}{' '}{t("ui.69a4606f3f")}{' '}{toFa(range.from)}{' '}{t("ui.b1e000640d")}{' '}{toFa(range.to)}
            </button>)}
          </div>
        </div>
        <div className="px-4 pb-3 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
          {!valid ? <p role="alert">{t("ui.0c6869f553")}{' '}{toFa(vc)}{' '}{t("ui.64a726a962")}</p>
            : whole ? <p role="status">{t("ui.c4ed354a4c")}</p>
              : <p aria-live="polite">{t("ui.d83f4af983")}{' '}{toFa(from)}{' '}{t("ui.b1e000640d")}{' '}{toFa(to)}{' '}{t("ui.07f0283e87")}{' '}{toFa(vc - (to - from + 1))}{' '}{t("ui.c07b97f990")}{' '}{toFa(rows.length)}{' '}{t("ui.895d03a002")}</p>}
          <details className="mt-1">
            <summary className="cursor-pointer">{t("ui.727214f3ae")}</summary>
            <p>{t("ui.f344475e2e")}</p>
          </details>
        </div>
        <div className="flex border-b px-2" style={{ borderColor: 'var(--line)' }}>
          {([['connection', t("ui.009549d93e")], ['frequency', t("ui.c5e1b1d4f5")], ['keyword', t("ui.e0fcdd0d87")]] as const).map(([key, label]) => (
            <button key={key} className={`tab-btn${sort === key ? ' active' : ''}`} onClick={() => setSort(key)}>{label}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto nice-scroll p-3">
          {error ? <p role="alert" className="text-center py-6">{t("ui.95ceec00b6")}</p>
            : !surah || !roots ? <p role="status" className="text-center py-6">{t("ui.0cfb741f7a")}</p>
              : valid && !whole && !rows.length ? <p className="text-center py-6 text-sm">{t("ui.33be2b63d7")}</p>
                : rows.map((row, index) => (
                  <button key={row.root} className="w-full text-right rounded-xl border p-3 mb-2"
                    style={{ borderColor: 'var(--line)' }} onClick={() => onPickRoot(row.root)}>
                    <div className="flex items-center gap-3">
                      <span className="comparison-color-key rounded px-2 py-1 text-xs" style={rootColorStyle(rootHue(row.root))}>{toFa(index + 1)}</span>
                      <b className="font-quran text-xl flex-1">{row.root}</b>
                      <span className="text-xs">{t("ui.cdc6fcf112")}{' '}{toFa(Math.round(row.connection * 100))}٪</span>
                    </div>
                    <div className="dist-track my-2"><div className="dist-fill cur" style={{ width: `${row.connection * 100}%`, height: '100%' }} /></div>
                    <p className="text-xs leading-6">{t("ui.6ef0a02025")}{' '}{toFa(row.inside)}{' '}{t("ui.5313016e63")}{' '}{toFa(row.outside)}{' '}{t("ui.0886e42967")}{' '}{toFa(Math.round(row.keyword * 100))}٪</p>
                    <p className="text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>{t("ui.7386dc56bf")}{' '}{row.insideAyahs.map(toFa).join('، ')}<br />{t("ui.645771cd23")}{' '}{row.outsideAyahs.map(toFa).join('، ')}</p>
                  </button>
                ))}
        </div>
      </section>
    </>
  )
}
