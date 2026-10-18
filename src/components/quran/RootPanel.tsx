'use client'
import { wordTarget, type WordPart } from '@/lib/word-parts'

import { useEffect, useRef, useState } from 'react'
import type { Translator, SurahData, Meta } from '@/lib/quran'
import { loadSurah, spacedRoot, toFa, morphologyLabel, formName } from '@/lib/quran'
import type { Selection } from './MushafPage'
import { nextAnalysisLocation, type AnalysisTab, type AnalysisSelection } from '@/lib/analysis'
import AnalysisTabContent from './AnalysisTabContent'
import SwipeTabPages from './SwipeTabPages'
import { getContext } from '@/lib/contexts'
import QuranText from './QuranText'
import { IconClose, IconMaximize, IconRestore, IconRoot, IconSortIndex } from './Ornaments'

interface Props {
  comparisonRange?: { s: number; from: number; to: number } | null
  onCompareContext: (s: number, from: number, to: number) => void
  onSelectionChange: (selection: AnalysisSelection) => void
  sel: Selection
  meta: Meta
  translator: Translator
  /** when true, the panel goes full-screen / wide (mobile + desktop) */
  sheetH: number
  onSheetHeightChange: (height: number) => void
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

const TABS = [['root', 'ریشه'], ['form', 'باب'], ['word', 'واژه'], ['verse', 'آیه'], ['context', 'سیاق']] as const

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export default function RootPanel({
  sel: anchor, onSelectionChange, onCompareContext, meta, translator, maximized, onToggleMax, onOpenIndex, onClose, onJump, onJumpSurah,
  stackedOverIndex = false, comparisonRange, sheetH, onSheetHeightChange: setSheetH,
}: Props) {
  const [tab, setTab] = useState<AnalysisTab>(anchor.part === 'prefix' ? 'word' : 'root')
  const [targets, setTargets] = useState<Record<AnalysisTab, Selection>>({ root: anchor, form: anchor, word: anchor, verse: anchor, context: anchor })
  const sel = targets[tab]
  const [surah, setSurah] = useState<SurahData | null>(null)
  const dragRef = useRef<{ y: number; h: number } | null>(null)
  const [formAvailable, setFormAvailable] = useState<boolean | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    setSurah(null)
    loadSurah(sel.s).then(d => live && setSurah(d))
    return () => { live = false }
  }, [sel.s])

  const formTarget = targets.form
  useEffect(() => {
    let live = true
    setFormAvailable(null)
    loadSurah(formTarget.s).then(data => {
      if (live) setFormAvailable(!!data.v[formTarget.a - 1]?.w[formTarget.pos - 1]?.form && !!formTarget.root)
    }).catch(() => { if (live) setFormAvailable(false) })
    return () => { live = false }
  }, [formTarget])

  const switchTab = (key: AnalysisTab) => {
    if (key === tab || (key === 'form' && !formAvailable)) return
    setTab(key)
    const target = targets[key]
    loadSurah(target.s).then(data => onJump(target.s, target.a, target.pos, data.v[target.a - 1].p))
  }
  const root = sel.root

  const selectedForm = sel.part !== 'prefix' && surah?.n === sel.s ? surah.v.find(v => v.n === sel.a)?.w[sel.pos - 1]?.form : undefined

  const selectedContext = getContext(sel.s, sel.a)

  useEffect(() => {
    onSelectionChange({ ...sel, tab, form: selectedForm, from: selectedContext?.from, to: selectedContext?.to })
  }, [sel, tab, selectedForm, selectedContext, onSelectionChange])

  const selectTargetFor = (key: AnalysisTab, a: number, pos: number, part?: WordPart) => {
    const currentTarget = targets[key]
    if (!surah || surah.n !== currentTarget.s) return
    const verse = surah.v.find(v => v.n === a)
    const word = verse?.w[pos - 1]
    if (!word || !verse) return
    const target = { s: currentTarget.s, a, pos, ...wordTarget(word, part ?? (key === 'word' ? currentTarget.part : undefined)) }
    setTargets(current => ({ ...current, [key]: target, ...(key === 'root' ? { form: target } : {}) }))
    onJump(currentTarget.s, a, pos, verse.p)
  }

  const selectTarget = (a: number, pos: number, part?: WordPart) => selectTargetFor(tab, a, pos, part)

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

  // Keep the exact released height; presets are an explicit alternative.
  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (maximized) return
    dragRef.current = { y: e.clientY, h: sheetH }
    e.currentTarget.setPointerCapture(e.pointerId)
    panelRef.current?.classList.add('dragging')
  }
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current
    if (!start) return
    const viewport = window.visualViewport?.height ?? window.innerHeight
    setSheetH(clamp(start.h + (start.y - e.clientY) / viewport * 100, 8, 88))
  }
  const onHandleEnd = () => {
    dragRef.current = null
    panelRef.current?.classList.remove('dragging')
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
        style={{ touchAction: 'pan-y', ...(!maximized ? { ['--sheet-h' as string]: `${sheetH}dvh` } : {}) }}
      >
        <div className="panel-handle" role="slider" tabIndex={maximized ? -1 : 0}
          aria-label="ارتفاع باتم‌شیت" aria-orientation="vertical" aria-valuemin={8} aria-valuemax={88}
          aria-valuenow={Math.round(sheetH)} aria-valuetext={`${toFa(Math.round(sheetH))} درصد صفحه`}
          onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleEnd}
          onPointerCancel={onHandleEnd} onLostPointerCapture={onHandleEnd}
          onKeyDown={event => {
            const next = event.key === 'ArrowUp' ? sheetH + 5 : event.key === 'ArrowDown' ? sheetH - 5 : event.key === 'Home' ? 8 : event.key === 'End' ? 88 : null
            if (next !== null && !maximized) { event.preventDefault(); setSheetH(clamp(next, 8, 88)) }
          }} />

        {/* ===== Single-row header: word + root inline + chip + actions =====
            Everything on ONE line — no wrapping. Word and root must sit
            side-by-side (user complained the root was wrapping to a 2nd line). */}
        <div className="panel-header" style={{ borderColor: 'var(--line)' }}>
          <span className={`${tab === 'verse' || tab === 'context' || tab === 'form' ? '' : 'font-quran '}panel-word`} dir="rtl">
            {tab === 'root' && root ? spacedRoot(root) : tab === 'form' ? `${formName(root, selectedForm) ?? ''} (${selectedForm ? morphologyLabel(selectedForm) : 'باب'})` : tab === 'context' ? (selectedContext ? `سیاق ${toFa(selectedContext.id)}` : 'سیاق') : tab === 'verse' ? `آیه ${toFa(sel.a)}` : <QuranText text={sel.text} />}
          </span>
          <span className="chip panel-chip hidden sm:inline-flex">سوره {meta.surahs[sel.s - 1]?.fa} · {tab === 'context' && selectedContext ? `آیات ${toFa(selectedContext.from)} تا ${toFa(selectedContext.to)}` : `آیه ${toFa(sel.a)}`}</span>
          <div className="panel-actions">
            {!maximized && <select aria-label="اندازهٔ باتم‌شیت" title="اندازهٔ باتم‌شیت"
              className={stackedOverIndex ? 'sheet-size-select' : 'sheet-size-select lg:hidden'}
              value={[8, 30, 46, 70, 88].includes(sheetH) ? sheetH : 'custom'}
              onChange={event => { if (event.target.value !== 'custom') setSheetH(Number(event.target.value)) }}>
              <option value="custom" disabled>دلخواه</option>
              <option value="8">کمینه</option><option value="30">۳۰٪</option><option value="46">نیمه</option>
              <option value="70">۷۰٪</option><option value="88">بیشینه</option>
            </select>}
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
          {TABS.map(([key, label]) => (
            <button key={key} role="tab" id={`analysis-tab-${key}`} aria-controls={`analysis-panel-${key}`} aria-selected={tab === key}
              disabled={key === 'form' && !formAvailable}
              title={key === 'form' && !formAvailable ? (formAvailable === null ? 'در حال بارگیری باب واژه' : 'برای این واژه باب ثبت نشده است') : undefined}
              className={`tab-btn flex-1${tab === key ? ' active' : ''}`} onClick={() => switchTab(key)}>{label}</button>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-2 text-xs border-b" style={{ borderColor: 'var(--line)' }}>
          <button onClick={() => navigate(-1)} aria-label={tab === 'context' ? 'سیاق قبل' : tab === 'verse' ? 'آیه قبل' : tab === 'word' ? 'واژه قبل' : tab === 'form' ? 'باب قبل' : 'ریشه قبل'}>→ {tab === 'context' ? 'سیاق قبل' : tab === 'verse' ? 'آیه قبل' : tab === 'word' ? 'واژه قبل' : tab === 'form' ? 'باب قبل' : 'ریشه قبل'}</button>
          <span>{tab === 'context' && selectedContext ? `آیات ${toFa(selectedContext.from)} تا ${toFa(selectedContext.to)}` : `آیه ${toFa(sel.a)} · واژه ${toFa(sel.pos)}`}</span>
          <button onClick={() => navigate(1)} aria-label={tab === 'context' ? 'سیاق بعد' : tab === 'verse' ? 'آیه بعد' : tab === 'word' ? 'واژه بعد' : tab === 'form' ? 'باب بعد' : 'ریشه بعد'}>{tab === 'context' ? 'سیاق بعد' : tab === 'verse' ? 'آیه بعد' : tab === 'word' ? 'واژه بعد' : tab === 'form' ? 'باب بعد' : 'ریشه بعد'} ←</button>
        </div>
        <SwipeTabPages active={tab} onChange={switchTab} panes={TABS.filter(([key]) => key !== 'form' || formAvailable).map(([key]) => ({
          key,
          content: <AnalysisTabContent tab={key} selection={targets[key]} meta={meta} translator={translator} comparisonRange={comparisonRange}
            onPick={(a, pos, part) => selectTargetFor(key, a, pos, part)} onCompareContext={onCompareContext}
            onRootTarget={(target, page) => { setTargets(current => ({ ...current, root: target, form: target })); onJump(target.s, target.a, target.pos, page) }} />,
        }))} />
      </div>
    </>
  )
}
