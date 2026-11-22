'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { t } from '@/lib/i18n'
import { juzAtVerse, surahJuzRange } from '@/lib/juz-navigation'
import { searchSurahs } from '@/lib/navigation'
import { toFa, type Meta } from '@/lib/quran'
import JuzRail from './JuzRail'

export default function SurahNavigationList({ meta, currentSurah, query: q, showEmpty, onGoSurah }: {
  meta: Meta
  currentSurah: number
  query: string
  showEmpty: boolean
  onGoSurah: (surah: number) => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  // ref to the surah list container — we scrollIntoView the active row
  // when the drawer opens.
  const activeSurahRef = useRef<HTMLButtonElement>(null)
  const initialScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [indexedJuz, setIndexedJuz] = useState(() => juzAtVerse(meta,currentSurah,1))
  const railScroll = useRef<number | null>(null)
  const juzNumbers = useMemo(()=>Object.keys(meta.juz).map(Number).sort((a,b)=>a-b),[meta])
  const juzRanges = useMemo(()=>new Map(meta.surahs.map(s=>[s.n,surahJuzRange(meta,s)])),[meta])
  const indexJuz = (juz: number) => {
    if(initialScrollTimer.current)clearTimeout(initialScrollTimer.current)
    const pane=contentRef.current, start=meta.juz[String(juz)]
    const row=start&&pane?.querySelector<HTMLElement>(`[data-surah-row="${start[0]}"]`)
    if(!pane||!row)return
    setIndexedJuz(juz)
    const top=Math.max(0,Math.min(pane.scrollHeight-pane.clientHeight,pane.scrollTop+row.getBoundingClientRect().top-pane.getBoundingClientRect().top-12))
    railScroll.current=top
    pane.scrollTo({top,behavior:'instant'})
  }

  // When the drawer mounts (opens), auto-scroll the surah list so the
  // current surah is visible. Skip when there's a search query (user is
  // already filtering — let them see the filtered list from the top).
  useEffect(() => {
    if (q.trim()) return
    if (!activeSurahRef.current) return
    // Use a tiny timeout to let the drawer's slide-in animation start first,
    // otherwise scrollIntoView happens before the layout settles.
    const t = setTimeout(() => {
      const pane = contentRef.current, row = activeSurahRef.current
      if (pane && row) pane.scrollTop = Math.max(0, pane.scrollTop + row.getBoundingClientRect().top - pane.getBoundingClientRect().top - (pane.clientHeight - row.clientHeight) / 2)
    }, 50)
    initialScrollTimer.current=t
    return () => clearTimeout(t)
  }, [q, currentSurah])

  const surahs = useMemo(() => searchSurahs(meta, q), [q, meta])
  return (
        <div className="drawer-content-shell">
        <div ref={contentRef} className="h-full overflow-y-auto nice-scroll" onScroll={event=>{
          if(q.trim())return
          const pane=event.currentTarget,top=pane.getBoundingClientRect().top
          if(railScroll.current!==null&&Math.abs(pane.scrollTop-railScroll.current)<1)return
          railScroll.current=null
          const row=Array.from(pane.querySelectorAll<HTMLElement>('[data-surah-row]')).find(row=>row.getBoundingClientRect().bottom>top+8)
          if(row)setIndexedJuz(juzAtVerse(meta,Number(row.dataset.surahRow),1))
        }}>
            <div className={`p-3${!q.trim()?' drawer-surahs-with-index':''}`}>
              {surahs.length === 0 && showEmpty && <p role="status" className="text-center py-4 text-sm">{t("ui.68f830ec5c")}</p>}
              <div className="flex flex-col">
                {surahs.map(s => {
                  const isActive = s.n === currentSurah
                  return (
                    <button
                      key={s.n}
                      ref={isActive ? activeSurahRef : null}
                      className="nav-surah-row"
                      data-surah-row={s.n}
                      data-active={isActive || undefined}
                      style={isActive ? {
                        background: 'var(--word-root)',
                        borderColor: 'var(--sage)',
                      } : { borderBottom: '1px solid var(--line)' }}
                      /* FIX: was onGoPage(s.pg) — broke flow mode. Use onGoSurah so
                         the current mode is respected (page in mushaf, surah in flow). */
                      onClick={() => onGoSurah(s.n)}
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
                          <span>{toFa(s.vc)} {t("ui.b1b168c791")}</span>{' . '}
                          <span>{s.rev === 'makkah' ? t("ui.039e791597") : t("ui.40f14b2806")}</span>{' . '}
                          <span className="nav-surah-juz-range">{t('ui.f74f9b04c7')}{' '}<bdi dir="ltr">{toFa(juzRanges.get(s.n)!.from)}{juzRanges.get(s.n)!.to!==juzRanges.get(s.n)!.from&&<>–{toFa(juzRanges.get(s.n)!.to)}</>}</bdi></span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
        </div>
        {!q.trim() && <JuzRail numbers={juzNumbers} active={indexedJuz} onSelect={indexJuz} />}
        </div>
  )
}
