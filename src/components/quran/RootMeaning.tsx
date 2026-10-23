'use client'

import { useEffect, useState } from 'react'
import { rootSummaries } from '@/lib/root-summaries'
import { toFa } from '@/lib/quran'
import TahqiqText from './TahqiqText'
import SourceReference from './SourceReference'
import { ChevronDown } from 'lucide-react'
import MaqayisMeaning from './MaqayisMeaning'
import IshtiqaqiMeaning from './IshtiqaqiMeaning'
import { AnalysisSection, ROOT_BOOKS, useAnalysisPreferences } from './AnalysisSections'

type Entry = { summarySourceWarning?: string; word: string; ar: string; fa: string; provenance?: { kind: string; translator: string; volume: number; page: number; pageEnd: number; heading: string }; examples?: { s: number; a: number; text: string; surahName: string }[] }
type Definition = { root: string; entries: Entry[]; preview?: string }
type Index = { matchedRoots: string[]; source: { title: string; author: string; translator: string } }
let indexPromise: Promise<Index> | undefined
const cache = new Map<string, Promise<Definition | null>>()
function load(root: string) {
  if (!indexPromise) indexPromise = fetch('/data/tahqiq-index.json').then(r => { if (!r.ok) throw new Error('index'); return r.json() })
  if (!cache.has(root)) cache.set(root, indexPromise.then(index => {
    if (!index.matchedRoots.includes(root)) return null
    const entry = fetch(`/data/tahqiq/${encodeURIComponent(root)}.json`).then(r => {
      if (!r.ok) throw new Error('entry')
      return r.json() as Promise<Definition>
    })
    return Promise.all([entry, rootSummaries('tahqiq', root).catch(() => [])]).then(([data, summaries]) => ({
      ...data,
      entries: data.entries.map((entry, i) => ({ ...entry, summarySourceWarning: summaries[i]?.sourceWarning })),
      preview: summaries.map(item => item.summary || 'متن این مدخل نیازمند بازبینی است.').join(' '),
    }))
  }))
  return cache.get(root)!
}

const bookComponents = { tahqiq: TahqiqMeaning, maqayis: MaqayisMeaning, ishtiqaqi: IshtiqaqiMeaning }
let availability: Promise<Record<string, string[]>> | undefined
function loadAvailability() {
  availability ??= Promise.all(ROOT_BOOKS.map(async book => {
    const response = await fetch(book.index)
    if (!response.ok) throw new Error('book index')
    const data = await response.json()
    return [book.id, data[book.field] ?? []] as const
  })).then(entries => Object.fromEntries(entries)).catch(error => { availability = undefined; throw error })
  return availability
}
export default function RootMeaning({ root }: { root: string }) {
  const { enabled } = useAnalysisPreferences()
  const [indexes, setIndexes] = useState<Record<string, string[]> | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    loadAvailability().then(data => { if (live) setIndexes(data) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  const books = ROOT_BOOKS.filter(book => enabled('root', 'meaning', book.id) && indexes?.[book.id]?.includes(root))
  if (!books.length) return failed && ROOT_BOOKS.some(book => enabled('root', 'meaning', book.id)) ? <p role="alert" className="text-xs">فهرست منابع بارگیری نشد؛ دوباره بخش تحلیل را باز کنید.</p> : null
  return <AnalysisSection tab="root" kind="meaning">{books.map(book => {
    const Component = bookComponents[book.id]
    return <Component key={`${book.id}:${root}`} root={root} />
  })}</AnalysisSection>
}

function TahqiqMeaning({ root }: { root: string }) {
  const [state, setState] = useState<{ root: string; data?: Definition | null; error?: boolean }>({ root })
  useEffect(() => {
    let live = true
    load(root).then(data => { if (live) setState({ root, data }) }).catch(() => { if (live) setState({ root, error: true }) })
    return () => { live = false }
  }, [root])
  const [openRoot, setOpenRoot] = useState<string | null>(null)
  const expanded = openRoot === root
  const ready = state.root === root
  return <section className="rounded-xl border p-3 mb-4 text-sm leading-7" aria-label="معنای ریشه در التحقیق" style={{ borderColor: 'var(--line)' }}>
    <div className="flex items-start gap-2" data-tahqiq-heading>
      <button type="button" className="flex flex-1 min-w-0 items-start gap-2 text-right cursor-pointer" aria-expanded={expanded} onClick={() => setOpenRoot(expanded ? null : root)}>
        <span className={expanded ? 'min-w-0 truncate font-bold' : 'block'} title={expanded ? 'التحقیق فی کلمات القرآن الکریم' : undefined}><strong>{expanded ? 'التحقیق فی کلمات القرآن الکریم' : 'التحقیق'}{!expanded && ready && state.data && ': '}</strong>{!expanded && ready && state.data && (state.data.preview || 'برای دیدن شرح ریشه باز کنید.')}</span>
        <ChevronDown aria-hidden="true" size={16} className={`shrink-0 mt-1 mr-auto transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && ready && state.data?.entries[0] && <span className="shrink-0"><SourceReference source={tahqiqSource(state.data.entries[0])} /></span>}
    </div>
    {!ready || state.data === undefined && !state.error ? <p role="status" className="text-xs">در حال بارگیری شرح ریشه…</p>
      : state.error ? <p role="alert" className="text-xs">شرح ریشه بارگیری نشد.</p>
        : !state.data ? <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>برای این ریشه مدخل منطبق در نسخهٔ ارسالی پیدا نشد.</p>
          : <>
            {expanded && state.data.entries.length > 1 && <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>چند مدخل با نوشتار نزدیک وجود دارد؛ عنوان اصلی هر مدخل برای تشخیص معنای مورد نظر حفظ شده است.</p>}
            {expanded && state.data.entries.map(entry => <MeaningEntry key={`${root}:${entry.word}`} entry={entry} ambiguous={state.data!.entries.length > 1} />)}
          </>}
  </section>
}

function tahqiqSource(entry: Entry) {
  return {
    title: 'التحقیق فی کلمات القرآن الکریم',
    description: 'واژه‌پژوهی قرآن با تمرکز بر معنای محوری ریشه‌ها و کاربردهای قرآنی آن‌ها.',
    fields: [
      { label: 'نویسنده', value: 'علامه حسن مصطفوی' },
      ...(entry.provenance ? [
        { label: 'نسخهٔ عربی', value: 'چاپ سوم؛ دار الکتب العلمیة ـ مرکز نشر آثار علامه مصطفوی؛ مجموعهٔ ۱۴ جلدی ارسالی' },
        { label: 'ارجاع', value: `جلد ${toFa(entry.provenance.volume)}، صفحهٔ ${toFa(entry.provenance.page)}${entry.provenance.pageEnd > entry.provenance.page ? ` تا ${toFa(entry.provenance.pageEnd)}` : ''}` },
        { label: 'مدخل مأخذ', value: entry.provenance.heading },
      ] : [
        { label: 'شرح فارسی', value: 'صادق عباسی و مجموعهٔ مدارس دانشجویی قرآن و عترت دانشگاه تهران' },
        { label: 'مأخذ دیجیتال', value: 'اپ التّحقیق (فارسی)، فایل ارسالی' },
      ]),
    ],
    notes: [...(entry.summarySourceWarning ? [entry.summarySourceWarning] : []), 'خلاصهٔ نمایشی با کمک هوش مصنوعی تهیه و با متن مأخذ تطبیق داده شده است.', entry.provenance ? 'شرح فارسی این مدخل، ترجمه و تلخیص با کمک هوش مصنوعی از متن عربی است؛ ترجمهٔ چاپی کتاب نیست.' : 'انتساب ترجمه طبق معرفی اپ است؛ شمارهٔ جلد، صفحه و تاریخ انتشار در دادهٔ اپ موجود نیست.'],
  }
}

function MeaningEntry({ entry, ambiguous }: { entry: Entry; ambiguous: boolean }) {
  const [arabic, setArabic] = useState(false)


  return <div>
    {ambiguous && <div className="flex items-center justify-between gap-2 mt-2"><h4 className="font-bold">مدخل «{entry.word}»</h4><SourceReference source={tahqiqSource(entry)} /></div>}
    <div>
      <TahqiqText text={entry.fa} />
      {entry.examples && <div className="mt-3 text-xs leading-7">
        <p className="font-bold">نمونهٔ کاربرد در قرآن</p>
        {entry.examples.map(example => <p key={`${example.s}:${example.a}`}><span className="font-quran tahqiq-example" lang="ar">«{example.text}»</span>{' '}<SourceReference label="نشانی آیه" text={`سورهٔ ${example.surahName}، آیهٔ ${toFa(example.a)}`} /></p>)}
      </div>}
      <button type="button" className="inline-flex items-center gap-1 text-xs cursor-pointer py-2 mt-2" aria-expanded={arabic} onClick={() => setArabic(value => !value)}>
        {arabic ? 'بستن متن عربی' : 'دیدن متن اصلی عربی'}
        <ChevronDown aria-hidden="true" size={16} className={`transition-transform duration-200 ${arabic ? 'rotate-180' : ''}`} />
      </button>
      {arabic && <p lang="ar" dir="rtl" className="mt-2 whitespace-pre-wrap text-justify break-words">{entry.ar}</p>}
    </div>
  </div>
}
