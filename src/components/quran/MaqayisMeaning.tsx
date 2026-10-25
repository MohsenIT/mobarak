'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import RootBookHeading, { ROOT_BOOK_TITLES } from './RootBookHeading'
import { rootSummaries } from '@/lib/root-summaries'
import { toFa } from '@/lib/quran'
import TahqiqText from './TahqiqText'

type Entry = { root: string; word: string; ar: string; fa: string; summary: string; provenance: { volume?: number; page?: number; pageEnd?: number; translationNote: string; sourceKind?: string; sourceUrl?: string; translationScope?: string; translationKind?: string } }
const cache = new Map<string, Promise<Entry | null>>()
const unavailable = new Map<string, string>()
let index: Promise<{ translatedRoots: string[]; unavailableRoots?: Record<string, string> }> | undefined
function load(root: string) {
  index ??= fetch('/data/maqayis-index.json').then(r => { if (!r.ok) throw new Error('index'); return r.json() })
  if (!cache.has(root)) cache.set(root, index.then(data => {
    if (data.unavailableRoots?.[root]) unavailable.set(root, data.unavailableRoots[root])
    if (!data.translatedRoots.includes(root)) return null
    const entry = fetch(`/data/maqayis/${encodeURIComponent(root)}.json`).then(r => {
      if (!r.ok) throw new Error('entry')
      return r.json() as Promise<Entry>
    })
    return Promise.all([entry, rootSummaries('maqayis', root).catch(() => [])]).then(([entry, summaries]) => ({
      ...entry,
      summary: summaries.map(item => item.summary || 'متن این مدخل نیازمند بازبینی است.').join(' ') || 'برای دیدن شرح ریشه باز کنید.',
    }))
  }).catch(error => { cache.delete(root); throw error }))
  return cache.get(root)!
}

export default function MaqayisMeaning({ root }: { root: string }) {
  const [state, setState] = useState<{ root: string; entry?: Entry | null; error?: boolean }>({ root })
  const [preview, setPreview] = useState<{root: string; text: string} | null>(null)
  useEffect(() => { let live = true; rootSummaries('maqayis', root).then(rows => { if (live) setPreview({root, text: rows.map(row => row.summary).filter(Boolean).join(' ')}) }).catch(() => {}); return () => { live = false } }, [root])
  const [expanded, setExpanded] = useState(false)
  const [arabic, setArabic] = useState(false)
  useEffect(() => {
    let live = true
    setExpanded(false); setArabic(false)
    load(root).then(entry => { if (live) setState({ root, entry }) }).catch(() => { if (live) setState({ root, error: true }) })
    return () => { live = false }
  }, [root])
  const entry = state.root === root ? state.entry : undefined
  const source = entry ? {
    resourceId:'book:maqayis',
    title: ROOT_BOOK_TITLES.maqayis.full,
    description: 'فرهنگ ریشه‌های عربی؛ بررسی اصول معنایی هر ریشه با شواهد و کاربردهای زبانی.',
    fields: [
      { label: 'نویسنده', value: 'احمد بن فارس بن زکریا؛ قرن چهارم هجری' },
      ...(entry.provenance.sourceKind === 'independent-reference' ? [
        { label: 'مأخذ دیجیتال', value: 'نسخهٔ متنی بازنشرشده در مخزن mojam' },
        { label: 'نسخهٔ چاپی', value: 'جلد و صفحهٔ چاپی برای این مأخذ احراز نشده است' },
      ] : [
        { label: 'محقق', value: 'عبدالسلام محمد هارون' },
        { label: 'چاپ ارسالی', value: 'مکتب الإعلام الإسلامي؛ ۱۴۰۴ قمری' },
        ...(entry.provenance.volume && entry.provenance.page ? [{ label: 'ارجاع', value: `جلد ${toFa(entry.provenance.volume)}، صفحهٔ ${toFa(entry.provenance.page)}${(entry.provenance.pageEnd ?? 0) > entry.provenance.page ? ` تا ${toFa(entry.provenance.pageEnd!)}` : ''}` }] : []),
      ]),
      { label: 'مدخل', value: entry.word },
    ],
    notes: ['شرح فارسی و خلاصه با کمک هوش مصنوعی تهیه شده‌اند؛ این فرایند بازبینی انسانی نیست.', ...(entry.provenance.translationScope === 'author-and-editorial' ? ['این مأخذ متن مؤلف و حواشی را در کنار هم دارد؛ حواشی ممکن است به مدخل مجاور مربوط باشند.'] : []), ...(entry.provenance.translationKind === 'partial-reference-entry' ? ['مأخذ دارای افتادگی یا ابهام ثبت‌شده است.'] : [])],
    details: entry.provenance.translationNote,
    links: entry.provenance.sourceUrl ? [{ label: 'نسخهٔ متنی مأخذ', href: entry.provenance.sourceUrl }] : [],
  } : undefined

  return <section aria-label="معنای ریشه در مقاییس" className="rounded-xl border p-3 mb-4 text-sm leading-7" style={{ borderColor: 'var(--line)' }}>
    {entry ? <>
      <RootBookHeading book="maqayis" expanded={expanded} summary={entry.summary} source={source}
        onToggle={() => { setExpanded(value => !value); setArabic(false) }} />
      {expanded && <div>
        {entry.provenance.translationScope === 'author-and-editorial' && <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>این نسخه متن مؤلف و حواشی مرجع را با هم دارد؛ حواشی ممکن است به صفحه یا مدخل مجاور مربوط باشند.</p>}
        {entry.provenance.translationKind === 'partial-reference-entry' && <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>مأخذ این مدخل افتادگی یا ابهام دارد؛ توضیح آن را در منبع ببینید.</p>}
        <TahqiqText text={entry.fa} />
        <button type="button" aria-expanded={arabic} className="inline-flex items-center gap-1 text-xs py-2 mt-2 cursor-pointer" onClick={() => setArabic(value => !value)}>
          {arabic ? 'بستن اصل عربی' : 'دیدن اصل عربی'}<ChevronDown aria-hidden="true" size={16} className={`transition-transform duration-200 ${arabic ? 'rotate-180' : ''}`} />
        </button>
        {arabic && <p dir="rtl" lang="ar" className="mt-2 whitespace-pre-wrap break-words text-justify">{entry.ar}</p>}
      </div>}
    </> : state.error && preview?.root === root ? <><RootBookHeading book="maqayis" expanded={expanded} summary={preview.text} onToggle={() => setExpanded(value => !value)} />{expanded && <p className="text-xs">برای دریافت شرح کامل به اینترنت متصل شوید یا کتاب را از تنظیمات دانلود کنید.</p>}</> : <p><strong>مقاییس: </strong><span className="text-xs" style={{ color: 'var(--ink-soft)' }}>{state.error && state.root === root ? 'شرح ریشه بارگیری نشد.' : entry === null ? unavailable.has(root) ? 'در نسخهٔ موجود، مدخل مستقلی برای این صورت ریشه با اطمینان تطبیق داده نشد.' : 'ترجمهٔ این مدخل هنوز آماده نشده است.' : 'در حال بارگیری…'}</span></p>}
  </section>
}
