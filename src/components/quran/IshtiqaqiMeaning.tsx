'use client'
import {t} from '@/lib/i18n'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { toFa } from '@/lib/quran'
import SourceReference from './SourceReference'
import RootBookHeading, { ROOT_BOOK_TITLES } from './RootBookHeading'
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
    ? fetch(`/data/ishtiqaqi/${encodeURIComponent(root)}.json`).then(r => { if (!r.ok) throw new Error('entry'); return r.json() }) : null).catch(error => { cache.delete(root); throw error }))
  return cache.get(root)!
}

function citation(ref: Reference) {
  return t("ui.8ef802f5c5",{p0:(toFa(ref.volume)),p1:(toFa(ref.printed_page)),p2:(toFa(ref.page_id))})
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
  const [preview, setPreview] = useState<{root: string; text: string} | null>(null)
  useEffect(() => { let live = true; fetch('/data/ishtiqaqi-summaries.json').then(r => r.json()).then(rows => { if (live) setPreview({root, text: rows[root]?.summary || ''}) }).catch(() => {}); return () => { live = false } }, [root])
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    let live = true
    setExpanded(false)
    load(root).then(data => { if (live) setState({ root, data }) }).catch(() => { if (live) setState({ root, error: true }) })
    return () => { live = false }
  }, [root])
  const data = state.root === root ? state.data : undefined
  const summary = data?.entries.find(entry => entry.translation?.summary)?.translation?.summary
  return <section aria-label={t("ui.761913287f")} className="rounded-xl border p-3 mb-4 text-sm leading-7" style={{ borderColor: 'var(--line)' }}>
    <RootBookHeading book="ishtiqaqi" expanded={expanded} summary={summary || (preview?.root === root ? preview.text : '') || (data ? t("ui.62d9d3f5e8") : undefined)}
      source={data?.entries[0] ? ishtiqaqiSource(data.entries[0]) : undefined} onToggle={() => setExpanded(value => !value)} />
    {state.error && state.root === root ? expanded && <p className="text-xs">{t("ui.84557ada04")}</p>
      : data === undefined ? <p role="status" className="text-xs">{t("ui.0cfb741f7a")}</p>
        : data === null ? <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{t("ui.bf6915cea1")}</p>
          : expanded && <div>
            {data.entries.length > 1 && <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>{t("ui.505d12eadc")}</p>}
            {data.entries.map(entry => <EntryMeaning key={entry.id} entry={entry} multiple={data.entries.length > 1} />)}
          </div>}
  </section>
}

function ishtiqaqiSource(entry: Entry) {
  const translation = entry.translation
  return {
    resourceId:'book:ishtiqaqi',title: ROOT_BOOK_TITLES.ishtiqaqi.full,
    description: t("ui.0e9d8dd6af"),
    fields: [
      { label: t("ui.f72a3d8543"), value: t("ui.bcf7493cdd") },
      { label: t("ui.f45417f62d"), value: t("ui.478a26d593") },
      { label: t("ui.21f1a03e36"), value: `${entry.heading}${entry.isSupplement ? t("ui.09eafea4eb") : ''}` },
      ...(entry.references.length ? [{ label: t("ui.2cc6a9014c"), value: entry.references.map(ref => t("ui.6089f72b5b",{p0:(toFa(ref.volume)),p1:(toFa(ref.printed_page))})).join('؛ ') }] : []),
      ...(translation ? [{ label: t("ui.01f2ad2bc8"), value: translation.translator }] : []),
    ],
    notes: [translation ? translation.faFull ? t("ui.737f40a75c") : t("ui.3324fb7690") : t("ui.df3ff1eba7")],
    links: [{ label: t("ui.74d9e31b41"), href: entry.references[0]?.url ?? 'https://shamela.ws/book/21017' }],
  }
}

function EntryMeaning({ entry, multiple }: { entry: Entry; multiple: boolean }) {
  const [arabic, setArabic] = useState(false)
  const translation = entry.translation


  return <div className="mt-2">
    {multiple && <h4 className="font-bold">{entry.heading}{entry.isSupplement && t("ui.09eafea4eb")}</h4>}
    {multiple && <SourceReference source={ishtiqaqiSource(entry)} />}
    {translation?.faFull ? <TahqiqText text={translation.faFull} />
      : <div className="mt-2">
        {translation?.summary && <p className="text-justify">{translation.summary}</p>}
        <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{t("ui.0e3d4dc287")}</p>
      </div>}
    <button type="button" className="inline-flex items-center gap-1 text-xs py-2 mt-2 cursor-pointer" aria-expanded={arabic} onClick={() => setArabic(value => !value)}>
      {arabic ? t("ui.cc9729c600") : t("ui.4cf44c4f5c")}<ChevronDown aria-hidden="true" size={16} className={`transition-transform duration-200 ${arabic ? 'rotate-180' : ''}`} />
    </button>
    {arabic && <div>
      <ArabicText text={entry.ar} />
      {entry.footnotes.length > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer">{t("ui.ff6e04c560")}</summary>
        <p style={{ color: 'var(--ink-soft)' }}>{t("ui.f6666782cf")}</p>
        {entry.footnotes.map((note, i) => <div key={i} className="mt-2"><SourceReference label={t("ui.c986e01e3f")} source={{ resourceId:'book:ishtiqaqi',title: ROOT_BOOK_TITLES.ishtiqaqi.full, fields: [{ label: t("ui.f72a3d8543"), value: t("ui.4be660c170") }, { label: t("ui.2cc6a9014c"), value: citation(note.source) }], notes: [t("ui.a901d5ff97")], links: [{ label: t("ui.936818bf1a"), href: note.source.url }] }} /><ArabicText text={note.text} /></div>)}
      </details>}
      {entry.commonMeanings.length > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer">{t("ui.07ecc9d417")}</summary>
        {entry.commonMeanings.map(common => <div key={common.id} className="mt-2"><SourceReference source={{ resourceId:'book:ishtiqaqi',title: ROOT_BOOK_TITLES.ishtiqaqi.full, fields: [{ label: t("ui.149f9194ea"), value: common.heading }, ...common.references.map(ref => ({ label: t("ui.2cc6a9014c"), value: citation(ref) }))], links: common.references.map(ref => ({ label: t("ui.f9119fddb7",{p0:(toFa(ref.printed_page))}), href: ref.url })) }} /><ArabicText text={common.ar} /></div>)}
      </details>}
    </div>}
  </div>
}
