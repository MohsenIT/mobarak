'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, LoaderCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { Meta, Translator, Translations } from '@/lib/quran'
import { loadSurah, loadTrans, spacedRoot, toFa } from '@/lib/quran'
import { analysisOccurrences, type AnalysisSelection } from '@/lib/analysis'
import { normalizeQuranSearch, type QuranSearchResult } from '@/lib/quran-search'
import QuranText from './QuranText'
import { splitWord } from '@/lib/word-parts'

interface Props {
  occurrenceFilter?: AnalysisSelection | null
  onClearOccurrenceFilter?: () => void
  translator: Translator
  open: boolean
  onOpenChange: (open: boolean) => void
  meta: Meta
  currentSurah: number
  onPick: (s: number, a: number, pos: number) => void
}
function snippet(result: QuranSearchResult, full = false) {
  const first = (result.positions[0] ?? 1) - 1
  let last = first
  while (result.positions.includes(last + 2)) last++
  const from = full ? 0 : Math.max(0, first - 6)
  const to = full ? result.words.length : Math.min(result.words.length, Math.max(from + 30, last + 7))
  const tokens: { text: string; selected: boolean }[] = []
  for (let i = from; i < to; i++) {
    const { prefix, stem } = splitWord({ t: result.words[i], wa: result.waw.includes(i + 1) })
    const mask = result.parts[i + 1] ?? 0
    if (prefix) tokens.push({ text: prefix, selected: !!(mask & 1) })
    tokens.push({ text: stem, selected: !!(mask & 2) })
  }
  const runs: { selected: boolean; words: string[] }[] = []
  for (const token of tokens) {
    const previous = runs.at(-1)
    if (previous?.selected === token.selected) previous.words.push(token.text)
    else runs.push({ selected: token.selected, words: [token.text] })
  }
  return <>{from > 0 && '… '}{runs.map((run, i) => <span key={i}><span data-search-match={run.selected ? 'true' : undefined} className={run.selected ? 'rounded px-0.5' : undefined} style={run.selected ? { background: 'var(--word-selected)', color: 'var(--ink)', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' } : undefined}><QuranText text={run.words.join(' ')} /></span>{i < runs.length - 1 ? ' ' : null}</span>)}{to < result.words.length && ' …'}</>
}
const labels = { exact: 'تطبیق دقیق', partial: 'شامل عبارت شما', near: 'نتایج نزدیک · با احتمال خطای تایپی' }

export default function QuranSearch({ open, onOpenChange, meta, currentSurah, onPick, occurrenceFilter, onClearOccurrenceFilter, translator }: Props) {
  const [translations, setTranslations] = useState<Translations | null>(null)
  const [query, setQuery] = useState('')
  const [includePartial, setIncludePartial] = useState(true)
  const [includeNear, setIncludeNear] = useState(false)
  const [localOnly, setLocalOnly] = useState(false)
  const [results, setResults] = useState<QuranSearchResult[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [visible, setVisible] = useState(20)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const scroll = useRef(0)
  const worker = useRef<Worker | null>(null)
  const request = useRef(0)
  const completed = useRef('')
  const pending = useRef('')
  const valid = !!occurrenceFilter || normalizeQuranSearch(query).replace(/\s/g, '').length >= 2

  useEffect(() => () => { worker.current?.terminate() }, [])
  useEffect(() => {
    if (!open) { request.current++; return }
    const id = ++request.current
    if (occurrenceFilter) {
      const key = `occurrences:${JSON.stringify(occurrenceFilter)}`
      if (!error && completed.current === key) { setBusy(false); return }
      setBusy(true); setError(false); setVisible(20); scroll.current = 0
      Promise.all([loadSurah(occurrenceFilter.s), loadTrans(occurrenceFilter.s)]).then(([surah, trans]) => {
        if (request.current !== id) return
        const groups = new Map<number, number[]>()
        for (const [a, pos] of analysisOccurrences(surah, occurrenceFilter)) groups.set(a, [...(groups.get(a) ?? []), pos])
        setResults([...groups].map(([a, positions]) => {
          const verse = surah.v[a - 1]
          return { s: surah.n, a, words: verse.w.map(w => w.t), waw: verse.w.flatMap((w, i) => w.wa ? [i + 1] : []), positions,
            parts: Object.fromEntries(positions.map(pos => [pos, occurrenceFilter.part === 'prefix' ? 1 : 2])), kind: 'exact' as const, score: 0 }
        }))
        setTranslations(trans); completed.current = key; setBusy(false)
      }).catch(() => { if (request.current === id) { setBusy(false); setError(true) } })
      return () => { request.current++ }
    }
    const key = `${query}:${localOnly ? currentSurah : 0}:${includePartial}:${includeNear}`
    if (!error && completed.current === key) { setBusy(false); return }
    pending.current = key
    setVisible(20); scroll.current = 0; setError(false)
    if (!valid) { completed.current = ''; setResults([]); setBusy(false); return }
    setBusy(true)
    const timer = setTimeout(() => {
      try {
        if (!worker.current) {
          worker.current = new Worker(new URL('../../lib/quran-search.worker.ts', import.meta.url), { type: 'module' })
          worker.current.onmessage = (event: MessageEvent<{ id: number; results?: QuranSearchResult[]; error?: boolean }>) => {
            if (event.data.id !== request.current) return
            completed.current = event.data.error ? '' : pending.current
            setResults(event.data.results ?? []); setError(!!event.data.error); setBusy(false)
            if (list.current) list.current.scrollTop = 0
          }
          worker.current.onerror = () => { setError(true); setBusy(false); worker.current?.terminate(); worker.current = null }
        }
        worker.current.postMessage({ id, query, surah: localOnly ? currentSurah : 0, options: { includePartial, includeNear } })
      } catch { setError(true); setBusy(false) }
    }, 180)
    return () => { clearTimeout(timer); request.current++ }
  }, [query, localOnly, includePartial, includeNear, currentSurah, valid, retry, open, occurrenceFilter])

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent showCloseButton={false} dir="rtl" className="quran-filtered-search flex flex-col gap-0 p-0 sm:max-w-2xl h-[85dvh] max-h-[50rem] overflow-hidden" style={{ background: 'var(--paper)', color: 'var(--ink)', borderColor: 'var(--line)' }}
      onOpenAutoFocus={event => {
        event.preventDefault()
        // Returning to results should restore the list, without reopening the
        // phone keyboard and covering the result the reader just visited.
        if (occurrenceFilter || valid && completed.current) list.current?.focus({ preventScroll: true })
        else input.current?.focus()
        requestAnimationFrame(() => { if (list.current) list.current.scrollTop = scroll.current })
      }}>
      <div className="shrink-0 p-4 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-between gap-2 mb-2"><DialogTitle className="text-base font-bold">{occurrenceFilter ? 'تکرارها در این سوره' : 'جست‌وجو در قرآن'}</DialogTitle><button type="button" className="icon-btn sm" aria-label="بستن جست‌وجو" onClick={() => onOpenChange(false)}><X size={20} /></button></div>
        {occurrenceFilter ? <><DialogDescription className="text-xs leading-6 mb-2">متن کامل آیات و ترجمه، با مشخص‌بودن واژه‌های مطابق فیلتر.</DialogDescription><div className="flex items-center gap-2 flex-wrap"><span className="chip">{occurrenceFilter.tab === 'root' ? `ریشهٔ ${spacedRoot(occurrenceFilter.root ?? '')}` : occurrenceFilter.tab === 'form' ? `باب ${occurrenceFilter.form} · ${spacedRoot(occurrenceFilter.root ?? '')}` : `بن‌واژهٔ ${occurrenceFilter.text}`}</span><span className="chip">سورهٔ {meta.surahs[occurrenceFilter.s - 1]?.fa}</span><button type="button" className="text-xs underline py-2" onClick={onClearOccurrenceFilter}>جست‌وجوی متنی</button></div></> : <>
        <DialogDescription className="text-xs leading-6 mb-3" style={{ color: 'var(--ink-soft)' }}>واژه یا عبارت را بنویسید؛ تفاوت حروف فارسی و عربی و اعراب مانع جست‌وجو نیست.</DialogDescription>
        <div className="flex items-center gap-2 rounded-xl border px-3" style={{ borderColor: 'var(--line-strong)', background: 'var(--sheet)' }}>
          <Search size={18} aria-hidden="true" className="shrink-0" />
          <input ref={input} type="search" value={query} maxLength={160} onChange={event => setQuery(event.target.value)} aria-label="عبارت جست‌وجو در متن قرآن" placeholder="مثلاً: ذلک الکتاب لا ریب فیه" className="w-full min-w-0 bg-transparent py-3 text-sm outline-none" autoComplete="off" autoCorrect="off" spellCheck={false} />
        </div>
        <label className="flex items-center gap-2 text-xs mt-3"><input type="checkbox" checked={localOnly} onChange={event => setLocalOnly(event.target.checked)} />فقط سورهٔ {meta.surahs[currentSurah - 1]?.fa}</label>
        <div className="flex flex-wrap items-center gap-x-4 text-xs mt-1">
          <label className="inline-flex items-center gap-2 py-2 cursor-pointer"><input type="checkbox" checked={includePartial} onChange={event => setIncludePartial(event.target.checked)} />شامل عبارت</label>
          <label className="inline-flex items-center gap-2 py-2 cursor-pointer"><input type="checkbox" checked={includeNear} onChange={event => setIncludeNear(event.target.checked)} />نتایج نزدیک / غلط املایی</label>
        </div>
        </>}
      </div>
      <div className="shrink-0 px-4 py-2 text-xs" role="status" aria-live="polite" style={{ color: 'var(--ink-soft)' }}>
        {busy ? <span className="inline-flex items-center gap-2"><LoaderCircle size={14} className="animate-spin" />در حال جست‌وجو…</span> : !valid ? 'حداقل دو حرف وارد کنید.' : error ? 'متن جست‌وجو بارگیری نشد.' : occurrenceFilter ? `${toFa(results.reduce((sum, r) => sum + r.positions.length, 0))} تکرار در ${toFa(results.length)} آیه` : `${toFa(results.length)} آیه پیدا شد`}
      </div>
      <div ref={list} tabIndex={-1} aria-label="نتایج جست‌وجو" onScroll={event => { scroll.current = event.currentTarget.scrollTop }} className="min-h-0 flex-1 overflow-y-auto nice-scroll px-4 pb-4" aria-busy={busy} style={{ overscrollBehavior: 'contain' }}>
        {error && <button className="chip" onClick={() => setRetry(value => value + 1)}>تلاش دوباره</button>}
        {!busy && !error && valid && results.length === 0 && <p className="text-sm leading-8">نتیجه‌ای پیدا نشد. {includeNear ? 'عبارت کوتاه‌تر یا واژه‌های دیگری را امتحان کنید؛ خطاهای تایپی جزئی هم بررسی شده‌اند.' : 'برای بررسی اشتباه تایپی، «نتایج نزدیک / غلط املایی» را روشن کنید.'}</p>}
        {!busy && !error && valid && results.slice(0, visible).map((result, index) => <div key={`${result.s}:${result.a}`}>
          {!occurrenceFilter && (index === 0 || results[index - 1].kind !== result.kind) && <h3 className="text-xs font-bold pt-3 pb-2" style={{ color: 'var(--ink-soft)' }}>{labels[result.kind]}</h3>}
          <button type="button" className="block w-full text-right rounded-xl border p-3 mb-2 cursor-pointer" style={{ borderColor: 'var(--line)', background: 'var(--sheet)' }} aria-label={`رفتن به ${meta.surahs[result.s - 1]?.fa} آیه ${toFa(result.a)}`} onClick={() => { scroll.current = list.current?.scrollTop ?? scroll.current; onPick(result.s, result.a, result.positions[0] ?? 1) }}>
            <span className="flex items-center justify-between gap-2 mb-2 text-xs"><b>{meta.surahs[result.s - 1]?.fa} · آیهٔ {toFa(result.a)}</b><span style={{ color: 'var(--ink-soft)' }}>رفتن به آیه ←</span></span>
            <span className={`block font-quran text-xl leading-[2.2]${occurrenceFilter ? '' : ' line-clamp-4'}`} lang="ar">{snippet(result, !!occurrenceFilter)}</span>
            {occurrenceFilter && translations?.[String(result.a)]?.[translator] && <span className="block text-sm leading-7 mt-2 pt-2 border-t" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>{translations[String(result.a)][translator]}</span>}
          </button>
        </div>)}
        {!busy && valid && visible < results.length && <button className="chip w-full justify-center py-2" onClick={() => setVisible(count => count + 20)}>نمایش آیات بیشتر · {toFa(visible)} از {toFa(results.length)}</button>}
      </div>
    </DialogContent>
  </Dialog>
}
