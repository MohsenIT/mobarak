'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pin, PinOff } from 'lucide-react'
import UpdateSettings from './UpdateSettings'
import { APP_NAME } from '@/lib/branding'
import type { Meta, Translator } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import { destinationSuggestions, resolveDestination, normalizeSearch, searchSurahs, type Destination } from '@/lib/navigation'
import { IconClose, IconSearch, IconStar, IconMoon, IconSun, IconBook, IconTranslate } from './Ornaments'

export type { Translator } from '@/lib/quran'

interface Props {
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
  { id: 'surah', label: 'سوره‌ها' },
  { id: 'juz', label: 'اجزاء' },
  { id: 'recent', label: 'اخیر' },
  { id: 'settings', label: 'تنظیمات' },
] as const

const TRANSLATORS: { id: Translator; name: string }[] = [
  { id: 's', name: 'سید محمدرضا صفوی (مبتنی بر المیزان)' },
  { id: 'f', name: 'محمدمهدی فولادوند' },
  { id: 'a', name: 'حسین انصاریان' },
  { id: 'm', name: 'ناصر مکارم شیرازی' },
]

export default function NavDrawer(props: Props) {
  const { meta, onClose, onGoPage, onGoSurah, onGoVerse, currentSurah } = props
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('surah')
  const [pageInput, setPageInput] = useState('')
  const q = pageInput
  const contentRef = useRef<HTMLDivElement>(null)
  const [pageError, setPageError] = useState(false)
  const [shortcutsExpanded, setShortcutsExpanded] = useState(false)
  const shortcuts = [...props.pinnedSurahs, ...props.recentSurahs.filter(n => !props.pinnedSurahs.includes(n))]
  // ref to the surah list container — we scrollIntoView the active row
  // when the drawer opens.
  const surahListRef = useRef<HTMLDivElement>(null)
  const activeSurahRef = useRef<HTMLButtonElement>(null)

  // When the drawer mounts (opens), auto-scroll the surah list so the
  // current surah is visible. Skip when there's a search query (user is
  // already filtering — let them see the filtered list from the top).
  useEffect(() => {
    if (tab !== 'surah' || q.trim()) return
    if (props.pinnedSurahs.length) { if (contentRef.current) contentRef.current.scrollTop = 0; return }
    if (!activeSurahRef.current) return
    // Use a tiny timeout to let the drawer's slide-in animation start first,
    // otherwise scrollIntoView happens before the layout settles.
    const t = setTimeout(() => {
      const pane = contentRef.current, row = activeSurahRef.current
      if (pane && row) pane.scrollTop = Math.max(0, pane.scrollTop + row.getBoundingClientRect().top - pane.getBoundingClientRect().top - (pane.clientHeight - row.clientHeight) / 2)
    }, 50)
    return () => clearTimeout(t)
  }, [tab, q, props.pinnedSurahs.length])

  const surahs = useMemo(() => {
    const results = searchSurahs(meta, q)
    if (q.trim()) return results
    const rank = (n: number) => { const i = props.pinnedSurahs.indexOf(n); return i < 0 ? props.pinnedSurahs.length : i }
    return [...results].sort((a, b) => rank(a.n) - rank(b.n) || a.n - b.n)
  }, [q, meta, props.pinnedSurahs])
  const suggestions = useMemo(() => destinationSuggestions(meta, pageInput, currentSurah), [meta, pageInput, currentSurah])

  const juzList = useMemo(() =>
    Object.entries(meta.juz).map(([j, [s, a]]) => ({
      j: +j, s, a,
      surahFa: meta.surahs[s - 1]?.fa ?? '',
    })), [meta])

  const goTo = (destination: Destination) => {
    if (destination.kind === 'page') onGoPage(destination.p)
    else if (destination.kind === 'surah') onGoSurah(destination.s)
    else onGoVerse(destination.s, destination.a)
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
      <aside className="drawer" role="dialog" aria-label="فهرست">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <img src="/icons/logo-5-192.png" width="34" height="34" alt="" className="shrink-0 rounded-full" />
            <h2 className="font-bold text-lg" style={{ color: 'var(--ink)' }}>{APP_NAME}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="بستن"><IconClose /></button>
        </div>

        <button type="button" className="drawer-advanced-search" onClick={props.onAdvancedSearch}><IconSearch /><span>جست‌وجوی پیشرفته</span><span>در متن، ریشه و بُن‌واژه ←</span></button>
        <form onSubmit={submitPage} className="flex items-center gap-2 px-4 pb-3">
          <input
            value={pageInput}
            onChange={e => { setPageInput(e.target.value); setPageError(false) }}
            aria-label="جستجو و رفتن به مقصد"
            aria-invalid={pageError}
            aria-describedby={pageError ? 'page-jump-error' : undefined}
            inputMode="text"
            placeholder="برو به… طه، ۲۰:۱۴، صفحه ۵۰"
            className="flex-1 min-w-0 rounded-xl border px-3 py-2.5 text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
          />
          <button type="submit" className="rounded-xl px-4 py-2.5 text-sm font-bold text-white flex-none"
            style={{ background: 'var(--sage)' }}>
            برو
          </button>
        </form>
        {pageError && <p id="page-jump-error" role="alert" className="px-4 pb-3 text-xs">مقصد را از پیشنهادها انتخاب کنید یا دقیق‌تر بنویسید؛ مثلاً «طه:۱۴» یا «صفحه ۵۰».</p>}

        {suggestions.length > 0 && <div className="drawer-destination-options" aria-label="مقصدهای پیشنهادی">
          {suggestions.map((item, index) => <button key={index} type="button" onClick={() => goTo(item.destination)}>{toFa(item.label)}</button>)}
        </div>}
        {!pageInput && (props.pinnedSurahs.length > 0 || props.recentSurahs.length > 0) && <div className="drawer-recent-shortcuts" aria-label="میان‌بر سوره‌ها">{shortcuts.slice(0, shortcutsExpanded ? undefined : 3).map(n => <button type="button" key={n} className="chip" data-pinned={props.pinnedSurahs.includes(n) || undefined} onClick={() => goTo({ kind: 'surah', s: n })} title={props.pinnedSurahs.includes(n) ? 'سورهٔ سنجاق‌شده' : 'اخیراً خوانده‌اید'}>{meta.surahs[n - 1]?.fa}</button>)}{shortcuts.length > 3 && <button type="button" aria-label={shortcutsExpanded ? 'نمایش کمتر سوره‌ها' : 'نمایش همهٔ میان‌برها'} aria-expanded={shortcutsExpanded} onClick={() => setShortcutsExpanded(value => !value)}>{shortcutsExpanded ? 'کمتر' : '…'}</button>}</div>}
        <div className="flex border-b px-2" style={{ borderColor: 'var(--line)' }}>
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div ref={contentRef} className="flex-1 overflow-y-auto nice-scroll">
          {tab === 'surah' && (
            <div className="p-3">
              {surahs.length === 0 && !suggestions.length && <p role="status" className="text-center py-4 text-sm">مقصدی با این نام یا شماره پیدا نشد.</p>}
              <div ref={surahListRef} className="flex flex-col">
                {surahs.map(s => {
                  const isActive = s.n === currentSurah
                  return (
                    <div key={s.n} className="flex items-center">
                    <button

                      ref={isActive ? activeSurahRef : null}
                      className="nav-surah-row flex-1 min-w-0"
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
                          {s.fa} · {toFa(s.vc)} آیه · {s.rev === 'makkah' ? 'مکی' : 'مدنی'}
                        </span>
                      </span>
                    </button>
                    <button type="button" className="icon-btn" aria-label={`${props.pinnedSurahs.includes(s.n) ? 'برداشتن سنجاق' : 'سنجاق'} ${s.fa}`} aria-pressed={props.pinnedSurahs.includes(s.n)} onClick={() => props.onTogglePin(s.n)}>{props.pinnedSurahs.includes(s.n) ? <PinOff size={17} /> : <Pin size={17} />}</button>
                    </div>
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
                  <span className="block font-bold" style={{ color: 'var(--ink)' }}>جزء {toFa(j.j)}</span>
                  <span className="block text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
                    {j.surahFa} · آیه {toFa(j.a)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === 'recent' && (
            <div className="p-3">
              <div className="drawer-recent-heading"><h3>سوره‌های اخیر</h3>{props.recentSurahs.length > 0 && <button type="button" onClick={props.onClearRecent}>پاک‌کردن سابقه</button>}</div>
              {props.recentSurahs.length === 0 && <p className="text-xs py-4" style={{ color: 'var(--ink-soft)' }}>هنوز سابقه‌ای ثبت نشده است.</p>}
              {props.recentSurahs.map(n => <button type="button" className="nav-surah-row" key={n} onClick={() => goTo({ kind: 'surah', s: n })}><span>{toFa(n)} · {meta.surahs[n - 1]?.fa}</span>{n === currentSurah && <small>سورهٔ جاری</small>}</button>)}
              <details className="drawer-legacy-bookmarks"><summary>نشان‌های قبلی · {toFa(props.bookmarks.length)}</summary>
              {props.bookmarks.length === 0 ? (
                <div className="text-center py-12 text-sm" style={{ color: 'var(--ink-faint)' }}>
                  <div className="flex justify-center mb-3 opacity-60"><IconStar /></div>
                  هنوز صفحه‌ای نشان نکرده‌اید.
                  <br />نشان‌های ذخیره‌شدهٔ قبلی اینجا نگه داشته می‌شوند.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {[...props.bookmarks].sort((a, b) => a - b).map(p => {
                    const names = [...new Set((meta.pages[p - 1] || []).map(sg => meta.surahs[sg.s - 1]?.fa))].join('، ')
                    return (
                      <div key={p} className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
                        style={{ borderColor: 'var(--line)' }}>
                        <button className="flex-1 text-right" onClick={() => { onGoPage(p); onClose() }}>
                          <span className="block font-bold text-sm" style={{ color: 'var(--ink)' }}>صفحه {toFa(p)}</span>
                          <span className="block text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{names}</span>
                        </button>
                        <button className="icon-btn sm" style={{ color: 'var(--ink-faint)' }}
                          onClick={() => props.onRemoveBookmark(p)} aria-label="حذف نشان">
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
              <UpdateSettings />
              <section>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  {props.theme === 'night' ? <IconMoon /> : <IconSun />} پوسته
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {(['paper', 'night'] as const).map(t => (
                    <button key={t}
                      className="rounded-xl border py-3 text-sm font-medium transition-all"
                      style={{
                        borderColor: props.theme === t ? 'var(--sage)' : 'var(--line)',
                        background: props.theme === t ? 'var(--word-root)' : 'transparent',
                        color: 'var(--ink)',
                      }}
                      onClick={() => props.onTheme(t)}>
                      {t === 'paper' ? 'کاغذی روشن' : 'شب‌خوان'}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  <IconTranslate /> مترجم
                </h3>
                <div className="flex flex-col gap-2">
                  {TRANSLATORS.map(t => (
                    <button key={t.id}
                      className="rounded-xl border px-4 py-3 text-sm text-right font-medium transition-all"
                      style={{
                        borderColor: props.translator === t.id ? 'var(--sage)' : 'var(--line)',
                        background: props.translator === t.id ? 'var(--word-root)' : 'transparent',
                        color: 'var(--ink)',
                      }}
                      onClick={() => props.onTranslator(t.id)}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  <IconBook /> اندازهٔ خط قرآن
                </h3>
                <div className="flex items-center justify-center gap-3 mb-3" role="group" aria-label="بزرگ‌نمایی">
                  <button className="icon-btn" aria-label="بزرگ‌نمایی"
                    disabled={props.scale >= 1.9}
                    onClick={() => props.onScale(Math.round(Math.min(1.9, props.scale + 0.15) * 20) / 20)}>
                    <span className="text-lg font-bold">+</span>
                  </button>
                  <span className="text-sm" style={{ color: 'var(--ink)' }}>{toFa(Math.round(props.scale * 100))}٪</span>
                  <button className="icon-btn" aria-label="کوچک‌نمایی"
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
                  <span>ریز</span><span>{toFa(Math.round(props.scale * 100))}٪</span><span>درشت</span>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  <IconBook /> حالت نمایش
                </h3>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="حالت نمایش">
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
                      {mode === 'mushaf' ? 'مصحف' : 'پیوسته'}
                    </button>
                  ))}
                </div>
              </section>

              <p className="text-xs leading-6 pt-2 border-t" style={{ color: 'var(--ink-faint)', borderColor: 'var(--line)' }}>
                متن عثمانی مصحف مدینه (خط عثمان‌طه) · ریشه‌شناسی واژگان بر پایهٔ Quranic Arabic Corpus ·
                ترجمه‌ها از تنزیل. نشان‌ها و تنظیمات فقط در همین مرورگر ذخیره می‌شوند.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
