'use client'
import {t} from '@/lib/i18n'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Meta, SurahData } from '@/lib/quran'
import {
  keywordScore, keywordTier, loadGlobalRoots, loadSurah, loadTrans,
  toFa,
} from '@/lib/quran'
import { IconClose, IconInfo, IconSearch } from './Ornaments'

interface Props {
  surahN: number
  meta: Meta
  /** currently picked root — highlight the active row so the user
      can see where they are in the list when returning from the panel */
  activeRoot: string | null
  onClose: () => void
  /** open the root panel for a specific word in the surah.
      NOTE: the index does NOT close when this is called — the user
      explicitly wants the index to stay open so they can return to
      the same scroll position after closing the panel. */
  onPickRoot: (root: string) => void
}

type SortKey = 'score' | 'count' | 'alpha' | 'spread'

const SORT_LABELS: Record<SortKey, string> = {
  score: t("ui.f34eb913af"),
  count: t("ui.d8184fb34e"),
  alpha: t("ui.86a8a30f4b"),
  spread: t("ui.0d5fe88e5d"),
}

export default function SurahIndex({ surahN, meta, activeRoot, onClose, onPickRoot }: Props) {
  const [surah, setSurah] = useState<SurahData | null>(null)
  const [globalRoots, setGlobalRoots] = useState<Record<string, Record<string, number>> | null>(null)
  const [sort, setSort] = useState<SortKey>('score')
  const [q, setQ] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let live = true
    loadSurah(surahN).then(d => live && setSurah(d))
    loadGlobalRoots().then(r => live && setGlobalRoots(r))
    return () => { live = false }
  }, [surahN])

  const rows = useMemo(() => {
    if (!surah || !globalRoots) return []
    const surahWords = surah.v.reduce((n, v) => n + v.w.length, 0)
    const out = Object.entries(surah.ri).map(([root, occ]) => {
      const inSurah = occ.length
      const g = globalRoots[root]
      const total = g ? Object.values(g).reduce((a, b) => a + b, 0) : inSurah
      const df = g ? Object.keys(g).length : 1
      const score = keywordScore({ inSurah, total, surahWords, df })
      const ayahs = new Set(occ.map(([a]) => a)).size
      const tier = keywordTier(score)
      return {
        root,
        inSurah,
        total,
        df,
        score,
        ayahs,
        tier,
        firstAyah: occ.length ? occ[0][0] : 1,
      }
    })
    return out
  }, [surah, globalRoots])

  const sorted = useMemo(() => {
    const qq = q.trim()
    let arr = rows
    if (qq) arr = arr.filter(r => r.root.includes(qq))
    const cmp = (a: typeof rows[number], b: typeof rows[number]) => {
      switch (sort) {
        case 'score':  return b.score - a.score || b.inSurah - a.inSurah
        case 'count':  return b.inSurah - a.inSurah || b.score - a.score
        case 'spread': return b.ayahs - a.ayahs || b.inSurah - a.inSurah
        case 'alpha':  return a.root.localeCompare(b.root, 'ar')
      }
      return 0
    }
    return [...arr].sort(cmp)
  }, [rows, sort, q])

  // When the active root changes (user picked one), scroll it into view
  // so the highlight stays visible even after the user closes the panel.
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeRoot, sorted])

  const sm = meta.surahs[surahN - 1]
  const maxCount = useMemo(() => Math.max(1, ...rows.map(r => r.inSurah)), [rows])
  const maxScore = useMemo(() => Math.max(0.0001, ...rows.map(r => r.score)), [rows])

  return (
    <>
      {/* backdrop — clicking it dismisses the index entirely */}
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="surah-index-drawer" role="dialog" aria-label={t("ui.cc9c59a2c4")}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--ink)' }}>{t("ui.cc9c59a2c4")}{sm?.fa}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>
              {toFa(rows.length)}{' '}{t("ui.142ea1f41f")}{' '}{t(SORT_LABELS[sort])}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t("ui.313cbecb4d")}><IconClose /></button>
        </div>

        {/* controls */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <label className="flex items-center gap-2 flex-1 rounded-xl border px-3 py-2"
            style={{ borderColor: 'var(--line-strong)', background: 'color-mix(in srgb, var(--paper) 60%, transparent)' }}>
            <IconSearch />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={t("ui.cadb0da2e6")}
              className="bg-transparent outline-none w-full text-sm"
              style={{ color: 'var(--ink)' }}
            />
          </label>
        </div>
        <div className="flex border-b px-2 mb-2" style={{ borderColor: 'var(--line)' }}>
          {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
            <button key={k} className={`tab-btn${sort === k ? ' active' : ''}`} onClick={() => setSort(k)}>
              {t(SORT_LABELS[k])}
            </button>
          ))}
        </div>

        {/* list — ref'd so we can scrollIntoView the active row */}
        <div ref={listRef} className="flex-1 overflow-y-auto nice-scroll px-3 pb-3">
          {sorted.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: 'var(--ink-faint)' }}>…</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {sorted.map((r, idx) => {
                const isActive = activeRoot === r.root
                return (
                  <button
                    key={r.root}
                    ref={isActive ? activeRef : null}
                    className={`idx-row${isActive ? ' active' : ''}`}
                    onClick={() => onPickRoot(r.root)}
                  >
                    <span className="idx-rank">{toFa(idx + 1)}</span>
                    <span className="font-quran flex-none" dir="rtl"
                      style={{ fontSize: 22, letterSpacing: '0.12em', color: 'var(--gold-deep)', fontWeight: 700, minWidth: 80 }}>
                      {r.root}
                    </span>
                    <span className="flex-1 flex flex-col gap-1 min-w-0">
                      <span className="idx-bar-track">
                        <span className="idx-bar-fill" style={{ width: `${(r.inSurah / maxCount) * 100}%` }} />
                      </span>
                      <span className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                        <span>{toFa(r.inSurah)}{' '}{t("ui.f22ce71891")}{' '}{toFa(r.ayahs)}{' '}{t("ui.b1b168c791")}</span>
                        <span>·</span>
                        <span>{toFa(r.total)}{' '}{t("ui.48dbdddb5f")}</span>
                        {r.df <= 5 && <span className="chip" style={{ borderColor: 'var(--sage)', color: 'var(--sage)', fontSize: 10 }}>{t("ui.da2d9f5e0c")}</span>}
                      </span>
                    </span>
                    {/* keyword score mini-gauge */}
                    <span className="flex flex-col items-end gap-1 flex-none min-w-[64px]">
                      <span className="idx-gauge">
                        <span className="idx-gauge-fill" style={{ width: `${r.score * 100}%` }} />
                      </span>
                      <span className="text-[10px]" style={{
                        color: r.tier.tier === 'core' ? 'var(--gold-deep)'
                          : r.tier.tier === 'key' ? 'var(--sage)'
                          : 'var(--ink-faint)',
                        fontWeight: r.tier.tier === 'core' || r.tier.tier === 'key' ? 700 : 400,
                      }}>
                        {t(r.tier.label)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* footer with hint */}
        <div className="px-4 py-2.5 border-t text-[11px] flex items-center gap-2" style={{ borderColor: 'var(--line)', color: 'var(--ink-faint)' }}>
          <IconInfo />
          <span>{t("ui.6d2052087b")}</span>
        </div>
      </aside>
    </>
  )
}
