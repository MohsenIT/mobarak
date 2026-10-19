'use client'

import type { Selection } from './MushafPage'
import type { Translator, SurahData, Translations } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import { contextSource, getContext, getSurahContexts } from '@/lib/contexts'
import QuranText from './QuranText'
import { displayWordText } from '@/lib/word-parts'
import SourceReference from './SourceReference'
import { AnalysisSection, STAT_OPTIONS, useAnalysisPreferences } from './AnalysisSections'

interface Props {
  selection: Selection
  surah: SurahData
  trans: Translations
  translator: Translator
  onCompare: (s: number, from: number, to: number) => void
  onPick: (a: number, pos: number) => void
}
export default function ContextDetails({ selection, surah, trans, translator, onPick, onCompare }: Props) {
  const { enabled } = useAnalysisPreferences()
  const showMeaning = (id: string) => enabled('context', 'meaning', id)
  const showStat = (id: string) => enabled('context', 'stats', id)
  const source = getSurahContexts(surah.n)
  const context = getContext(surah.n, selection.a)
  const verses = context ? surah.v.filter(v => v.n >= context.from && v.n <= context.to) : []
  const wordCount = verses.reduce((n, v) => n + v.w.length, 0)
  const roots = new Set(verses.flatMap(v => v.w.map(w => w.r).filter(Boolean)))
  const page = context?.sourcePage ?? source?.sourcePage ?? 1
  return (
    <div className="analysis-section-stack">
      {context && ((showMeaning('note') && !!(context.note || source)) || (showMeaning('translation') && verses.some(v => !!trans[String(v.n)]?.[translator]))) && <AnalysisSection tab="context" kind="meaning">
      {showMeaning('note') && <div className="mb-3">
        <SourceReference label="منبع سیاق‌بندی" source={{
          title: contextSource.title,
          description: 'مرجع تعیین مرز سیاق‌ها و پیوند موضوعی آیات در این سایت.',
          fields: [{ label: 'تهیه‌کننده', value: contextSource.publisher }, { label: 'نسخه', value: 'فایل PDF ارسالی' }, context?.origin === 'user-clarification' ? { label: 'مبنای بازه', value: 'تکمیل کاربر برای سوره‌های کوتاه' } : { label: 'ارجاع', value: `صفحهٔ ${toFa(page)}` }],
          notes: [context?.origin === 'user-clarification' ? 'بازهٔ این سوره طبق تکمیل کاربر، کل سوره در نظر گرفته شده است؛ این مورد از PDF استخراج نشده است.' : 'بازه‌ها از سیاق‌بندی اولیهٔ منبع گرفته شده‌اند؛ این تقسیم‌بندی یک پیشنهاد تفسیری است.'],
          links: [{ label: context?.origin === 'user-clarification' ? 'سند سیاق‌بندی' : `صفحهٔ ${toFa(page)} منبع`, href: context?.origin === 'user-clarification' ? contextSource.url : `${contextSource.url}#page=${page}` }],
        }} />
        {context.note && <p className="text-xs leading-6 mt-3">{context.note}</p>}
      </div>}
      {showMeaning('translation') && verses.map(v => trans[String(v.n)]?.[translator] && <p key={v.n} className="text-sm leading-8 mb-2 text-justify"><span className="text-xs" style={{ color: 'var(--ink-soft)' }}>{toFa(v.n)} · </span>{trans[String(v.n)][translator]}</p>)}
      </AnalysisSection>}
      {context && STAT_OPTIONS.context.some(option => showStat(option.id)) && <AnalysisSection tab="context" kind="stats">
        <div className="flex gap-2">
          <div className="stat" hidden={!showStat('verses')}><b>{toFa(verses.length)}</b><span>آیه در سیاق</span></div>
          <div className="stat" hidden={!showStat('words')}><b>{toFa(wordCount)}</b><span>واژه در سیاق</span></div>
          <div className="stat" hidden={!showStat('roots')}><b>{toFa(roots.size)}</b><span>ریشهٔ متفاوت</span></div>
        </div>
      </AnalysisSection>}
      <div className="analysis-examples">
      {!context ? <p role="status" className="text-sm leading-8">در فایل منبع، محدودهٔ سیاق این سوره مشخص نشده است؛ بازه‌ای به‌صورت حدسی انتخاب نمی‌شود.</p> : (
        <>
          <h3 className="font-bold text-sm mb-2">{context.sourceLabel ? `سیاق‌های ${context.sourceLabel}` : `سیاق ${toFa(context.id)} از ${toFa(source?.ranges.length ?? 0)}`} · آیات {toFa(context.from)} تا {toFa(context.to)}</h3>
          <button className="rounded-xl border px-3 py-2 mb-3 text-sm w-full" style={{ borderColor: 'var(--sage)', color: 'var(--sage)' }}
            onClick={() => onCompare(surah.n, context.from, context.to)}>مقایسهٔ ریشه‌ای این سیاق با باقی سوره</button>
          <details className="text-xs mb-3">
            <summary className="cursor-pointer">فهرست سیاق‌های این سوره</summary>
            <div className="flex flex-wrap gap-2 mt-2">{source?.ranges.map(range => <button key={range.id} aria-pressed={range.id === context.id} className="chip" onClick={() => onPick(range.from, 1)} style={range.id === context.id ? { background: 'var(--word-active)' } : undefined}>آیات {toFa(range.from)}–{toFa(range.to)}</button>)}</div>
          </details>
          <div className="flex flex-col gap-3">
            {verses.map(verse => <article key={verse.n} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
              <button className="chip mb-2" onClick={() => onPick(verse.n, 1)}>رفتن به آیه {toFa(verse.n)}</button>
              <p className="font-quran text-justify" dir="rtl" style={{ fontSize: 20, lineHeight: 2 }}>{verse.w.map((w, i) => <span key={i}><QuranText text={displayWordText(w)} />{' '}</span>)}</p>

            </article>)}
          </div>
        </>
      )}
      </div>
    </div>
  )
}
