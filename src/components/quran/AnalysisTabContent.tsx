'use client'
import { useEffect, useMemo, useState } from 'react'
import type { Translator, SurahData, Translations, Meta } from '@/lib/quran'
import { loadGlobalRoots, loadSurah, loadTrans, keywordScore, keywordTier, toFa } from '@/lib/quran'
import type { Selection } from './MushafPage'
import type { AnalysisTab } from '@/lib/analysis'
import { wordTarget, type WordPart } from '@/lib/word-parts'
import SelectionDetails from './SelectionDetails'
import ContextDetails from './ContextDetails'
import RootMeaning from './RootMeaning'
import { AnalysisSection, STAT_OPTIONS, useAnalysisPreferences } from './AnalysisSections'

export default function AnalysisTabContent({ tab, selection: sel, meta, translator, comparisonRange, onPick: selectTarget, onCompareContext, onRootTarget }: {
  tab: AnalysisTab; selection: Selection; meta: Meta; translator: Translator
  comparisonRange?: { s: number; from: number; to: number } | null
  onPick: (a: number, pos: number, part?: WordPart) => void
  onCompareContext: (s: number, from: number, to: number) => void
  onRootTarget: (selection: Selection, page: number) => void
}) {
  const { enabled } = useAnalysisPreferences()
  const showStat = (id: string) => enabled('root', 'stats', id)
  const [data, setData] = useState<{ surah: SurahData; trans: Translations | null } | null>(null)
  const surah = data?.surah.n === sel.s ? data.surah : null
  const trans = surah ? data!.trans : null
  const [globalRoots, setGlobalRoots] = useState<Record<string, Record<string, number>> | null>(null)
  useEffect(() => {
    let live = true
    Promise.all([loadSurah(sel.s), tab === 'root' ? Promise.resolve(null) : loadTrans(sel.s)]).then(([surah, trans]) => { if (live) setData({ surah, trans }) })
    if (tab === 'root') loadGlobalRoots().then(data => { if (live) setGlobalRoots(data) })
    return () => { live = false }
  }, [sel.s, tab])
  const root = sel.root
  const stats = useMemo(() => {
    if (!root || !surah || !globalRoots) return null
    const g = globalRoots[root]
    if (!g) return null
    const inSurah = (surah.ri[root] || []).length
    const total = Object.values(g).reduce((a, b) => a + b, 0)
    const df = Object.keys(g).length
    const share = total > 0 ? inSurah / total : 0
    const surahWords = surah.v.reduce((n, v) => n + v.w.length, 0)
    const surahDensity = surahWords > 0 ? inSurah / surahWords : 0
    const score = keywordScore({ inSurah, total, surahWords, df })
    const tier = keywordTier(score)
    const dist = Object.entries(g)
      .map(([s, c]) => ({ s: +s, c }))
      .sort((a, b) => b.c - a.c)
    const top = dist.slice(0, 5)
    if (!top.some(d => d.s === sel.s)) {
      const cur = dist.find(d => d.s === sel.s)
      if (cur) top.push(cur)
    }
    const maxC = top.length ? top[0].c : 1
    return { inSurah, total, df, share, surahDensity, score, tier, top, maxC }
  }, [root, surah, globalRoots, sel.s])

  const selectedForm = sel.part !== 'prefix' && surah?.n === sel.s ? surah.v.find(v => v.n === sel.a)?.w[sel.pos - 1]?.form : undefined

  return <>          {tab !== 'root' ? (surah?.n === sel.s && trans ? (tab === 'context' ? <ContextDetails selection={sel} surah={surah} trans={trans} translator={translator} onPick={selectTarget} onCompare={onCompareContext} /> : <SelectionDetails tab={tab} selection={{ ...sel, tab, form: selectedForm }} surah={surah} trans={trans} translator={translator} onPick={selectTarget} comparisonRange={comparisonRange} />) : <p role="status">در حال بارگیری…</p>) : <>
          {!root ? (
            <div className="text-center py-6" style={{ color: 'var(--ink-soft)' }}>
              <p className="text-sm leading-8">این واژه حرف یا ضمیر است و ریشهٔ مستقلی ندارد.</p>
            </div>
          ) : (
            <div className="analysis-section-stack">
              <RootMeaning key={root} root={root} />
              {stats && STAT_OPTIONS.root.some(option => showStat(option.id)) && (
                <AnalysisSection tab="root" kind="stats">
                  <div className="flex gap-2 mb-4" hidden={!(['surahCount', 'total', 'hosts'].some(showStat))}>
                    <div className="stat" hidden={!showStat('surahCount')}>
                      <b>{toFa(stats.inSurah)}</b>
                      <span>بار در این سوره</span>
                    </div>
                    <div className="stat" hidden={!showStat('total')}>
                      <b>{toFa(stats.total)}</b>
                      <span>بار در کل قرآن</span>
                    </div>
                    <div className="stat" hidden={!showStat('hosts')}>
                      {/* Host surahs: "df / 114" where df = number of surahs
                          containing this root, 114 = total surahs in the Quran.
                          Styled EXACTLY like the other two stats — plain bold
                          text, no badge/background/border. Single text node so
                          the bidi algorithm renders cleanly.

                          Order per user request: total (۱۱۴) on the RIGHT
                          (first in RTL reading), count on the LEFT (second).
                          Reading RTL: "۱۱۴ / count" — i.e. "out of 114 surahs,
                          this many host this root". */}
                      <b>۱۱۴ / {toFa(stats.df)}</b>
                      <span>سوره میزبان</span>
                    </div>
                  </div>

                  <div hidden={!showStat('keyword')}>
                  {/* keyword gauge — v3 lift-based score.
                      Now a proper progress bar: empty track + filled portion
                      whose width = score*100%. In RTL, fill grows from the
                      right (low end, "حاشیه‌ای") toward the left (high end,
                      "محوری"). At score=1.0 the entire bar is filled. */}
                  <div className="mb-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                    <span>حاشیه‌ای</span>
                    <span className="font-medium" style={{ color: 'var(--ink-soft)' }}>شاخص کلیدواژگی در این سوره</span>
                    <span>محوری</span>
                  </div>
                  <div className="gauge gauge-keyword mb-1.5">
                    <div className="gauge-fill" style={{ width: `${stats.score * 100}%` }} />
                  </div>
                  <p className="text-xs mb-4 text-center" style={{ color: 'var(--ink-soft)' }}>{stats.tier.label}</p>

                  </div>
                  {/* share of this surah */}
                  <div hidden={!showStat('share')} className="rounded-xl border px-3 py-2.5 mb-4" style={{ borderColor: 'var(--line)' }}>
                    <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--ink-soft)' }}>
                      <span>سهم این سوره از همهٔ کاربردهای ریشه</span>
                      <b style={{ color: 'var(--ink)' }}>{toFa(Math.round(stats.share * 100))}٪</b>
                    </div>
                    <div className="dist-track">
                      <div className="dist-fill cur" style={{ width: `${Math.max(2, stats.share * 100)}%` }} />
                    </div>
                  </div>

                  <div hidden={!showStat('distribution')}>
                  {/* distribution across surahs */}
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-faint)' }}>
                    پراکندگی ریشه در قرآن — برای پرش لمس کنید
                  </p>
                  <div className="flex flex-col mb-4">
                    {stats.top.map(d => (
                      <button key={d.s} className="dist-row" onClick={() => { loadSurah(d.s).then(data => { const occurrence = data.ri[root]?.[0]; if (!occurrence) return; const [a, pos] = occurrence; const w = data.v[a - 1].w[pos - 1]; onRootTarget({ s: d.s, a, pos, ...wordTarget(w), root }, data.v[a - 1].p) }) }}>
                        <span className="text-xs w-16 text-right flex-none" style={{ color: d.s === sel.s ? 'var(--ink)' : 'var(--ink-soft)', fontWeight: d.s === sel.s ? 700 : 400 }}>
                          {meta.surahs[d.s - 1]?.fa}
                        </span>
                        <span className="dist-track">
                          <span className={`dist-fill${d.s === sel.s ? ' cur' : ''}`}
                            style={{ width: `${(d.c / stats.maxC) * 100}%`, display: 'block' }} />
                        </span>
                        <span className="text-xs w-8 flex-none text-left" style={{ color: 'var(--ink-faint)' }}>{toFa(d.c)}</span>
                      </button>
                    ))}
                  </div>
                  </div>
                </AnalysisSection>
              )}

            </div>
          )}
          </>}</>
}
