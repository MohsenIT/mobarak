'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SurahData, Translations, Meta } from '@/lib/quran'
import { loadGlobalRoots, loadSurah, loadTrans, keywordScore, keywordTier, spacedRoot, toFa, morphologyLabel } from '@/lib/quran'
import type { Selection } from './MushafPage'
import { nextAnalysisLocation, type AnalysisTab, type AnalysisSelection } from '@/lib/analysis'
import SelectionDetails from './SelectionDetails'
import ContextDetails from './ContextDetails'
import { getContext } from '@/lib/contexts'
import QuranText from './QuranText'
import { IconClose, IconMaximize, IconRestore, IconRoot, IconSortIndex } from './Ornaments'

interface Props {
  comparisonRange?: { s: number; from: number; to: number } | null
  onSelectionChange: (selection: AnalysisSelection) => void
  sel: Selection
  meta: Meta
  translator: 'a' | 'f' | 'm'
  /** when true, the panel goes full-screen / wide (mobile + desktop) */
  maximized: boolean
  onToggleMax: () => void
  /** open the surah index page */
  onOpenIndex: () => void
  onClose: () => void
  /** jump inside current surah — panel stays open */
  onJump: (s: number, a: number, pos: number, page: number) => void
  /** jump to a root occurrence in another surah — panel retargets */
  onJumpSurah: (surahN: number, root: string) => void
  /** when true, the surah-index drawer is also open and this panel
      needs to render above it (z-index bump). False when the panel
      was opened from a word tap with no index drawer behind it. */
  stackedOverIndex?: boolean
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export default function RootPanel({
  sel: anchor, onSelectionChange, meta, translator, maximized, onToggleMax, onOpenIndex, onClose, onJump, onJumpSurah,
  stackedOverIndex = false, comparisonRange,
}: Props) {
  const [tab, setTab] = useState<AnalysisTab>('root')
  const [targets, setTargets] = useState<Record<AnalysisTab, Selection>>({ root: anchor, form: anchor, word: anchor, verse: anchor, context: anchor })
  const sel = targets[tab]
  const [surah, setSurah] = useState<SurahData | null>(null)
  const [globalRoots, setGlobalRoots] = useState<Record<string, Record<string, number>> | null>(null)
  const [trans, setTrans] = useState<Translations | null>(null)
  const [sheetH, setSheetH] = useState(46)
  const dragRef = useRef<{ y: number; h: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    setSurah(null); setTrans(null)
    loadSurah(sel.s).then(d => live && setSurah(d))
    loadTrans(sel.s).then(t => live && setTrans(t))
    loadGlobalRoots().then(r => live && setGlobalRoots(r))
    return () => { live = false }
  }, [sel.s])

  const root = sel.root

  const byAyah = useMemo(() => {
    if (!root || !surah) return []
    const groups = new Map<number, number[]>()
    for (const [a, pos] of surah.ri[root] || []) {
      if (!groups.has(a)) groups.set(a, [])
      groups.get(a)!.push(pos)
    }
    return Array.from(groups.entries())
  }, [root, surah])

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

  const verseTr = trans?.[String(sel.a)]?.[translator]
  const selectedForm = surah?.n === sel.s ? surah.v.find(v => v.n === sel.a)?.w[sel.pos - 1]?.form : undefined

  const selectedContext = getContext(sel.s, sel.a)

  useEffect(() => {
    onSelectionChange({ ...sel, tab, form: selectedForm, from: selectedContext?.from, to: selectedContext?.to })
  }, [sel, tab, selectedForm, selectedContext, onSelectionChange])

  const selectTarget = (a: number, pos: number) => {
    if (!surah) return
    const verse = surah.v.find(v => v.n === a)
    const word = verse?.w[pos - 1]
    if (!word || !verse) return
    setTargets(current => ({ ...current, [tab]: { s: sel.s, a, pos, text: word.t, root: word.r ?? null } }))
    onJump(sel.s, a, pos, verse.p)
  }

  const navigate = (direction: number) => {
    if (!surah) return
    const location = nextAnalysisLocation(surah, { ...sel, tab, form: selectedForm }, direction)
    if (location) selectTarget(...location)
  }

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.matches('input, textarea, select') || event.target.closest('[role="tablist"]'))) return
      if (event.key === 'ArrowRight') { event.preventDefault(); navigate(-1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(1) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [tab, sel, surah, selectedForm])

  // drag handle (mobile, only when not maximized)
  //
  // Behavior change per user request: dragging down should COLLAPSE
  // the panel to just the handle (so most of the screen shows the
  // Quran with the highlighted root visible), NOT close it. The user
  // wants to keep the highlight alive while seeing more of the mushaf.
  // The panel only closes via the X button or backdrop tap.
  const onHandleDown = (e: React.PointerEvent) => {
    if (maximized) return
    dragRef.current = { y: e.clientY, h: sheetH }
    panelRef.current?.classList.add('dragging')
    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return
      const dy = dragRef.current.y - ev.clientY
      const dh = (dy / window.innerHeight) * 100
      // Allow dragging down to a very small height (just the handle ~8dvh).
      // The panel stays open at any height — only the X button or backdrop
      // actually closes it.
      setSheetH(clamp(dragRef.current.h + dh, 8, 88))
    }
    const up = (ev: PointerEvent) => {
      const dy = dragRef.current ? dragRef.current.y - ev.clientY : 0
      dragRef.current = null
      panelRef.current?.classList.remove('dragging')
      // Snap based on the FINAL height (not the drag delta).
      // - h > 45 → expand to 80dvh
      // - h ≤ 45 → collapse to 8dvh (just the handle bar)
      // Never close on drag.
      setSheetH(h => h > 45 ? 80 : 8)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const panelClass = `root-panel${maximized ? ' maximized' : ''}${stackedOverIndex ? ' stacked' : ''}`

  return (
    <>
      {maximized && <div className="panel-backdrop" onClick={onClose} />}
      <div
        ref={panelRef}
        className={panelClass}
        role="dialog"
        aria-label="تحلیل ریشه کلمه"
        style={!maximized ? { ['--sheet-h' as string]: `${sheetH}dvh` } : undefined}
      >
        <div className="panel-handle" onPointerDown={onHandleDown} />

        {/* ===== Single-row header: word + root inline + chip + actions =====
            Everything on ONE line — no wrapping. Word and root must sit
            side-by-side (user complained the root was wrapping to a 2nd line). */}
        <div className="panel-header" style={{ borderColor: 'var(--line)' }}>
          <span className="font-quran panel-word" dir="rtl">
            {tab === 'context' ? (selectedContext ? `سیاق ${toFa(selectedContext.id)}` : 'سیاق') : tab === 'verse' ? `آیه ${toFa(sel.a)}` : <QuranText text={sel.text} />}
          </span>
          {tab === 'root' && root && (
            <span className="root-inline" dir="rtl">
              <IconRoot />
              <span className="font-quran root-letters">{spacedRoot(root)}</span>
            </span>
          )}
          <span className="chip panel-chip hidden sm:inline-flex">سوره {meta.surahs[sel.s - 1]?.fa} · آیه {toFa(sel.a)}</span>
          <div className="panel-actions">
            <button className="icon-btn sm" onClick={onOpenIndex} title="فهرست کلیدواژه‌های سوره" aria-label="فهرست کلیدواژه‌های سوره">
              <IconSortIndex />
            </button>
            <button className="icon-btn sm" onClick={onToggleMax} aria-label={maximized ? 'بازگرداندن به نیم‌صفحه' : 'تمام‌صفحه'}
              title={maximized ? 'بازگرداندن به نیم‌صفحه' : 'تمام‌صفحه'}>
              {maximized ? <IconRestore /> : <IconMaximize />}
            </button>
            <button className="icon-btn sm" onClick={onClose} aria-label="بستن" title="بستن">
              <IconClose />
            </button>
          </div>
        </div>

        <div className="flex border-b px-2" role="tablist" aria-label="نوع تحلیل" style={{ borderColor: 'var(--line)' }}>
          {([['root', 'ریشه'], ['form', 'باب'], ['word', 'واژه'], ['verse', 'آیه'], ['context', 'سیاق']] as const).map(([key, label]) => (
            <button key={key} role="tab" id={`analysis-tab-${key}`} aria-controls={`analysis-panel-${key}`} aria-selected={tab === key}
              className={`tab-btn flex-1${tab === key ? ' active' : ''}`} onClick={() => { setTab(key); const target = targets[key]; loadSurah(target.s).then(d => onJump(target.s, target.a, target.pos, d.v[target.a - 1].p)) }}>{label}</button>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-2 text-xs border-b" style={{ borderColor: 'var(--line)' }}>
          <button onClick={() => navigate(-1)} aria-label={tab === 'context' ? 'سیاق قبل' : tab === 'verse' ? 'آیه قبل' : tab === 'word' ? 'واژه قبل' : tab === 'form' ? 'باب قبل' : 'ریشه قبل'}>→ {tab === 'context' ? 'سیاق قبل' : tab === 'verse' ? 'آیه قبل' : tab === 'word' ? 'واژه قبل' : tab === 'form' ? 'باب قبل' : 'ریشه قبل'}</button>
          <span>آیه {toFa(sel.a)} · واژه {toFa(sel.pos)}</span>
          <button onClick={() => navigate(1)} aria-label={tab === 'context' ? 'سیاق بعد' : tab === 'verse' ? 'آیه بعد' : tab === 'word' ? 'واژه بعد' : tab === 'form' ? 'باب بعد' : 'ریشه بعد'}>{tab === 'context' ? 'سیاق بعد' : tab === 'verse' ? 'آیه بعد' : tab === 'word' ? 'واژه بعد' : tab === 'form' ? 'باب بعد' : 'ریشه بعد'} ←</button>
        </div>
        <div role="tabpanel" id={`analysis-panel-${tab}`} aria-labelledby={`analysis-tab-${tab}`} className="overflow-y-auto nice-scroll px-5 py-4 flex-1" style={{ overscrollBehavior: 'contain' }}>
          {tab !== 'root' ? (surah?.n === sel.s && trans ? (tab === 'context' ? <ContextDetails selection={sel} surah={surah} trans={trans} translator={translator} onPick={selectTarget} /> : <SelectionDetails tab={tab} selection={{ ...sel, tab, form: selectedForm }} surah={surah} trans={trans} translator={translator} onPick={selectTarget} comparisonRange={comparisonRange} />) : <p role="status">در حال بارگیری…</p>) : <>
          {!root ? (
            <div className="text-center py-6" style={{ color: 'var(--ink-soft)' }}>
              <p className="text-sm leading-8">این واژه حرف یا ضمیر است و ریشهٔ مستقلی ندارد.</p>
              {verseTr && (
                <p className="mt-4 text-justify rounded-xl px-3 py-2"
                  style={{ background: 'color-mix(in srgb, var(--paper) 60%, transparent)', border: '1px solid var(--line)', fontSize: 13.5, lineHeight: 2 }}>
                  {verseTr}
                </p>
              )}
            </div>
          ) : (
            <>
              {stats && (
                <>
                  <div className="flex gap-2 mb-4">
                    <div className="stat">
                      <b>{toFa(stats.inSurah)}</b>
                      <span>بار در این سوره</span>
                    </div>
                    <div className="stat">
                      <b>{toFa(stats.total)}</b>
                      <span>بار در کل قرآن</span>
                    </div>
                    <div className="stat">
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

                  {/* share of this surah */}
                  <div className="rounded-xl border px-3 py-2.5 mb-4" style={{ borderColor: 'var(--line)' }}>
                    <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--ink-soft)' }}>
                      <span>سهم این سوره از همهٔ کاربردهای ریشه</span>
                      <b style={{ color: 'var(--ink)' }}>{toFa(Math.round(stats.share * 100))}٪</b>
                    </div>
                    <div className="dist-track">
                      <div className="dist-fill cur" style={{ width: `${Math.max(2, stats.share * 100)}%` }} />
                    </div>
                  </div>

                  {/* distribution across surahs */}
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-faint)' }}>
                    پراکندگی ریشه در قرآن — برای پرش لمس کنید
                  </p>
                  <div className="flex flex-col mb-4">
                    {stats.top.map(d => (
                      <button key={d.s} className="dist-row" onClick={() => { loadSurah(d.s).then(data => { const occurrence = data.ri[root]?.[0]; if (!occurrence) return; const [a, pos] = occurrence; const w = data.v[a - 1].w[pos - 1]; setTargets(current => ({ ...current, root: { s: d.s, a, pos, text: w.t, root } })); onJump(d.s, a, pos, data.v[a - 1].p) }) }}>
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
                </>
              )}

              {verseTr && (
                <p className="mb-4 text-justify rounded-xl px-3 py-2"
                  style={{ background: 'color-mix(in srgb, var(--paper) 60%, transparent)', border: '1px solid var(--line)', color: 'var(--ink-soft)', fontSize: 13.5, lineHeight: 2 }}>
                  {verseTr}
                </p>
              )}

              {comparisonRange?.s === sel.s && <p className="text-xs mb-3"><span className="range-inside rounded px-2 py-1">درون بازه</span>{' · '}<span className="range-outside rounded px-2 py-1">بیرون بازه</span></p>}
              {surah && (
                <>
                  <p className="text-xs mb-2 font-medium" style={{ color: 'var(--ink-faint)' }}>
                    واژه‌های هم‌ریشه در این سوره — برای پرش لمس کنید
                  </p>
                  <div className="flex flex-col gap-2 pb-2">
                    {byAyah.map(([ayah, poses]) => {
                      const verse = surah.v[ayah - 1]
                      if (!verse) return null
                      return (
                        <button key={ayah} className="occ-row"
                          onClick={() => selectTarget(ayah, poses[0])}>
                          <span className="chip flex-none mt-1" style={{ borderColor: 'var(--sage)', color: 'var(--ink)' }}>
                            آیه {toFa(ayah)}
                          </span>
                          <span className="font-quran" dir="rtl" style={{ fontSize: 19, lineHeight: 1.9, color: 'var(--ink)' }}>
                            {verse.w.map((w, i) => (
                              <span key={i}>
                                <span className={poses.includes(i + 1) ? `hl${comparisonRange?.s === sel.s ? (ayah >= comparisonRange.from && ayah <= comparisonRange.to ? ' range-inside' : ' range-outside') : ''}` : ''}>
                                  <QuranText text={w.t} />
                                </span>{' '}
                              </span>
                            ))}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
          </>}
        </div>
      </div>
    </>
  )
}
