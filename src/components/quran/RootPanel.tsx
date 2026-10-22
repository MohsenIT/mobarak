'use client'
import { displayWordText, lexicalKey, wordTarget, type WordPart } from '@/lib/word-parts'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Translator, SurahData, Meta } from '@/lib/quran'
import { loadSurah, toFa, morphologyLabel } from '@/lib/quran'
import type { Selection } from './MushafPage'
import { adjacentRootLocations, analysisNavigation, type AnalysisTab, type AnalysisSelection } from '@/lib/analysis'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Minus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import AnalysisTabContent from './AnalysisTabContent'
import OccurrencePicker from './OccurrencePicker'
import VerseActions from './VerseActions'
import { AnalysisPreferencesProvider, AnalysisSettings } from './AnalysisSections'
import SwipeTabPages, { type TabSwipeMotion } from './SwipeTabPages'
import { getContext } from '@/lib/contexts'
import QuranText from './QuranText'
import { readAnalysisView, saveAnalysisView } from '@/lib/analysis-view'
import { IconClose, IconMaximize, IconRestore } from './Ornaments'

interface Props {
  onOpenOccurrences: (selection: AnalysisSelection) => void
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

const TABS = [['root', 'ریشه'], ['form', 'باب'], ['word', 'بُن‌واژه'], ['verse', 'آیه'], ['context', 'سیاق']] as const

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export default function RootPanel(props: Props) {
  return <AnalysisPreferencesProvider><RootPanelContent {...props} /></AnalysisPreferencesProvider>
}

function RootPanelContent({
  sel: anchor, onSelectionChange, onCompareContext, onOpenOccurrences, meta, translator, maximized, onToggleMax, onClose, onJump, onJumpSurah,
  stackedOverIndex = false, comparisonRange, sheetH, onSheetHeightChange: setSheetH,
}: Props) {
  const [tab, setTab] = useState<AnalysisTab>(() => { const saved = readAnalysisView().tab ?? 'root'; return (!anchor.root || anchor.part === 'prefix') && (saved === 'root' || saved === 'form') ? 'word' : saved })
  const [targets, setTargets] = useState<Record<AnalysisTab, Selection>>({ root: anchor, form: anchor, word: anchor, verse: anchor, context: anchor })
  const rootAvailable = !!targets.root.root
  const sel = targets[tab]
  const [surah, setSurah] = useState<SurahData | null>(null)
  const dragRef = useRef<{ y: number; h: number } | null>(null)
  const [formAvailable, setFormAvailable] = useState<boolean | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigationRef = useRef<HTMLElement>(null)
  const [minimized, setMinimized] = useState(() => readAnalysisView().minimized ?? false)
  const [minimumHeight, setMinimumHeight] = useState(180)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [previousAnchor, setPreviousAnchor] = useState(anchor)
  // Retarget an existing sheet without remounting its DOM or replaying sheetUp.
  if (anchor !== previousAnchor) {
    setPreviousAnchor(anchor)
    setTargets({ root: anchor, form: anchor, word: anchor, verse: anchor, context: anchor })
    setTab(current => (!anchor.root || anchor.part === 'prefix') && (current === 'root' || current === 'form') ? 'word' : current)
    setPickerOpen(false)
  }
  useEffect(() => { saveAnalysisView({ tab, minimized }) }, [tab, minimized])
  const tabStrip = useRef<HTMLDivElement>(null)
  const indicatorTrack = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)
  const indicatorCopy = useRef<HTMLSpanElement>(null)
  const paintTabIndicator = (motion: TabSwipeMotion) => {
    const strip = tabStrip.current, track = indicatorTrack.current, line = indicator.current, copy = indicatorCopy.current
    if (!strip || !track || !line || !copy) return
    const available = [...strip.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')]
    const from = available.find(button => button.id === `analysis-tab-${motion.from}`)
    const to = available.find(button => button.id === `analysis-tab-${motion.to}`)
    if (!from || !to) return
    const base = strip.getBoundingClientRect()
    const boxes = available.map(button => button.getBoundingClientRect())
    const left = Math.min(...boxes.map(box => box.left))
    const right = Math.max(...boxes.map(box => box.right))
    const trackWidth = right - left
    track.style.left = `${left - base.left}px`; track.style.width = `${trackWidth}px`
    const start = from.getBoundingClientRect(), end = to.getBoundingClientRect()
    const wrapDirection = motion.wrap ? available.indexOf(from) === 0 ? 1 : -1 : 0
    const destination = end.left - left + wrapDirection * trackWidth
    const x = start.left - left + (destination - (start.left - left)) * motion.progress
    const width = start.width + (end.width - start.width) * motion.progress
    for (const element of [line, copy]) {
      element.style.transition = motion.dragging || motion.settled ? 'none' : ''
      element.style.width = `${width}px`
    }
    line.style.transform = `translateX(${x}px)`
    copy.style.transform = `translateX(${x - wrapDirection * trackWidth}px)`
    copy.style.visibility = motion.wrap ? 'visible' : 'hidden'
  }
  useLayoutEffect(() => {
    const align = () => paintTabIndicator({ from: tab, to: tab, progress: 0, dragging: false, wrap: false, settled: true })
    align()
    const observer = new ResizeObserver(align)
    if (tabStrip.current) observer.observe(tabStrip.current)
    return () => observer.disconnect()
  }, [tab, formAvailable, rootAvailable])

  useLayoutEffect(() => {
    const measure = () => {
      const panel = panelRef.current, nav = navigationRef.current
      if (panel && nav) setMinimumHeight(Math.ceil(nav.getBoundingClientRect().bottom - panel.getBoundingClientRect().top))
    }
    measure()
    const observer = new ResizeObserver(measure)
    const panel = panelRef.current
    if (panel) for (const child of [...panel.children].slice(0, 4)) observer.observe(child)
    return () => observer.disconnect()
  }, [])
  const minimumPercent = minimumHeight / (typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : 844) * 100
  const minimize = () => {
    if (maximized) onToggleMax()
    setMinimized(value => !value)
  }

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

  useEffect(() => { if (tab === 'form' && formAvailable === false) setTab('word') }, [tab, formAvailable])

  const switchTab = (key: AnalysisTab) => {
    if (key === tab || (key === 'form' && !formAvailable) || (key === 'root' && !rootAvailable)) return
    setPickerOpen(false)
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

  const nav = useMemo(() => surah?.n === sel.s ? analysisNavigation(surah, { ...sel, tab, form: selectedForm }) : null, [surah, sel, tab, selectedForm])
  const noun = tab === 'context' ? 'سیاق' : tab === 'verse' ? 'آیه' : tab === 'word' ? 'واژه' : tab === 'form' ? 'باب' : 'ریشه'
  const items = nav?.repetitions ?? []
  const index = nav?.repetitionIndex ?? -1
  const hasRepetitions = nav?.hasRepetitions ?? (tab !== 'verse' && tab !== 'context')
  const rootNeighbors = useMemo(() => tab === 'root' && surah?.n === sel.s ? adjacentRootLocations(surah, sel) : null, [tab, surah, sel])
  const previousUnit = tab === 'root' ? rootNeighbors?.previous : nav && nav.unitIndex > 0 ? nav.units[nav.unitIndex - 1] : undefined
  const nextUnit = tab === 'root' ? rootNeighbors?.next : nav && nav.unitIndex >= 0 ? nav.units[nav.unitIndex + 1] : undefined
  const canUnitPrevious = !!previousUnit
  const canUnitNext = !!nextUnit
  const headingAyah = tab === 'context' ? selectedContext?.from ?? sel.a : sel.a
  const headingVerse = surah?.n === sel.s ? surah.v.find(verse => verse.n === headingAyah) : undefined
  const headingPreview = tab === 'verse' || tab === 'context'
  const headingWords = tab === 'context' && selectedContext ? (surah?.n === sel.s ? surah.v.filter(verse => verse.n >= selectedContext.from && verse.n <= selectedContext.to).flatMap(verse => verse.w) : undefined) : headingVerse?.w
  const headingText = headingPreview ? headingWords?.slice(0, 2).map(displayWordText).join(' ') ?? sel.text : sel.text
  const headingHasMore = headingPreview && (headingWords?.length ?? 0) > 2
  const headingReference = tab === 'context' && selectedContext ? `${toFa(selectedContext.from)}–${toFa(selectedContext.to)}` : toFa(sel.a)
  const unitTitle = (location?: [number, number, WordPart?]) => {
    if (!location || !surah || surah.n !== sel.s) return '—'
    const [a, pos, part] = location
    const word = surah.v[a - 1]?.w[pos - 1]
    if (!word) return '—'
    if (tab === 'root') return word.r ? word.r : '—'
    if (tab === 'form') return word.form ? morphologyLabel(word.form) : '—'
    if (tab === 'word') return wordTarget(word, part).text
    if (tab === 'verse') return `آیه ${toFa(a)}`
    const range = getContext(sel.s, a)
    return range ? `آیات ${toFa(range.from)}–${toFa(range.to)}` : `آیه ${toFa(a)}`
  }
  const previousUnitTitle = unitTitle(previousUnit)
  const nextUnitTitle = unitTitle(nextUnit)
  const currentUnitTitle = tab === 'root' ? root ? root : '—' : tab === 'form' ? selectedForm ? morphologyLabel(selectedForm) : 'باب' : tab === 'word' ? sel.text : tab === 'verse' ? `آیه ${toFa(sel.a)}` : selectedContext ? `آیات ${toFa(selectedContext.from)}–${toFa(selectedContext.to)}` : 'سیاق'
  const unitQuranFont = tab === 'root' || tab === 'word'
  const positionTitle = <><span className={`analysis-position-title${tab === 'context' ? ' analysis-position-range' : ''}${unitQuranFont ? ' font-quran' : ''}`}>{tab === 'context' && selectedContext ? <>آیات <bdi dir="ltr">{toFa(selectedContext.from)}–{toFa(selectedContext.to)}</bdi></> : <QuranText text={currentUnitTitle} />}</span><span className="analysis-position-count" dir="ltr">{index >= 0 ? `${toFa(index + 1)}/${toFa(items.length)}` : '—'}</span></>
  const navigateUnit = (direction: number) => {
    const target = direction < 0 ? previousUnit : nextUnit
    if (target) selectTarget(...target)
  }
  const navigate = (direction: number) => {
    const target = index >= 0 ? items[index + direction] : null
    if (target) selectTarget(...target)
  }

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('[data-search-page]')) return
      if (event.target instanceof HTMLElement && event.target.closest('[role="dialog"]') && event.target.closest('[role="dialog"]') !== panelRef.current) return
      if (event.target instanceof HTMLElement && (event.target.matches('input, textarea, select') || event.target.closest('[role="tablist"], [data-analysis-picker]'))) return
      if (event.key === 'ArrowRight') { event.preventDefault(); navigate(-1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(1) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [tab, sel, surah, selectedForm])

  // Keep the exact released height; presets are an explicit alternative.
  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (maximized) return
    const viewport = window.visualViewport?.height ?? window.innerHeight
    const height = (panelRef.current?.getBoundingClientRect().height ?? viewport * sheetH / 100) / viewport * 100
    dragRef.current = { y: e.clientY, h: height }
    setMinimized(false)
    setSheetH(height)
    e.currentTarget.setPointerCapture(e.pointerId)
    panelRef.current?.classList.add('dragging')
  }
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current
    if (!start) return
    const viewport = window.visualViewport?.height ?? window.innerHeight
    setSheetH(clamp(start.h + (start.y - e.clientY) / viewport * 100, minimumHeight / viewport * 100, Math.max(88, minimumHeight / viewport * 100)))
  }
  const onHandleEnd = () => {
    dragRef.current = null
    panelRef.current?.classList.remove('dragging')
  }

  const panelClass = `root-panel${minimized && !maximized ? ' minimized' : ''}${maximized ? ' maximized' : ''}${stackedOverIndex ? ' stacked' : ''}`

  return (
    <>
      {maximized && <div className="panel-backdrop" onClick={onClose} />}
      <div
        ref={panelRef}
        className={panelClass}
        role="dialog"
        aria-label="تحلیل ریشه کلمه"
        style={{ touchAction: 'pan-y', ['--sheet-min-height' as string]: `${minimumHeight}px`, ...(!maximized ? { ['--sheet-h' as string]: `${sheetH}dvh` } : {}) }}
      >
        <div className="panel-handle" role="slider" tabIndex={maximized ? -1 : 0}
          aria-label="ارتفاع باتم‌شیت" aria-orientation="vertical" aria-valuemin={Math.ceil(minimumPercent)} aria-valuemax={88}
          aria-valuenow={Math.round(minimized ? minimumPercent : sheetH)} aria-valuetext={minimized ? 'کمینه؛ تا پایان نویگیشن' : `${toFa(Math.round(sheetH))} درصد صفحه`}
          onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleEnd}
          onPointerCancel={onHandleEnd} onLostPointerCapture={onHandleEnd}
          onKeyDown={event => {
            const height = minimized ? minimumPercent : sheetH
            const next = event.key === 'ArrowUp' ? height + 5 : event.key === 'ArrowDown' ? height - 5 : event.key === 'Home' ? minimumPercent : event.key === 'End' ? 88 : null
            if (next !== null && !maximized) { event.preventDefault(); setMinimized(false); setSheetH(clamp(next, minimumPercent, Math.max(88, minimumPercent))) }
          }} />

        <div className="panel-header" style={{ borderColor: 'var(--line)' }}>
          <div className="panel-selection">
            <span className={`font-quran panel-word${headingPreview ? ' panel-word-preview' : ''}`} dir="rtl" title={`${headingText}${headingHasMore ? '…' : ''}`}>{headingPreview ? <><span className="panel-preview-text"><QuranText text={headingText} /></span>{headingHasMore && <span className="panel-preview-ellipsis">…</span>}</> : <QuranText text={headingText} />}</span>
            <span className="chip panel-reference" title={`سورهٔ ${meta.surahs[sel.s - 1]?.fa} · ${tab === 'context' ? 'آیات' : 'آیه'} ${headingReference}`}>
              <span className="panel-reference-surah">{meta.surahs[sel.s - 1]?.fa}</span><span>· {headingReference}</span>
            </span>
          </div>
          <div className="panel-actions">
            {surah?.n === sel.s && surah.v.find(v => v.n === sel.a) && <VerseActions key={`${sel.s}:${sel.a}`} surah={surah} verse={surah.v.find(v => v.n === sel.a)!} translator={translator} />}
            <AnalysisSettings tab={tab} />
            <button className="icon-btn sm" onClick={minimize} aria-label={minimized ? 'بازگرداندن اندازهٔ باتم‌شیت' : 'کمینه‌کردن باتم‌شیت'} title={minimized ? 'بازگرداندن اندازه' : 'کمینه'}>
              {minimized ? <IconRestore /> : <Minus size={18} />}
            </button>
            <button className="icon-btn sm" onClick={() => { setMinimized(false); onToggleMax() }} aria-label={maximized ? 'بازگرداندن به نیم‌صفحه' : 'تمام‌صفحه'}
              title={maximized ? 'بازگرداندن به نیم‌صفحه' : 'تمام‌صفحه'}>
              {maximized ? <IconRestore /> : <IconMaximize />}
            </button>
            <button className="icon-btn sm" onClick={onClose} aria-label="بستن" title="بستن">
              <IconClose />
            </button>
          </div>
        </div>

        <div ref={tabStrip} className="analysis-tab-strip flex border-b px-2" role="tablist" aria-label="نوع تحلیل" style={{ borderColor: 'var(--line)' }}>
          {TABS.map(([key, label]) => (
            <button key={key} role="tab" id={`analysis-tab-${key}`} aria-controls={`analysis-panel-${key}`} aria-selected={tab === key}
              disabled={(key === 'form' && !formAvailable) || (key === 'root' && !rootAvailable)}
              title={key === 'root' && !rootAvailable ? 'برای این واژه ریشه ثبت نشده است' : key === 'form' && !formAvailable ? (formAvailable === null ? 'در حال بارگیری باب واژه' : 'برای این واژه باب ثبت نشده است') : undefined}
              className={`tab-btn flex-1${tab === key ? ' active' : ''}`} onClick={() => switchTab(key)}>{label}</button>
          ))}
          <div ref={indicatorTrack} className="analysis-tab-indicator-track" aria-hidden="true"><span ref={indicator} /><span ref={indicatorCopy} /></div>
        </div>
        <nav ref={navigationRef} className={`analysis-navigation${hasRepetitions ? '' : ' analysis-navigation-simple'}`} aria-label={`پیمایش ${noun}`}>
          <button className="analysis-unit-button" onClick={() => navigateUnit(-1)} disabled={!canUnitPrevious} aria-label={`${noun} قبل`} title={`${noun} قبل: ${previousUnitTitle}`}>
            {hasRepetitions ? <ChevronsRight size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
            <span className={`analysis-unit-title${unitQuranFont ? ' font-quran' : ''}`}><QuranText text={previousUnitTitle} /></span>
          </button>
          {hasRepetitions && <button className="analysis-repeat-button" onClick={() => navigate(-1)} disabled={index <= 0}
            aria-label="تکرار قبل" title={`${toFa(Math.max(0, index))} تکرار قبل`}>
            <ChevronRight size={17} aria-hidden="true" /><span>{toFa(Math.max(0, index))} تکرار</span>
          </button>}
          {hasRepetitions ? <OccurrencePicker open={pickerOpen} onOpenChange={setPickerOpen} items={items} index={index} surah={surah}
            groupKey={`${tab}:${sel.s}:${tab === 'root' ? root : tab === 'form' ? `${root}:${selectedForm}` : surah?.n === sel.s ? lexicalKey(surah.v[sel.a - 1].w[sel.pos - 1], sel.part) : sel.text}`}
            title={positionTitle}
            label={`تکرار ${toFa(index + 1)} از ${toFa(items.length)}؛ انتخاب تکرار`}
            onSelect={location => selectTarget(...location)} onFull={() => onOpenOccurrences({ ...sel, tab, form: selectedForm })} /> : <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button className="analysis-position-button" disabled={index < 0 || !items.length}
                aria-label={`${hasRepetitions ? 'تکرار' : noun} ${toFa(index + 1)} از ${toFa(items.length)}؛ انتخاب ${hasRepetitions ? 'تکرار' : noun}`}>
                {positionTitle}
              </button>
            </PopoverTrigger>
            <PopoverContent className="analysis-position-picker" dir="rtl" data-analysis-picker
              aria-label={hasRepetitions ? 'فهرست تکرارها' : `فهرست ${noun}‌ها`}
              onOpenAutoFocus={event => {
                event.preventDefault()
                requestAnimationFrame(() => {
                  const selected = document.querySelector<HTMLButtonElement>('[data-analysis-picker] [aria-current="true"]')
                  selected?.focus({ preventScroll: true }); selected?.scrollIntoView({ block: 'nearest' })
                })
              }}>
              <p className="text-xs font-bold px-3 py-2">{hasRepetitions ? 'تکرارها در این سوره' : `${noun}‌های این سوره`}</p>
              {items.map(([a, pos, part], i) => <button key={`${a}:${pos}:${part ?? 'stem'}`} className={`analysis-position-option${hasRepetitions ? ' has-excerpt' : ''}`} aria-current={i === index ? 'true' : undefined}
                onClick={() => { selectTarget(a, pos, part); setPickerOpen(false) }}>
                <span className="analysis-occurrence-reference">{toFa(i + 1)} · {tab === 'context' ? (() => { const range = getContext(sel.s, a); return range ? `آیات ${toFa(range.from)} تا ${toFa(range.to)}` : `آیه ${toFa(a)}` })() : `آیه ${toFa(a)}`}</span>
              </button>)}
            </PopoverContent>
          </Popover>}
          {hasRepetitions && <button className="analysis-repeat-button" onClick={() => navigate(1)} disabled={index < 0 || index >= items.length - 1}
            aria-label="تکرار بعد" title={`${toFa(Math.max(0, items.length - index - 1))} تکرار بعد`}>
            <span>{toFa(Math.max(0, items.length - index - 1))} تکرار</span><ChevronLeft size={17} aria-hidden="true" />
          </button>}
          <button className="analysis-unit-button" onClick={() => navigateUnit(1)} disabled={!canUnitNext} aria-label={`${noun} بعد`} title={`${noun} بعد: ${nextUnitTitle}`}>
            <span className={`analysis-unit-title${unitQuranFont ? ' font-quran' : ''}`}><QuranText text={nextUnitTitle} /></span>
            {hasRepetitions ? <ChevronsLeft size={15} aria-hidden="true" /> : <ChevronLeft size={15} aria-hidden="true" />}
          </button>
        </nav>
        <SwipeTabPages contentKey={`${anchor.s}:${anchor.a}:${anchor.pos}:${anchor.part ?? 'stem'}`} active={tab} onChange={switchTab} onProgress={paintTabIndicator} panes={TABS.filter(([key]) => (key !== 'form' || formAvailable) && (key !== 'root' || rootAvailable)).map(([key]) => ({
          key,
          content: <AnalysisTabContent tab={key} selection={targets[key]} meta={meta} translator={translator} comparisonRange={comparisonRange}
            onPick={(a, pos, part) => selectTargetFor(key, a, pos, part)} onCompareContext={onCompareContext}
            onRootTarget={(target, page) => { setTargets(current => ({ ...current, root: target, form: target })); onJump(target.s, target.a, target.pos, page) }} />,
        }))} />
      </div>
    </>
  )
}
