'use client'
import {t} from '@/lib/i18n'

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
      summary: summaries.map(item => item.summary || t("ui.5145a3cd1a")).join(' ') || t("ui.62d9d3f5e8"),
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
    description: t("ui.a563cd186a"),
    fields: [
      { label: t("ui.f72a3d8543"), value: t("ui.85a2949c23") },
      ...(entry.provenance.sourceKind === 'independent-reference' ? [
        { label: t("ui.f45417f62d"), value: t("ui.5083b63e8d") },
        { label: t("ui.3073612fe6"), value: t("ui.4f36d60b68") },
      ] : [
        { label: t("ui.014cd6c9d5"), value: t("ui.9bfdcedae1") },
        { label: t("ui.ef7127f26a"), value: t("ui.17e06468f0") },
        ...(entry.provenance.volume && entry.provenance.page ? [{ label: t("ui.2cc6a9014c"), value: t("ui.f7cff9c45a",{p0:(toFa(entry.provenance.volume)),p1:(toFa(entry.provenance.page)),p2:((entry.provenance.pageEnd ?? 0) > entry.provenance.page ? ` ${t('ui.b1e000640d')} ${toFa(entry.provenance.pageEnd!)}` : '')}) }] : []),
      ]),
      { label: t("ui.21f1a03e36"), value: entry.word },
    ],
    notes: [t("ui.5e3c5fe7ac"), ...(entry.provenance.translationScope === 'author-and-editorial' ? [t("ui.c82904d830")] : []), ...(entry.provenance.translationKind === 'partial-reference-entry' ? [t("ui.f4d0599de5")] : [])],
    details: entry.provenance.translationNote,
    links: entry.provenance.sourceUrl ? [{ label: t("ui.1ede69cce3"), href: entry.provenance.sourceUrl }] : [],
  } : undefined

  return <section aria-label={t("ui.25622dd345")} className="rounded-xl border p-3 mb-4 text-sm leading-7" style={{ borderColor: 'var(--line)' }}>
    {entry ? <>
      <RootBookHeading book="maqayis" expanded={expanded} summary={entry.summary} source={source}
        onToggle={() => { setExpanded(value => !value); setArabic(false) }} />
      {expanded && <div>
        {entry.provenance.translationScope === 'author-and-editorial' && <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>{t("ui.a9f13320d9")}</p>}
        {entry.provenance.translationKind === 'partial-reference-entry' && <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>{t("ui.8f62241adf")}</p>}
        <TahqiqText text={entry.fa} />
        <button type="button" aria-expanded={arabic} className="inline-flex items-center gap-1 text-xs py-2 mt-2 cursor-pointer" onClick={() => setArabic(value => !value)}>
          {arabic ? t("ui.cc9729c600") : t("ui.4cf44c4f5c")}<ChevronDown aria-hidden="true" size={16} className={`transition-transform duration-200 ${arabic ? 'rotate-180' : ''}`} />
        </button>
        {arabic && <p dir="rtl" lang="ar" className="mt-2 whitespace-pre-wrap break-words text-justify">{entry.ar}</p>}
      </div>}
    </> : state.error && preview?.root === root ? <><RootBookHeading book="maqayis" expanded={expanded} summary={preview.text} onToggle={() => setExpanded(value => !value)} />{expanded && <p className="text-xs">{t("ui.84557ada04")}</p>}</> : <p><strong>{t("ui.5ac12abae1")}{' '}</strong><span className="text-xs" style={{ color: 'var(--ink-soft)' }}>{state.error && state.root === root ? t("ui.921e6df6ca") : entry === null ? unavailable.has(root) ? t("ui.d8d0c75ad5") : t("ui.be62721bd3") : t("ui.0cfb741f7a")}</span></p>}
  </section>
}
