'use client'
import {studyT as st} from '@/lib/study-messages'
import {saveStudy,studyUrl,useStudyWorkspace} from '@/lib/study-store'
import {t} from '@/lib/i18n'

import type { Selection } from './MushafPage'
import type { SurahData } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import { contextSource, getContext, getSurahContexts } from '@/lib/contexts'
import SourceReference from './SourceReference'
import { AnalysisSection, STAT_OPTIONS, useAnalysisPreferences } from './AnalysisSections'

interface Props {
  selection: Selection
  surah: SurahData
  onCompare: (s: number, from: number, to: number) => void
  onPick: (a: number, pos: number) => void
}
export default function ContextDetails({ selection, surah, onPick, onCompare }: Props) {
  const {work}=useStudyWorkspace()
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
      {surah.n===20&&work&&<section className="study-version"><div className="study-actions"><button aria-pressed={!work.active} onClick={()=>void saveStudy({...work,active:false})}>{st('source')}</button><button aria-pressed={work.active} onClick={()=>void saveStudy({...work,active:true})}>{st('personal')}</button></div><a href={studyUrl()}>{st('entry')}</a></section>}
      {context?.title&&<h3 className="font-bold">{context.title}</h3>}
      {context && showMeaning('note') && !!(context.note || source) && <AnalysisSection tab="context" kind="meaning">
      {showMeaning('note') && <div className="mb-3">
        <SourceReference label={t("ui.92649bd7f9")} source={{
          title: contextSource.title,
          description: t("ui.2bfd4864cf"),
          fields: [{ label: t("ui.4fc7a5a7c2"), value: contextSource.publisher }, { label: t("ui.e1280ac99b"), value: t("ui.cea73c0237") }, context?.origin === 'user-clarification' ? { label: t("ui.191f2cdcd2"), value: t("ui.b43be2bd00") } : { label: t("ui.2cc6a9014c"), value: t("ui.f9119fddb7",{p0:(toFa(page))}) }],
          notes: [context?.origin === 'personal'?st('sourceInfo'):context?.origin === 'user-clarification' ? t("ui.bba0200510") : t("ui.79d0d683fb")],
          links: [{ label: context?.origin === 'user-clarification' ? t("ui.1024a32c6c") : t("ui.662e05e5a4",{p0:(toFa(page))}), href: context?.origin === 'user-clarification' ? contextSource.url : `${contextSource.url}#page=${page}` }],
        }} />
        {context.note && <p className="text-xs leading-6 mt-3">{context.note}</p>}
      </div>}
      </AnalysisSection>}
      {context && STAT_OPTIONS.context.some(option => showStat(option.id)) && <AnalysisSection tab="context" kind="stats">
        <div className="flex gap-2">
          <div className="stat" hidden={!showStat('verses')}><b>{toFa(verses.length)}</b><span>{t("ui.72203547c8")}</span></div>
          <div className="stat" hidden={!showStat('words')}><b>{toFa(wordCount)}</b><span>{t("ui.c8b65fe880")}</span></div>
          <div className="stat" hidden={!showStat('roots')}><b>{toFa(roots.size)}</b><span>{t("ui.8bbf1cab23")}</span></div>
        </div>
      </AnalysisSection>}
      <div className="analysis-examples">
      {!context ? <p role="status" className="text-sm leading-8">{t("ui.1e93a690ed")}</p> : (
        <>
          <h3 className="font-bold text-sm mb-2">{context.sourceLabel ? t("ui.6090105c4a",{p0:(context.sourceLabel)}) : t("ui.3050486f3e",{p0:(toFa(context.id)),p1:(toFa(source?.ranges.length ?? 0))})}{' '}{t("ui.69a4606f3f")}{' '}{toFa(context.from)}{' '}{t("ui.b1e000640d")}{' '}{toFa(context.to)}</h3>
          <button className="rounded-xl border px-3 py-2 mb-3 text-sm w-full" style={{ borderColor: 'var(--sage)', color: 'var(--sage)' }}
            onClick={() => onCompare(surah.n, context.from, context.to)}>{t("ui.6c8483cc24")}</button>
          <section className="text-xs mb-3" aria-label={t("ui.05ab2e3ac9")}>
            <p className="font-bold">{t("ui.dcff10738a")}</p>
            <div className="flex flex-wrap gap-2 mt-2">{source?.ranges.map(range => <button key={range.id} aria-pressed={range.id === context.id} className="chip" onClick={() => onPick(range.from, 1)} style={range.id === context.id ? { background: 'var(--word-active)' } : undefined}>{t("ui.d83f4af983")}{' '}{toFa(range.from)}–{toFa(range.to)}</button>)}</div>
          </section>
        </>
      )}
      </div>
    </div>
  )
}
