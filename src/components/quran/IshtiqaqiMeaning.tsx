'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { toFa } from '@/lib/quran'
import SourceReference from './SourceReference'
import TahqiqText from './TahqiqText'

type Reference = { volume: number; printed_page: number; page_id: number; url: string }
type Entry = {
  id: string; heading: string; ar: string; coreAr: string | null; isSupplement: boolean
  references: Reference[]
  footnotes: { text: string; scope: string; source: Reference }[]
  commonMeanings: { id: string; heading: string; ar: string; references: Reference[] }[]
  translation: { summary: string; faFull?: string; kind: string; translator: string } | null
}
type Definition = { root: string; entries: Entry[] }
let index: Promise<{ matchedRoots: string[] }> | undefined
const cache = new Map<string, Promise<Definition | null>>()
function load(root: string) {
  index ??= fetch('/data/ishtiqaqi-index.json').then(r => { if (!r.ok) throw new Error('index'); return r.json() })
  if (!cache.has(root)) cache.set(root, index.then(data => data.matchedRoots.includes(root)
    ? fetch(`/data/ishtiqaqi/${encodeURIComponent(root)}.json`).then(r => { if (!r.ok) throw new Error('entry'); return r.json() }) : null))
  return cache.get(root)!
}

function citation(ref: Reference) {
  return `جلد ${toFa(ref.volume)}، صفحهٔ ${toFa(ref.printed_page)} · صفحهٔ دیجیتال ${toFa(ref.page_id)}`
}

/** Preserve source characters while giving Quran quotations a distinct typeface. */
function ArabicText({ text }: { text: string }) {
  return <div lang="ar" dir="rtl" className="mt-2 whitespace-pre-wrap break-words text-justify leading-8" data-ishtiqaqi-ar>
    {text.split(/(\{[^}]+\})/g).map((part, i) => part.startsWith('{') && part.endsWith('}')
      ? <span key={i} className="font-quran text-xl">{part}</span> : part)}
  </div>
}

export default function IshtiqaqiMeaning({ root }: { root: string }) {
  const [state, setState] = useState<{ root: string; data?: Definition | null; error?: boolean }>({ root })
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    let live = true
    setExpanded(false)
    load(root).then(data => { if (live) setState({ root, data }) }).catch(() => { if (live) setState({ root, error: true }) })
    return () => { live = false }
  }, [root])
  const data = state.root === root ? state.data : undefined
  const summary = data?.entries.find(entry => entry.translation?.summary)?.translation?.summary
  return <section aria-label="معنای ریشه در المعجم الاشتقاقی" className="rounded-xl border p-3 mb-4 text-sm leading-7" style={{ borderColor: 'var(--line)' }}>
    <button type="button" className="flex w-full items-start gap-2 text-right cursor-pointer" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      <span className={expanded ? 'font-bold' : 'line-clamp-2'}><strong>المعجم الاشتقاقی{!expanded && summary && ': '}</strong>{!expanded && summary}</span>
      <ChevronDown aria-hidden="true" size={16} className={`shrink-0 mt-1 mr-auto transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
    </button>
    {state.error && state.root === root ? <p role="alert" className="text-xs">شرح ریشه بارگیری نشد.</p>
      : data === undefined ? <p role="status" className="text-xs">در حال بارگیری…</p>
        : data === null ? <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>مدخل این ریشه هنوز تطبیق داده نشده است.</p>
          : expanded && <div>
            {data.entries.length > 1 && <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>چند مدخل و مستدرک جداگانه برای این ریشه ثبت شده است.</p>}
            {data.entries.map(entry => <EntryMeaning key={entry.id} entry={entry} multiple={data.entries.length > 1} />)}
          </div>}
  </section>
}

function EntryMeaning({ entry, multiple }: { entry: Entry; multiple: boolean }) {
  const [arabic, setArabic] = useState(false)
  const translation = entry.translation
  const source = {
    title: 'المعجم الاشتقاقي المؤصل لألفاظ القرآن الكريم',
    description: 'فرهنگ اشتقاقی واژگان قرآن با تأکید بر معنای محوری و پیوند واژه‌های هم‌ریشه.',
    fields: [
      { label: 'نویسنده', value: 'دکتر محمد حسن حسن جبل' },
      { label: 'مأخذ دیجیتال', value: 'متن ارسالی از نسخهٔ شامله' },
      { label: 'مدخل', value: `${entry.heading}${entry.isSupplement ? ' · مستدرک' : ''}` },
      ...(entry.references.length ? [{ label: 'ارجاع', value: entry.references.map(ref => `جلد ${toFa(ref.volume)}، صفحهٔ ${toFa(ref.printed_page)}`).join('؛ ') }] : []),
      ...(translation ? [{ label: 'شرح فارسی', value: translation.translator }] : []),
    ],
    notes: [translation ? translation.faFull ? 'متن مدخل نویسنده ترجمه شده؛ پاورقی‌ها و شرح مشترک فصل در ترجمه وارد نشده‌اند.' : 'فقط خلاصهٔ معنای محوری به فارسی آماده است؛ ترجمهٔ کامل هنوز آماده نیست.' : 'متن عربی از فایل ارسالی است؛ ترجمهٔ فارسی هنوز آماده نیست.'],
    links: [{ label: 'متن مأخذ در شامله', href: entry.references[0]?.url ?? 'https://shamela.ws/book/21017' }],
  }

  return <div className="mt-2">
    {multiple && <h4 className="font-bold">{entry.heading}{entry.isSupplement && ' · مستدرک'}</h4>}
    <SourceReference source={source} />
    {translation?.faFull ? <TahqiqText text={translation.faFull} />
      : <div className="mt-2">
        {translation?.summary && <p className="text-justify">{translation.summary}</p>}
        <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>ترجمهٔ کامل فارسی این مدخل هنوز آماده نشده است.</p>
      </div>}
    <button type="button" className="inline-flex items-center gap-1 text-xs py-2 mt-2 cursor-pointer" aria-expanded={arabic} onClick={() => setArabic(value => !value)}>
      {arabic ? 'بستن اصل عربی' : 'دیدن اصل عربی'}<ChevronDown aria-hidden="true" size={16} className={`transition-transform duration-200 ${arabic ? 'rotate-180' : ''}`} />
    </button>
    {arabic && <div>
      <ArabicText text={entry.ar} />
      {entry.footnotes.length > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer">پاورقی‌های صفحات منبع</summary>
        <p style={{ color: 'var(--ink-soft)' }}>این پاورقی‌ها متعلق به صفحه‌اند و ممکن است به مدخل‌های دیگر همان صفحه هم مربوط باشند.</p>
        {entry.footnotes.map((note, i) => <div key={i} className="mt-2"><SourceReference label="صفحهٔ منبع" source={{ title: source.title, fields: [{ label: 'نویسنده', value: 'محمد حسن حسن جبل' }, { label: 'ارجاع', value: citation(note.source) }], notes: ['پاورقی این صفحه ممکن است به مدخل‌های دیگر همان صفحه مربوط باشد.'], links: [{ label: 'مشاهدهٔ صفحه', href: note.source.url }] }} /><ArabicText text={note.text} /></div>)}
      </details>}
      {entry.commonMeanings.length > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer">معنای مشترک فصل</summary>
        {entry.commonMeanings.map(common => <div key={common.id} className="mt-2"><SourceReference source={{ title: source.title, fields: [{ label: 'بخش', value: common.heading }, ...common.references.map(ref => ({ label: 'ارجاع', value: citation(ref) }))], links: common.references.map(ref => ({ label: `صفحهٔ ${toFa(ref.printed_page)}`, href: ref.url })) }} /><ArabicText text={common.ar} /></div>)}
      </details>}
    </div>}
  </div>
}
