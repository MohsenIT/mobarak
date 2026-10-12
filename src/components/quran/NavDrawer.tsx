'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Meta } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import { IconClose, IconSearch, IconStar, IconMoon, IconSun, IconBook, IconTranslate } from './Ornaments'

export type Translator = 'a' | 'f' | 'm'

interface Props {
  meta: Meta
  bookmarks: number[]
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
  { id: 'marks', label: 'نشان‌ها' },
  { id: 'settings', label: 'تنظیمات' },
] as const

const TRANSLATORS: { id: Translator; name: string }[] = [
  { id: 'f', name: 'محمدمهدی فولادوند' },
  { id: 'a', name: 'حسین انصاریان' },
  { id: 'm', name: 'ناصر مکارم شیرازی' },
]

export default function NavDrawer(props: Props) {
  const { meta, onClose, onGoPage, onGoSurah, onGoVerse, currentSurah } = props
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('surah')
  const [q, setQ] = useState('')
  const [pageInput, setPageInput] = useState('')
  const [pageError, setPageError] = useState(false)
  // ref to the surah list container — we scrollIntoView the active row
  // when the drawer opens.
  const surahListRef = useRef<HTMLDivElement>(null)
  const activeSurahRef = useRef<HTMLButtonElement>(null)

  // When the drawer mounts (opens), auto-scroll the surah list so the
  // current surah is visible. Skip when there's a search query (user is
  // already filtering — let them see the filtered list from the top).
  useEffect(() => {
    if (tab !== 'surah' || q.trim() || !activeSurahRef.current) return
    // Use a tiny timeout to let the drawer's slide-in animation start first,
    // otherwise scrollIntoView happens before the layout settles.
    const t = setTimeout(() => {
      activeSurahRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' })
    }, 50)
    return () => clearTimeout(t)
  }, [tab, q])

  const surahs = useMemo(() => {
    const qq = q.trim()
    if (!qq) return meta.surahs
    return meta.surahs.filter(s =>
      s.fa.replace(/‌/g, ' ').includes(qq) || s.ar.includes(qq) || String(s.n) === qq || toFa(s.n) === qq
    )
  }, [q, meta])

  const juzList = useMemo(() =>
    Object.entries(meta.juz).map(([j, [s, a]]) => ({
      j: +j, s, a,
      surahFa: meta.surahs[s - 1]?.fa ?? '',
    })), [meta])

  const submitPage = (e: React.FormEvent) => {
    e.preventDefault()
    const fa = '۰۱۲۳۴۵۶۷۸۹'
    const norm = pageInput.replace(/[۰-۹]/g, d => String(fa.indexOf(d)))
      .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim()
    const p = /^\d+$/.test(norm) ? Number(norm) : NaN
    if (Number.isInteger(p) && p >= 1 && p <= 604) {
      onGoPage(p)
      setPageInput('')
      onClose()
    } else setPageError(true)
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="فهرست">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="font-bold text-lg" style={{ color: 'var(--ink)' }}>مصحف عثمان‌طه</h2>
          <button className="icon-btn" onClick={onClose} aria-label="بستن"><IconClose /></button>
        </div>

        {/* quick page jump */}
        <form onSubmit={submitPage} className="flex items-center gap-2 px-4 pb-3">
          <input
            value={pageInput}
            onChange={e => { setPageInput(e.target.value); setPageError(false) }}
            aria-label="شماره صفحه"
            aria-invalid={pageError}
            aria-describedby={pageError ? 'page-jump-error' : undefined}
            inputMode="numeric"
            placeholder="شماره صفحه (۱ تا ۶۰۴)…"
            className="flex-1 rounded-xl border px-3 py-2.5 text-sm bg-transparent outline-none"
            style={{ borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
          />
          <button type="submit" className="rounded-xl px-4 py-2.5 text-sm font-bold text-white flex-none"
            style={{ background: 'var(--sage)' }}>
            برو
          </button>
        </form>
        {pageError && <p id="page-jump-error" role="alert" className="px-4 pb-3 text-xs">شمارهٔ صفحه باید عددی بین ۱ و ۶۰۴ باشد.</p>}

        <div className="flex border-b px-2" style={{ borderColor: 'var(--line)' }}>
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto nice-scroll">
          {tab === 'surah' && (
            <div className="p-3">
              <label className="flex items-center gap-2 rounded-xl border px-3 py-2.5 mb-3"
                style={{ borderColor: 'var(--line-strong)', background: 'color-mix(in srgb, var(--paper) 60%, transparent)' }}>
                <IconSearch />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="جستجوی سوره…"
                  className="bg-transparent outline-none w-full text-sm"
                  style={{ color: 'var(--ink)' }}
                />
              </label>
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
                          {s.fa} · {toFa(s.vc)} آیه · {s.rev === 'makkah' ? 'مکی' : 'مدنی'}
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
                  <span className="block font-bold" style={{ color: 'var(--ink)' }}>جزء {toFa(j.j)}</span>
                  <span className="block text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
                    {j.surahFa} · آیه {toFa(j.a)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === 'marks' && (
            <div className="p-3">
              {props.bookmarks.length === 0 ? (
                <div className="text-center py-12 text-sm" style={{ color: 'var(--ink-faint)' }}>
                  <div className="flex justify-center mb-3 opacity-60"><IconStar /></div>
                  هنوز صفحه‌ای نشان نکرده‌اید.
                  <br />با ستارهٔ بالای صفحه، صفحهٔ جاری را نشان کنید.
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
            </div>
          )}

          {tab === 'settings' && (
            <div className="p-4 flex flex-col gap-6">
              <section>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  <IconBook /> حالت نمایش
                </h3>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="حالت نمایش">
                  {(['mushaf', 'flow'] as const).map(mode => (
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
