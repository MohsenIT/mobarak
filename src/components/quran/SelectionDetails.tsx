'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Translator, SurahData, Translations } from '@/lib/quran'
import { morphologyLabel, formName, toFa } from '@/lib/quran'
import { analysisOccurrences, type AnalysisSelection, type AnalysisTab } from '@/lib/analysis'
import { lexicalKey } from '@/lib/word-parts'
import VerseActions from './VerseActions'
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

  if (tab === 'form' && !selection.form) return <p className="text-sm leading-8">برای این واژه باب صرفی در منبع ثبت نشده است؛ باب از روی ریشه حدس زده نمی‌شود.</p>

  const translation = trans[String(selection.a)]?.[translator]
  const hasMeaning = (tab === 'form' && showMeaning('morphology') && !!selection.form) || (tab === 'word' && showMeaning('lemma')) || (tab === 'verse' && showMeaning('translation') && !!translation)
  return (
    <div className="analysis-section-stack">
      {tab === 'verse' && verse && <VerseActions key={`${surah.n}:${verse.n}:${translator}`} surah={surah} verse={verse} translation={translation} />}
      {hasMeaning && <AnalysisSection tab={tab} kind="meaning">
      {tab === 'form' && showMeaning('morphology') && (
        <div className="rounded-xl border p-3 mb-3 text-sm" style={{ borderColor: 'var(--line)' }}>
          <p>{formName(selection.root, selection.form) && <b>{formName(selection.root, selection.form)} · </b>}باب / ساخت صرفی: <b>{morphologyLabel(selection.form!)}</b> <span dir="ltr">({selection.form})</span></p>
          <p className="text-xs leading-6 mt-1">واژه‌های همین ریشه در همین باب انتخاب شده‌اند.</p>
          <div className="mt-2"><SourceReference label="منبع صرف و باب" source={{
            title: 'Quranic Arabic Corpus',
            description: 'پیکرهٔ برچسب‌گذاری صرفی و نحوی قرآن؛ مأخذ باب و ساخت صرفی واژه‌ها در این سایت.',
            fields: [{ label: 'پدیدآورنده', value: 'Kais Dukes' }, { label: 'نسخه', value: 'داده‌های صرفی ۰٫۴ · ۲۰۱۱ میلادی' }, { label: 'متن پایه', value: 'متن عثمانی تنزیل، نسخهٔ ۱٫۰٫۲' }, { label: 'مجوز', value: 'داده‌های پیکره: GNU GPL؛ متن تنزیل: CC BY-ND 3.0' }],
            notes: ['باب برای موارد ثبت‌شده در داده نمایش داده می‌شود و از روی ریشه حدس زده نمی‌شود.'],
            links: [{ label: 'وبگاه پیکره', href: 'https://corpus.quran.com' }, { label: 'حقوق و مشخصات داده', href: '/data/morphology-source.txt' }, { label: 'تنزیل', href: 'https://tanzil.net' }],
          }} /></div>
        </div>
      )}
      {tab === 'word' && showMeaning('lemma') && <p className="text-xs leading-6 mb-3">آمار و تکرارها بر پایهٔ لِمّا است؛ صورت‌های صرفی و ضمیرهای پیوستهٔ یک واژه با هم شمرده می‌شوند.</p>}
      {tab === 'verse' && showMeaning('translation') && translation && <p className="text-sm leading-8 text-justify">{translation}</p>}
      </AnalysisSection>}
      {STAT_OPTIONS[tab].some(option => showStat(option.id) && (option.id !== 'total' && option.id !== 'hosts' || !!distribution)) && <AnalysisSection tab={tab} kind="stats">
      {tab === 'verse' ? (
        <div className="flex gap-2 mb-4">
          <div className="stat" hidden={!showStat('words')}><b>{toFa(verse?.w.length ?? 0)}</b><span>واژه در آیه</span></div>
          <div className="stat" hidden={!showStat('roots')}><b>{toFa(distinctRoots)}</b><span>ریشهٔ متفاوت</span></div>
          <div className="stat" hidden={!showStat('page')}><b>{toFa(verse?.p ?? 0)}</b><span>صفحه · جزء {toFa(verse?.j ?? 0)}</span></div>
        </div>
      ) : (
        <div className="flex gap-2 mb-4">
          <div className="stat" hidden={!showStat('surahCount')}><b>{toFa(occurrences.length)}</b><span>بار در سوره</span></div>
          <div className="stat" hidden={!showStat('total') || !distribution}><b>{total === null ? '…' : toFa(total)}</b><span>بار در قرآن</span></div>
          <div className="stat" hidden={!showStat('ayahCount')}><b>{toFa(groups.length)}</b><span>آیه در این سوره</span></div>
          {distribution && showStat('hosts') && <div className="stat"><b>{toFa(Object.keys(distribution).length)}</b><span>سوره میزبان</span></div>}
        </div>
      )}
      </AnalysisSection>}
      {indexError && tab !== 'verse' && <p role="alert" className="text-xs" style={{ order: 2 }}>آمار کل قرآن بارگیری نشد؛ آمار این سوره نمایش داده می‌شود.</p>}
    </div>
  )
}
