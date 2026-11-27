'use client'
import {StudyEntry} from './StudyLinks'
import {DictationInput} from './DictationInput'
import {t} from '@/lib/i18n'

import { useMemo, useState } from 'react'
import LanguageSettings from './LanguageSettings'
import CalendarSettings from './CalendarSettings'
import {TRANSLATION_IDS} from '@/lib/translations'
import ResourcePicker from './ResourcePicker'
import {RESOURCES} from '@/lib/resources'
import { AppearanceColors } from './Appearance'
import CopyFormatSettings from './CopyFormatSettings'
import ReadingScreenSettings from './ReadingScreen'
import UpdateSettings from './UpdateSettings'
import OfflineSettings from './OfflineSettings'
import DownloadsManager from './DownloadsManager'
import SurahShortcuts from './SurahShortcuts'
import DestinationOptions, { useDestinationSelection } from './DestinationOptions'
import SurahNavigationList from './SurahNavigationList'
import DesktopPaneResizeHandle from './DesktopPaneResizeHandle'
import { useDismissiblePanel } from './useDismissiblePanel'
import { APP_NAME } from '@/lib/branding'
import type { Meta, Translator } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import { destinationSuggestions, NAVIGATION_HELP, type Destination } from '@/lib/navigation'
import { IconClose, IconStar, IconMoon, IconSun, IconBook, IconTranslate, IconSortIndex } from './Ornaments'
import { ChevronLeft, GitCompareArrows, Settings } from 'lucide-react'
import { AdvancedSearchIcon } from './ReaderSearchIcon'

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
  onOpenKeywords: () => void
  onOpenComparison: () => void
  theme: 'paper' | 'night'
  translator: Translator
  scale: number
  /** current surah number — used to auto-scroll the surah list to the
      active row when the drawer opens, so the user doesn't have to scroll
      from the top of the 114-row list. */
  currentSurah: number
  onOpenSettings: () => void
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
  { id: 'appearance', label: t('appearance.title') },
  { id: 'settings', label: t("ui.6badcac8c1") },
  { id: 'downloads', label: t('downloads.manage') },
  { id: 'about', label: t('about.title') },
] as const


export default function NavDrawer(props: Props) {
  const { meta, onClose, onGoPage, onGoSurah, onGoVerse, currentSurah } = props
  const drawerRef = useDismissiblePanel<HTMLElement>(true, () => {
    if (props.view === 'tools' || !window.matchMedia('(min-width:1024px)').matches) onClose()
  })
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('surah')
  const [pageInput, setPageInput] = useState('')
  const q = pageInput
  const [pageError, setPageError] = useState(false)
  const suggestions = useMemo(() => destinationSuggestions(meta, pageInput, currentSurah), [meta, pageInput, currentSurah])

  const selection = useDestinationSelection(suggestions)

  const juzList = useMemo(() =>
    Object.entries(meta.juz).map(([j, [s, a]]) => ({
      j: +j, s, a,
      surahFa: meta.surahs[s - 1]?.fa ?? '',
    })), [meta])

  const closeAfterNavigation=()=>{if(!window.matchMedia('(min-width:1024px)').matches)onClose()}
  const goTo = (destination: Destination) => {
    if (destination.kind === 'page') onGoPage(destination.p)
    else if (destination.kind === 'surah') onGoSurah(destination.s)
    else onGoVerse(destination.s, destination.kind === 'context' ? destination.from : destination.a)
    closeAfterNavigation()
  }
  const submitPage = (e: React.FormEvent) => {
    e.preventDefault()
    const { destination } = selection
    if (destination) goTo(destination)
    else {
      if (window.matchMedia('(pointer: coarse)').matches && document.activeElement instanceof HTMLInputElement) document.activeElement.blur()
      setPageError(!!pageInput.trim() && !suggestions.length)
    }
  }

  return (
    <>
      <div className="sheet-backdrop pointer-events-none" aria-hidden="true" />
      <aside ref={drawerRef} className="drawer" role="dialog" aria-label={props.view === 'tools' ? t("ui.b563f0690c") : t("ui.38a1e75271")}>
        <DesktopPaneResizeHandle pane="navigation" edge="start" min={240} max={420} />
        <div className="drawer-header flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <img src="/icons/logo-5-192.png" width="34" height="34" alt="" className="shrink-0 rounded-full" />
            <h2 className="font-bold text-lg" style={{ color: 'var(--ink)' }}>{APP_NAME}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t("ui.313cbecb4d")}><IconClose /></button>
        </div>

        {props.view === 'tools' && <div className="drawer-tools">
          <section className="drawer-tool-section" aria-labelledby="drawer-study-heading">
            <h3 id="drawer-study-heading">{t('ui.2e49f1d53a')}</h3>
            <StudyEntry className="drawer-tool-row" />
          </section>
          <section className="drawer-tool-section" aria-labelledby="drawer-find-heading">
            <h3 id="drawer-find-heading">{t('ui.3906317c3a')}</h3>
            <button type="button" className="drawer-tool-row" onClick={props.onAdvancedSearch}>
              <AdvancedSearchIcon size={22} /><span>{t("ui.c51349274d")}</span><ChevronLeft size={17} aria-hidden="true" />
            </button>
          </section>
          <section className="drawer-tool-section" aria-labelledby="drawer-analysis-heading">
            <h3 id="drawer-analysis-heading">{t('ui.5edb2177af')}</h3>
            <div className="drawer-tool-list">
              <button type="button" className="drawer-tool-row" onClick={props.onOpenKeywords}>
                <IconSortIndex /><span>{t("ui.cc9c59a2c4")}</span><ChevronLeft size={17} aria-hidden="true" />
              </button>
              <button type="button" className="drawer-tool-row" onClick={props.onOpenComparison}>
                <GitCompareArrows size={20} /><span>{t("ui.1f253d9ad1")}</span><ChevronLeft size={17} aria-hidden="true" />
              </button>
            </div>
          </section>
          <section className="drawer-tool-section" aria-labelledby="drawer-settings-heading">
            <h3 id="drawer-settings-heading">{t('ui.6badcac8c1')}</h3>
            <button type="button" className="drawer-tool-row" onClick={props.onOpenSettings}>
              <Settings size={20} aria-hidden="true" /><span>{t('ui.6badcac8c1')}</span><ChevronLeft size={17} aria-hidden="true" />
            </button>
          </section>
        </div>}
        {props.view !== 'tools' && <>
        <form onSubmit={submitPage} className="drawer-navigation-form flex items-center gap-2 px-4 pb-3">
          <DictationInput
            value={pageInput}
            onChange={e => { setPageInput(e.target.value); setPageError(false); selection.reset() }}
            onKeyDown={event => { if (!event.nativeEvent.isComposing) selection.move(event) }}
            {...selection.inputProps}
            aria-label={t("ui.54778fcf78")}
            aria-invalid={pageError}
            aria-describedby={pageError ? 'page-jump-error' : undefined}
            inputMode="text"
            placeholder={t("ui.5bb212ac5e")}
            className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
          />
          <button type="submit" className="drawer-navigation-submit rounded-xl px-4 py-2 text-sm font-bold text-white flex-none"
            style={{ background: 'var(--sage)' }}>{t("ui.f06ccf3d9b")}</button>
        </form>
        {!pageInput && <SurahShortcuts meta={meta} pinned={props.pinnedSurahs} recent={props.recentSurahs} onTogglePin={props.onTogglePin} onGo={s => goTo({ kind: 'surah', s })} />}
        {pageError && <p id="page-jump-error" role="alert" className="px-4 pb-3 text-xs">{t("ui.c8cc160d0c")}</p>}

        <DestinationOptions id={selection.id} active={selection.active} options={suggestions} onPick={goTo} className="drawer-destination-options" />
        <details className="px-4 pb-3 text-xs leading-7"><summary>{t("ui.f4bf9b146f")}</summary><dl className="mt-2">{NAVIGATION_HELP.map(([kind,examples])=><div key={kind}><dt className="font-bold">{t(kind)}</dt><dd>{t(examples)}</dd></div>)}</dl><p>{t("ui.a8175202e6")}</p></details>
        </>}
        {props.view !== 'tools' && tab === 'surah' &&
          <SurahNavigationList meta={meta} currentSurah={currentSurah} query={q} showEmpty={!suggestions.length}
            onGoSurah={n => { onGoSurah(n); closeAfterNavigation() }} />}
        {props.view !== 'tools' && tab !== 'surah' && <div className="drawer-content-shell">
        <div className="h-full overflow-y-auto nice-scroll">
          {tab === 'juz' && (
            <div className="p-3 grid grid-cols-2 gap-2">
              {juzList.map(j => (
                <button key={j.j}
                  className="rounded-xl border px-3 py-3 text-right transition-colors"
                  style={{ borderColor: 'var(--line)' }}
                  onClick={() => { onGoVerse(j.s, j.a); closeAfterNavigation() }}
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
                        <button className="flex-1 text-right" onClick={() => { onGoPage(p); closeAfterNavigation() }}>
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

          {tab === 'downloads' && <DownloadsManager meta={meta}/>}
          {tab === 'about' && <section className="p-4 flex flex-col gap-4" aria-label={t('about.title')}>
            <h3 className="text-lg font-bold">{APP_NAME}</h3>
            <p className="text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>{t('about.description')}</p>
            <a className="chip min-h-11" href="https://github.com/MohsenIT/quran-vajeh" target="_blank" rel="noopener noreferrer">{t('about.github')}</a>
          </section>}
          {tab === 'appearance' && <div className="p-4 flex flex-col gap-6">
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

              <AppearanceColors />
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
                <input type="range" min={0.55} max={1.9} step={0.01} value={props.scale}
                  className="page-slider" dir="rtl"
                  style={{ ['--fill' as string]: `${((props.scale - 0.55) / 1.35) * 100}%` }}
                  onChange={e => props.onScale(+e.target.value)} />
                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
                  <span>{t("ui.ad78cda0dc")}</span><span>{toFa(Math.round(props.scale * 100))}٪</span><span>{t("ui.053b14047d")}</span>
                </div>
              </section>

              <ReadingScreenSettings />
          </div>}
          {tab === 'settings' && (
            <div className="p-4 flex flex-col gap-6">
              <LanguageSettings translator={props.translator} onTranslation={props.onTranslator}/>
              <CalendarSettings/>
              <CopyFormatSettings />
              <UpdateSettings />
              <button type="button" className="chip min-h-11" onClick={()=>setTab('downloads')}>{t('downloads.manage')}</button>
              <OfflineSettings />

              <section>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  <IconTranslate />{t("ui.52baa2cbee")}</h3>
                <ResourcePicker label={t("ui.37e2fdb79c")} ids={TRANSLATION_IDS.map(id=>`translation:${id}`)} value={`translation:${props.translator}`} onChange={id=>props.onTranslator(id.replace(/^translation:/,'') as Translator)}/>
              </section>

              <section><h3 className="text-sm font-bold mb-3" style={{color:'var(--ink)'}}>{t("ui.b6a850cc59")}</h3><ResourcePicker browse label={t("ui.8a52f7bc3f")} ids={RESOURCES.map(r=>r.id)} value="" onChange={()=>{}}/></section>


              <p className="text-xs leading-6 pt-2 border-t" style={{ color: 'var(--ink-faint)', borderColor: 'var(--line)' }}>{t("ui.9f4b86895b")}</p>
            </div>
          )}
        </div>
        </div>}
      </aside>
    </>
  )
}
