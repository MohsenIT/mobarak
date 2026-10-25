'use client'
import {translationDirection,translationLanguage} from '@/lib/translations'
import {t} from '@/lib/i18n'

import { useEffect, useMemo, useState } from 'react'
import type { Translator, SurahData, Translations } from '@/lib/quran'
import { morphologyLabel, formName, toFa } from '@/lib/quran'
import { analysisOccurrences, type AnalysisSelection, type AnalysisTab } from '@/lib/analysis'
import { lexicalKey } from '@/lib/word-parts'
import SourceReference from './SourceReference'
import { AnalysisSection, STAT_OPTIONS, useAnalysisPreferences } from './AnalysisSections'

type Index = { words: Record<string, Record<string, number>>; forms: Record<string, Record<string, number>>; rootForms: Record<string, Record<string, number>> }
let indexPromise: Promise<Index> | null = null
function loadIndex() {
  if (!indexPromise) indexPromise = fetch('/data/analysis-index.json').then(r => { if (!r.ok) throw new Error('analysis index'); return r.json() }).catch(e => { indexPromise = null; throw e })
  return indexPromise
}

interface Props {
  tab: Exclude<AnalysisTab, 'root' | 'context'>
  selection: AnalysisSelection
  surah: SurahData
  trans: Translations
  translator: Translator
}

export default function SelectionDetails({ tab, selection, surah, trans, translator }: Props) {
  const { enabled } = useAnalysisPreferences()
  const showStat = (id: string) => enabled(tab, 'stats', id)
  const showMeaning = (id: string) => enabled(tab, 'meaning', id)
  const [index, setIndex] = useState<Index | null>(null)
  const [indexError, setIndexError] = useState(false)
  useEffect(() => {
    let live = true
    loadIndex().then(data => { if (live) setIndex(data) }).catch(() => { if (live) setIndexError(true) })
    return () => { live = false }
  }, [])
  const occurrences = useMemo(() => analysisOccurrences(surah, selection), [surah, selection])
  const groups = useMemo(() => {
    const result = new Map<number, number[]>()
    for (const [a, pos] of occurrences) result.set(a, [...(result.get(a) ?? []), pos])
    return [...result.entries()]
  }, [occurrences])
  const verse = surah.v.find(v => v.n === selection.a)
  const distribution = tab === 'word' ? index?.words[lexicalKey(surah.v[selection.a - 1].w[selection.pos - 1], selection.part)] : selection.form ? index?.rootForms[`${selection.root}:${selection.form}`] : undefined
  const total = distribution ? Object.values(distribution).reduce((a, b) => a + b, 0) : null
  const distinctRoots = new Set(occurrences.map(([a, pos]) => surah.v[a - 1].w[pos - 1].r).filter(Boolean)).size

  if (tab === 'form' && !selection.form) return <p className="text-sm leading-8">{t("ui.8ca0579f19")}</p>

  const translation = trans[String(selection.a)]?.[translator]
  const hasMeaning = (tab === 'form' && showMeaning('morphology') && !!selection.form) || (tab === 'word' && showMeaning('lemma')) || (tab === 'verse' && showMeaning('translation') && !!translation)
  return (
    <div className="analysis-section-stack">
      {hasMeaning && <AnalysisSection tab={tab} kind="meaning">
      {tab === 'form' && showMeaning('morphology') && (
        <div className="rounded-xl border p-3 mb-3 text-sm" style={{ borderColor: 'var(--line)' }}>
          <p>{formName(selection.root, selection.form) && <b>{formName(selection.root, selection.form)} · </b>}{t("ui.5b2cd766c7")}{' '}<b>{morphologyLabel(selection.form!)}</b> <span dir="ltr">({selection.form})</span></p>
          <p className="text-xs leading-6 mt-1">{t("ui.53519bf7d2")}</p>
          <div className="mt-2"><SourceReference sourceId="corpus:qac" label={t("ui.d83f652803")} source={{
            title: 'Quranic Arabic Corpus',
            description: t("ui.1b3ca29dad"),
            fields: [{ label: t("ui.5544db5ccf"), value: 'Kais Dukes' }, { label: t("ui.e1280ac99b"), value: t("ui.486b13c366") }, { label: t("ui.a20d0aa76c"), value: t("ui.eab92b1030") }, { label: t("ui.58fde40e46"), value: t("ui.a898b6435f") }],
            notes: [t("ui.992f078909")],
            links: [{ label: t("ui.192a2e2ee1"), href: 'https://corpus.quran.com' }, { label: t("ui.2e82c9e0a2"), href: '/data/morphology-source.txt' }, { label: t("ui.a5eb1f7ac1"), href: 'https://tanzil.net' }],
          }} /></div>
        </div>
      )}
      {tab === 'word' && showMeaning('lemma') && <p className="text-xs leading-6 mb-3">{t("ui.05132ec8e6")}</p>}
      {tab === 'verse' && showMeaning('translation') && translation && <p dir={translationDirection(translator)} lang={translationLanguage(translator)} className="text-sm leading-8 text-justify">{translation}</p>}
      </AnalysisSection>}
      {STAT_OPTIONS[tab].some(option => showStat(option.id) && (option.id !== 'total' && option.id !== 'hosts' || !!distribution)) && <AnalysisSection tab={tab} kind="stats">
      {tab === 'verse' ? (
        <div className="flex gap-2 mb-4">
          <div className="stat" hidden={!showStat('words')}><b>{toFa(verse?.w.length ?? 0)}</b><span>{t("ui.394ba5c5f3")}</span></div>
          <div className="stat" hidden={!showStat('roots')}><b>{toFa(distinctRoots)}</b><span>{t("ui.8bbf1cab23")}</span></div>
          <div className="stat" hidden={!showStat('page')}><b>{toFa(verse?.p ?? 0)}</b><span>{t("ui.338c7bfaa3")}{' '}{toFa(verse?.j ?? 0)}</span></div>
        </div>
      ) : (
        <div className="flex gap-2 mb-4">
          <div className="stat" hidden={!showStat('surahCount')}><b>{toFa(occurrences.length)}</b><span>{t("ui.a61e12c4f4")}</span></div>
          <div className="stat" hidden={!showStat('total') || !distribution}><b>{total === null ? '…' : toFa(total)}</b><span>{t("ui.a8c837e497")}</span></div>
          <div className="stat" hidden={!showStat('ayahCount')}><b>{toFa(groups.length)}</b><span>{t("ui.144803fc72")}</span></div>
          {distribution && showStat('hosts') && <div className="stat"><b>{toFa(Object.keys(distribution).length)}</b><span>{t("ui.637842efc1")}</span></div>}
        </div>
      )}
      </AnalysisSection>}
      {indexError && tab !== 'verse' && <p role="alert" className="text-xs" style={{ order: 2 }}>{t("ui.6c9c33bd30")}</p>}
    </div>
  )
}
