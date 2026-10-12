'use client'

import type { Selection } from './MushafPage'
import type { SurahData, Translations } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import { contextSource, getContext, getSurahContexts } from '@/lib/contexts'
import QuranText from './QuranText'

interface Props {
  selection: Selection
  surah: SurahData
  trans: Translations
  translator: 'a' | 'f' | 'm'
  onPick: (a: number, pos: number) => void
}
export default function ContextDetails({ selection, surah, trans, translator, onPick }: Props) {
  const source = getSurahContexts(surah.n)
  const context = getContext(surah.n, selection.a)
  const verses = context ? surah.v.filter(v => v.n >= context.from && v.n <= context.to) : []
  const wordCount = verses.reduce((n, v) => n + v.w.length, 0)
  const roots = new Set(verses.flatMap(v => v.w.map(w => w.r).filter(Boolean)))
  const page = context?.sourcePage ?? source?.sourcePage ?? 1
  return (
    <>
      <p className="text-xs leading-6 mb-3" style={{ color: 'var(--ink-soft)' }}>
        بر اساس «{contextSource.title}» · {contextSource.publisher}
        <br /><a className="underline" href={`${contextSource.url}#page=${page}`} target="_blank" rel="noreferrer">مشاهدهٔ صفحه {toFa(page)} منبع</a>
      </p>
      {!context ? <p role="status" className="text-sm leading-8">در فایل منبع، محدودهٔ سیاق این سوره مشخص نشده است؛ بازه‌ای به‌صورت حدسی انتخاب نمی‌شود.</p> : (
        <>
          <h3 className="font-bold text-sm mb-2">{context.sourceLabel ? `سیاق‌های ${context.sourceLabel}` : `سیاق ${toFa(context.id)} از ${toFa(source?.ranges.length ?? 0)}`} · آیات {toFa(context.from)} تا {toFa(context.to)}</h3>
          {context.note && <p className="text-xs leading-6 mb-3">{context.note}</p>}
          <div className="flex gap-2 mb-4">
            <div className="stat"><b>{toFa(verses.length)}</b><span>آیه در سیاق</span></div>
            <div className="stat"><b>{toFa(wordCount)}</b><span>واژه در سیاق</span></div>
            <div className="stat"><b>{toFa(roots.size)}</b><span>ریشهٔ متفاوت</span></div>
          </div>
          <details className="text-xs mb-3">
            <summary className="cursor-pointer">فهرست سیاق‌های این سوره</summary>
            <div className="flex flex-wrap gap-2 mt-2">{source?.ranges.map(range => <button key={range.id} aria-pressed={range.id === context.id} className="chip" onClick={() => onPick(range.from, 1)} style={range.id === context.id ? { background: 'var(--word-active)' } : undefined}>آیات {toFa(range.from)}–{toFa(range.to)}</button>)}</div>
          </details>
          <div className="flex flex-col gap-3">
            {verses.map(verse => <article key={verse.n} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
              <button className="chip mb-2" onClick={() => onPick(verse.n, 1)}>رفتن به آیه {toFa(verse.n)}</button>
              <p className="font-quran text-justify" dir="rtl" style={{ fontSize: 20, lineHeight: 2 }}>{verse.w.map((w, i) => <span key={i}><QuranText text={w.t} />{' '}</span>)}</p>
              {trans[String(verse.n)]?.[translator] && <p className="text-sm leading-7 text-justify mt-2 pt-2 border-t" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>{trans[String(verse.n)][translator]}</p>}
            </article>)}
          </div>
        </>
      )}
    </>
  )
}
