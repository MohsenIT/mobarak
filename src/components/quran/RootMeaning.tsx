'use client'
import {t} from '@/lib/i18n'

import { useEffect, useState } from 'react'
import RootBookHeading, { ROOT_BOOK_TITLES } from './RootBookHeading'
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
      preview: summaries.map(item => item.summary || t("ui.5145a3cd1a")).join(' '),
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
  if (!books.length) return failed && ROOT_BOOKS.some(book => enabled('root', 'meaning', book.id)) ? <p role="alert" className="text-xs">{t("ui.b51461903e")}</p> : null
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
  return <section className="rounded-xl border p-3 mb-4 text-sm leading-7" aria-label={t("ui.fb65d57afe")} style={{ borderColor: 'var(--line)' }}>
    <RootBookHeading book="tahqiq" expanded={expanded} onToggle={() => setOpenRoot(expanded ? null : root)}
      summary={ready && state.data ? state.data.preview || t("ui.62d9d3f5e8") : undefined}
      source={ready && state.data?.entries[0] ? tahqiqSource(state.data.entries[0]) : undefined} />
    {!ready || state.data === undefined && !state.error ? <p role="status" className="text-xs">{t("ui.82d30beedd")}</p>
      : state.error ? <p role="alert" className="text-xs">{t("ui.921e6df6ca")}</p>
        : !state.data ? <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{t("ui.de392efb74")}</p>
          : <>
            {expanded && state.data.entries.length > 1 && <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{t("ui.62115ceb91")}</p>}
            {expanded && state.data.entries.map(entry => <MeaningEntry key={`${root}:${entry.word}`} entry={entry} ambiguous={state.data!.entries.length > 1} />)}
          </>}
  </section>
}

function tahqiqSource(entry: Entry) {
  return {
    resourceId:'book:tahqiq',
    title: ROOT_BOOK_TITLES.tahqiq.full,
    description: t("ui.85fc86d95e"),
    fields: [
      { label: t("ui.f72a3d8543"), value: t("ui.5c1ce6c22d") },
      ...(entry.provenance ? [
        { label: t("ui.af8cf777b5"), value: t("ui.a18c680965") },
        { label: t("ui.2cc6a9014c"), value: t("ui.f7cff9c45a",{p0:(toFa(entry.provenance.volume)),p1:(toFa(entry.provenance.page)),p2:(entry.provenance.pageEnd > entry.provenance.page ? ` ${t('ui.b1e000640d')} ${toFa(entry.provenance.pageEnd)}` : '')}) },
        { label: t("ui.261e287eb1"), value: entry.provenance.heading },
      ] : [
        { label: t("ui.01f2ad2bc8"), value: t("ui.feaa124276") },
        { label: t("ui.f45417f62d"), value: t("ui.d3d669e851") },
      ]),
    ],
    notes: [...(entry.summarySourceWarning ? [entry.summarySourceWarning] : []), t("ui.dcdb47133b"), entry.provenance ? t("ui.09dc3571b1") : t("ui.ee5c6d1595")],
  }
}

function MeaningEntry({ entry, ambiguous }: { entry: Entry; ambiguous: boolean }) {
  const [arabic, setArabic] = useState(false)


  return <div>
    {ambiguous && <div className="flex items-center justify-between gap-2 mt-2"><h4 className="font-bold">{t("ui.1f2aabce53")}{entry.word}»</h4><SourceReference source={tahqiqSource(entry)} /></div>}
    <div>
      <TahqiqText text={entry.fa} />
      {entry.examples && <div className="mt-3 text-xs leading-7">
        <p className="font-bold">{t("ui.5be0ee3544")}</p>
        {entry.examples.map(example => <p key={`${example.s}:${example.a}`}><span className="font-quran tahqiq-example" lang="ar">«{example.text}»</span>{' '}<SourceReference label={t("ui.217283c5b6")} text={t("ui.744dccc20d",{p0:(example.surahName),p1:(toFa(example.a))})} /></p>)}
      </div>}
      <button type="button" className="inline-flex items-center gap-1 text-xs cursor-pointer py-2 mt-2" aria-expanded={arabic} onClick={() => setArabic(value => !value)}>
        {arabic ? t("ui.14610c10b7") : t("ui.799cadfb8d")}
        <ChevronDown aria-hidden="true" size={16} className={`transition-transform duration-200 ${arabic ? 'rotate-180' : ''}`} />
      </button>
      {arabic && <p lang="ar" dir="rtl" className="mt-2 whitespace-pre-wrap text-justify break-words">{entry.ar}</p>}
    </div>
  </div>
}
