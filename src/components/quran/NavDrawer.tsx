'use client'
import {t,t as tText} from '@/lib/i18n'

import { useEffect, useMemo, useRef, useState } from 'react'
import LanguageSettings from './LanguageSettings'
import {TRANSLATION_IDS} from '@/lib/translations'
import ResourcePicker from './ResourcePicker'
import {RESOURCES} from '@/lib/resources'
import ReadingScreenSettings from './ReadingScreen'
import UpdateSettings from './UpdateSettings'
import OfflineSettings from './OfflineSettings'
import SurahShortcuts from './SurahShortcuts'
import { APP_NAME } from '@/lib/branding'
import type { Meta, Translator } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import { destinationSuggestions, resolveDestination, normalizeSearch, NAVIGATION_HELP, searchSurahs, type Destination } from '@/lib/navigation'
import { IconClose, IconSearch, IconStar, IconMoon, IconSun, IconBook, IconTranslate } from './Ornaments'

export type { Translator } from '@/lib/quran'

interface Props {
  view?: 'navigation' | 'tools'
  meta: Meta
  bookmarks: number[]
  recentSurahs: number[]
  pinnedSurahs: number[]
  onTogglePin: (n: number) => void
  onClearRecent: () => void
  onAdvancedSearch: () => void
  theme: 'paper' | 'night'
  mode: 'mushaf' | 'flow'
  onMode: (mode: 'mushaf' | 'flow') => void
  translator: Translator
  scale: number
  /** current surah number — used to auto-scroll the surah list to the
      active row when the drawer opens, so the user doesn't have to scroll
      from the top of the 114-row list. */
  currentSurah: number
  onClose: () => void
  onGoPage: (p: number) => void
  onGoSurah: (n: number) => void   // NEW — fixes flow-mode surah navigation
  onGoVerse: (s: number, a: number) => void
  onRemoveBookmark: (p: number) => void
  onTheme: (t: 'paper' | 'night') => void
  onTranslator: (t: Translator) => void
  onScale: (s: number) => void
}

const TABS = [
  { id: 'surah', label: t("ui.a1e320e16e") },
  { id: 'juz', label: t("ui.87453fc867") },
  { id: 'recent', label: t("ui.c6bdd72afe") },
  { id: 'settings', label: t("ui.6badcac8c1") },
] as const


export default function NavDrawer(props: Props) {
  const { meta, onClose, onGoPage, onGoSurah, onGoVerse, currentSurah } = props
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>(props.view === 'tools' ? 'settings' : 'surah')
  const [pageInput, setPageInput] = useState('')
  const q = pageInput
  const contentRef = useRef<HTMLDivElement>(null)
  const [pageError, setPageError] = useState(false)
  // ref to the surah list container — we scrollIntoView the active row
  // when the drawer opens.
  const surahListRef = useRef<HTMLDivElement>(null)
  const activeSurahRef = useRef<HTMLButtonElement>(null)

  // When the drawer mounts (opens), auto-scroll the surah list so the
  // current surah is visible. Skip when there's a search query (user is
  // already filtering — let them see the filtered list from the top).
  useEffect(() => {
    if (tab !== 'surah' || q.trim()) return
    if (!activeSurahRef.current) return
    // Use a tiny timeout to let the drawer's slide-in animation start first,
    // otherwise scrollIntoView happens before the layout settles.
    const t = setTimeout(() => {
      const pane = contentRef.current, row = activeSurahRef.current
      if (pane && row) pane.scrollTop = Math.max(0, pane.scrollTop + row.getBoundingClientRect().top - pane.getBoundingClientRect().top - (pane.clientHeight - row.clientHeight) / 2)
    }, 50)
    return () => clearTimeout(t)
  }, [tab, q])

  const surahs = useMemo(() => searchSurahs(meta, q), [q, meta])
  const suggestions = useMemo(() => destinationSuggestions(meta, pageInput, currentSurah), [meta, pageInput, currentSurah])

  const juzList = useMemo(() =>
    Object.entries(meta.juz).map(([j, [s, a]]) => ({
      j: +j, s, a,
      surahFa: meta.surahs[s - 1]?.fa ?? '',
    })), [meta])

  const goTo = (destination: Destination) => {
    if (destination.kind === 'page') onGoPage(destination.p)
    else if (destination.kind === 'surah') onGoSurah(destination.s)
    else onGoVerse(destination.s, destination.kind === 'context' ? destination.from : destination.a)
    onClose()
  }
  const submitPage = (e: React.FormEvent) => {
    e.preventDefault()
    const destination = suggestions.length === 1 ? suggestions[0].destination : !/^\d+$/.test(normalizeSearch(pageInput)) ? resolveDestination(meta, 'surah', pageInput, currentSurah) : undefined
    if (destination) goTo(destination)
    else setPageError(true)
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={props.view === 'tools' ? t("ui.b563f0690c") : t("ui.38a1e75271")}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <img src="/icons/logo-5-192.png" width="34" height="34" alt="" className="shrink-0 rounded-full" />
            <h2 className="font-bold text-lg" style={{ color: 'var(--ink)' }}>{APP_NAME}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t("ui.313cbecb4d")}><IconClose /></button>
        </div>

        {props.view === 'tools' && <>
        <button type="button" className="drawer-advanced-search" onClick={props.onAdvancedSearch}><IconSearch /><span>{t("ui.c51349274d")}</span><span>{t("ui.b390c6bcd0")}</span></button>
        </>}
        {props.view !== 'tools' && <>
        <form onSubmit={submitPage} className="flex items-center gap-2 px-4 pb-3">
          <input
            value={pageInput}
            onChange={e => { setPageInput(e.target.value); setPageError(false) }}
            aria-label={t("ui.54778fcf78")}
            aria-invalid={pageError}
            aria-describedby={pageError ? 'page-jump-error' : undefined}
            inputMode="text"
            placeholder={t("ui.5bb212ac5e")}
            className="flex-1 min-w-0 rounded-xl border px-3 py-2.5 text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
          />
          <button type="submit" className="rounded-xl px-4 py-2.5 text-sm font-bold text-white flex-none"
            style={{ background: 'var(--sage)' }}>{t("ui.f06ccf3d9b")}</button>
        </form>
        {!pageInput && <SurahShortcuts meta={meta} pinned={props.pinnedSurahs} recent={props.recentSurahs} onTogglePin={props.onTogglePin} onGo={s => goTo({ kind: 'surah', s })} />}
        {pageError && <p id="page-jump-error" role="alert" className="px-4 pb-3 text-xs">{t("ui.c8cc160d0c")}</p>}

        {suggestions.length > 0 && <div className="drawer-destination-options" aria-label={t("ui.6d7a6c7a7e")}>
          {suggestions.map((item, index) => <button key={index} type="button" onClick={() => goTo(item.destination)}>{toFa(item.label)}</button>)}
        </div>}
        <details className="px-4 pb-3 text-xs leading-7"><summary>{t("ui.f4bf9b146f")}</summary><dl className="mt-2">{NAVIGATION_HELP.map(([kind,examples])=><div key={kind}><dt className="font-bold">{t(kind)}</dt><dd>{t(examples)}</dd></div>)}</dl><p>{t("ui.a8175202e6")}</p></details>
        </>}
        <div className="flex border-b px-2" style={{ borderColor: 'var(--line)' }}>
          {TABS.filter(t => props.view === 'tools' ? t.id === 'recent' || t.id === 'settings' : t.id === 'surah' || t.id === 'juz').map(t => (
            <button key={t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {tText(t.label)}
            </button>
          ))}
        </div>

        <div ref={contentRef} className="flex-1 overflow-y-auto nice-scroll">
          {tab === 'surah' && (
            <div className="p-3">
              {surahs.length === 0 && !suggestions.length && <p role="status" className="text-center py-4 text-sm">{t("ui.68f830ec5c")}</p>}
              <div ref={surahListRef} className="flex flex-col">
                {surahs.map(s => {
                  const isActive = s.n === currentSurah
                  return (
                    <button
                      key={s.n}
                      ref={isActive ? activeSurahRef : null}
                      className="nav-surah-row"
                      data-active={isActive || undefined}
                      style={isActive ? {
                        background: 'var(--word-root)',
                        borderColor: 'var(--sage)',
                      } : { borderBottom: '1px solid var(--line)' }}
                      /* FIX: was onGoPage(s.pg) — broke flow mode. Use onGoSurah so
                         the current mode is respected (page in mushaf, surah in flow). */
                      onClick={() => { onGoSurah(s.n); onClose() }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--word-hover)' }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span className="flex-none w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium"
                        style={{
                          border: '1px solid ' + (isActive ? 'var(--sage)' : 'var(--gold-deep)'),
                          color: isActive ? 'var(--sage)' : 'var(--gold-deep)',
                          background: isActive ? 'var(--word-root)' : 'var(--gold-faint)',
                        }}>
                        {toFa(s.n)}
                      </span>
                      <span className="flex-1">
                        <span className="block font-bold text-[15px] font-quran" style={{ color: 'var(--ink)' }}>{s.ar}</span>
                        <span className="block text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>
                          {s.fa} · {toFa(s.vc)}{' '}{t("ui.d9959426df")}{' '}{s.rev === 'makkah' ? t("ui.039e791597") : t("ui.40f14b2806")}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'juz' && (
            <div className="p-3 grid grid-cols-2 gap-2">
              {juzList.map(j => (
                <button key={j.j}
                  className="rounded-xl border px-3 py-3 text-right transition-colors"
                  style={{ borderColor: 'var(--line)' }}
                  onClick={() => { onGoVerse(j.s, j.a); onClose() }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--word-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="block font-bold" style={{ color: 'var(--ink)' }}>{t("ui.f74f9b04c7")}{' '}{toFa(j.j)}</span>
                  <span className="block text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
                    {j.surahFa}{' '}{t("ui.2f2dd77fbd")}{' '}{toFa(j.a)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === 'recent' && (
            <div className="p-3">
              <div className="drawer-recent-heading"><h3>{t("ui.d8c76d09ca")}</h3>{props.recentSurahs.length > 0 && <button type="button" onClick={props.onClearRecent}>{t("ui.abea5beb42")}</button>}</div>
              {props.recentSurahs.length === 0 && <p className="text-xs py-4" style={{ color: 'var(--ink-soft)' }}>{t("ui.462e4fca97")}</p>}
              {props.recentSurahs.map(n => <button type="button" className="nav-surah-row" key={n} onClick={() => goTo({ kind: 'surah', s: n })}><span>{toFa(n)} · {meta.surahs[n - 1]?.fa}</span>{n === currentSurah && <small>{t("ui.bd95a7445e")}</small>}</button>)}
              <details className="drawer-legacy-bookmarks"><summary>{t("ui.59d0d8997c")}{' '}{toFa(props.bookmarks.length)}</summary>
              {props.bookmarks.length === 0 ? (
                <div className="text-center py-12 text-sm" style={{ color: 'var(--ink-faint)' }}>
                  <div className="flex justify-center mb-3 opacity-60"><IconStar /></div>{t("ui.934788992f")}<br />{t("ui.53cb090124")}</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {[...props.bookmarks].sort((a, b) => a - b).map(p => {
                    const names = [...new Set((meta.pages[p - 1] || []).map(sg => meta.surahs[sg.s - 1]?.fa))].join('، ')
                    return (
                      <div key={p} className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
                        style={{ borderColor: 'var(--line)' }}>
                        <button className="flex-1 text-right" onClick={() => { onGoPage(p); onClose() }}>
                          <span className="block font-bold text-sm" style={{ color: 'var(--ink)' }}>{t("ui.0572e8936c")}{' '}{toFa(p)}</span>
                          <span className="block text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{names}</span>
                        </button>
                        <button className="icon-btn sm" style={{ color: 'var(--ink-faint)' }}
                          onClick={() => props.onRemoveBookmark(p)} aria-label={t("ui.2b762b50db")}>
                          <IconClose />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              </details>
            </div>
          )}

          {tab === 'settings' && (
            <div className="p-4 flex flex-col gap-6">
              <LanguageSettings translator={props.translator}/>
              <ReadingScreenSettings />
              <UpdateSettings />
              <OfflineSettings />
              <section>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  {props.theme === 'night' ? <IconMoon /> : <IconSun />}{t("ui.90ec529f45")}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(['paper', 'night'] as const).map(theme => (
                    <button key={theme}
                      className="rounded-xl border py-3 text-sm font-medium transition-all"
                      style={{
                        borderColor: props.theme === theme ? 'var(--sage)' : 'var(--line)',
                        background: props.theme === theme ? 'var(--word-root)' : 'transparent',
                        color: 'var(--ink)',
                      }}
                      onClick={() => props.onTheme(theme)}>
                      {theme === 'paper' ? t("ui.a97a005a42") : t("ui.95b1ddc4a1")}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  <IconTranslate />{t("ui.52baa2cbee")}</h3>
                <ResourcePicker label={t("ui.37e2fdb79c")} ids={TRANSLATION_IDS.map(id=>`translation:${id}`)} value={`translation:${props.translator}`} onChange={id=>props.onTranslator(id.replace(/^translation:/,'') as Translator)}/>
              </section>

              <section><h3 className="text-sm font-bold mb-3" style={{color:'var(--ink)'}}>{t("ui.b6a850cc59")}</h3><ResourcePicker browse label={t("ui.8a52f7bc3f")} ids={RESOURCES.map(r=>r.id)} value="" onChange={()=>{}}/></section>

              <section>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  <IconBook />{t("ui.1fe7007e7e")}</h3>
                <div className="flex items-center justify-center gap-3 mb-3" role="group" aria-label={t("ui.8b885c6faa")}>
                  <button className="icon-btn" aria-label={t("ui.8b885c6faa")}
                    disabled={props.scale >= 1.9}
                    onClick={() => props.onScale(Math.round(Math.min(1.9, props.scale + 0.15) * 20) / 20)}>
                    <span className="text-lg font-bold">+</span>
                  </button>
                  <span className="text-sm" style={{ color: 'var(--ink)' }}>{toFa(Math.round(props.scale * 100))}٪</span>
                  <button className="icon-btn" aria-label={t("ui.2e81f56c3d")}
                    disabled={props.scale <= 0.55}
                    onClick={() => props.onScale(Math.round(Math.max(0.55, props.scale - 0.15) * 20) / 20)}>
                    <span className="text-lg font-bold">−</span>
                  </button>
                </div>
                <input type="range" min={0.55} max={1.9} step={0.05} value={props.scale}
                  className="page-slider" dir="rtl"
                  style={{ ['--fill' as string]: `${((props.scale - 0.55) / 1.35) * 100}%` }}
                  onChange={e => props.onScale(+e.target.value)} />
                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
                  <span>{t("ui.ad78cda0dc")}</span><span>{toFa(Math.round(props.scale * 100))}٪</span><span>{t("ui.053b14047d")}</span>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  <IconBook />{t("ui.88619bd189")}</h3>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("ui.88619bd189")}>
                  {(['flow', 'mushaf'] as const).map(mode => (
                    <button key={mode}
                      className="rounded-xl border py-3 text-sm font-medium transition-all"
                      aria-pressed={props.mode === mode}
                      style={{
                        borderColor: props.mode === mode ? 'var(--sage)' : 'var(--line)',
                        background: props.mode === mode ? 'var(--word-root)' : 'transparent',
                        color: 'var(--ink)',
                      }}
                      onClick={() => props.onMode(mode)}>
                      {mode === 'mushaf' ? t("ui.f7c7ba28bb") : t("ui.8fef24ffc4")}
                    </button>
                  ))}
                </div>
              </section>

              <p className="text-xs leading-6 pt-2 border-t" style={{ color: 'var(--ink-faint)', borderColor: 'var(--line)' }}>{t("ui.9f4b86895b")}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
