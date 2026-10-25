'use client'
import {t,uiDirection} from '@/lib/i18n'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, Settings2 } from 'lucide-react'
import type { AnalysisTab } from '@/lib/analysis'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export const ROOT_BOOKS = [
  { id: 'tahqiq', label: t("ui.486f5d9141"), index: '/data/tahqiq-index.json', field: 'matchedRoots' },
  { id: 'maqayis', label: t("ui.4c3a424943"), index: '/data/maqayis-index.json', field: 'translatedRoots' },
  { id: 'ishtiqaqi', label: t("ui.1da653b2f3"), index: '/data/ishtiqaqi-index.json', field: 'matchedRoots' },
] as const

type Kind = 'meaning' | 'stats'
type Option = { id: string; label: string }
export const STAT_OPTIONS: Record<AnalysisTab, Option[]> = {
  root: [{ id: 'surahCount', label: t("ui.7218e3f8bd") }, { id: 'total', label: t("ui.a9b480b287") }, { id: 'hosts', label: t("ui.0703147d39") }, { id: 'keyword', label: t("ui.22512cfbfe") }, { id: 'share', label: t("ui.79c5d4ab13") }, { id: 'distribution', label: t("ui.b09c0633d0") }],
  form: [{ id: 'surahCount', label: t("ui.7218e3f8bd") }, { id: 'total', label: t("ui.a9b480b287") }, { id: 'ayahCount', label: t("ui.e9544cd504") }, { id: 'hosts', label: t("ui.0703147d39") }],
  word: [{ id: 'surahCount', label: t("ui.7218e3f8bd") }, { id: 'total', label: t("ui.a9b480b287") }, { id: 'ayahCount', label: t("ui.e9544cd504") }, { id: 'hosts', label: t("ui.0703147d39") }],
  verse: [{ id: 'words', label: t("ui.2f5035260e") }, { id: 'roots', label: t("ui.a7a0a346a5") }, { id: 'page', label: t("ui.1d63948ef5") }],
  context: [{ id: 'verses', label: t("ui.e9544cd504") }, { id: 'words', label: t("ui.2f5035260e") }, { id: 'roots', label: t("ui.a7a0a346a5") }],
}
const MEANING_OPTIONS: Record<AnalysisTab, Option[]> = {
  root: [...ROOT_BOOKS],
  form: [{ id: 'morphology', label: t("ui.03df2a037d") }],
  word: [{ id: 'lemma', label: t("ui.2c292327c8") }],
  verse: [{ id: 'translation', label: t("ui.6b145438a4") }],
  context: [{ id: 'note', label: t("ui.f3bec71ee0") }],
}
type Preferences = { hidden: string[]; collapsed: string[]; statsFirst: boolean }
const defaults: Preferences = { hidden: [], collapsed: [], statsFirst: false }
const Context = createContext<{ prefs: Preferences; update: (change: (value: Preferences) => Preferences) => void } | null>(null)
const storageKey = 'quran.analysis-sections.v1'
export function AnalysisPreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(defaults)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
      if (saved) setPrefs({ hidden: Array.isArray(saved.hidden) ? saved.hidden.filter((v: unknown) => typeof v === 'string') : [], collapsed: Array.isArray(saved.collapsed) ? saved.collapsed.filter((v: unknown) => typeof v === 'string') : [], statsFirst: saved.statsFirst === true })
    } catch { /* Keep defaults when storage is unavailable or invalid. */ }
    setLoaded(true)
  }, [])
  useEffect(() => { if (loaded) { try { localStorage.setItem(storageKey, JSON.stringify(prefs)) } catch {} } }, [prefs, loaded])
  return <Context.Provider value={{ prefs, update: setPrefs }}>{children}</Context.Provider>
}
export function useAnalysisPreferences() {
  const state = useContext(Context)
  if (!state) throw new Error('Analysis preferences provider missing')
  return { ...state, enabled: (tab: AnalysisTab, kind: Kind, id: string) => !state.prefs.hidden.includes(`${tab}.${kind}.${id}`) }
}
const toggle = (items: string[], key: string) => items.includes(key) ? items.filter(item => item !== key) : [...items, key]

export function AnalysisSettings({ tab, kind }: { tab: AnalysisTab; kind?: Kind }) {
  const { prefs, update } = useAnalysisPreferences()
  return <Popover><PopoverTrigger asChild><button type="button" className="analysis-settings-button" aria-label={kind ? t("ui.01b9b3a2d2",{p0:(kind === 'meaning' ? t("ui.6b6bf2e9ed") : t("ui.72918c0be4"))}) : t("ui.6467fd6147")} title={t("ui.8308380b89")}><Settings2 size={16} /></button></PopoverTrigger>
    <PopoverContent className="analysis-settings-popover" dir={uiDirection()} onPointerDown={event => event.stopPropagation()}>
      <p className="font-bold text-sm mb-3">{t("ui.8308380b89")}</p>
      {(['meaning', 'stats'] as const).filter(value => !kind || value === kind).map(value => <fieldset key={value} className="mb-3">
        <legend className="font-bold text-xs mb-2">{value === 'meaning' ? t("ui.6b6bf2e9ed") : t("ui.72918c0be4")}</legend>
        {(value === 'meaning' ? MEANING_OPTIONS[tab] : STAT_OPTIONS[tab]).map(option => {
          const key = `${tab}.${value}.${option.id}`
          return <label key={key} className="flex items-center gap-2 py-2 text-xs cursor-pointer"><input type="checkbox" checked={!prefs.hidden.includes(key)} onChange={() => update(current => ({ ...current, hidden: toggle(current.hidden, key) }))} />{t(option.label)}</label>
        })}
      </fieldset>)}
      <label className="flex items-center gap-2 text-xs">{t("ui.56d96423b6")}<select aria-label={t("ui.6879ba512c")} value={prefs.statsFirst ? 'stats' : 'meaning'} onChange={event => update(current => ({ ...current, statsFirst: event.target.value === 'stats' }))} className="analysis-order-select"><option value="meaning">{t("ui.6b6bf2e9ed")}</option><option value="stats">{t("ui.72918c0be4")}</option></select></label>
    </PopoverContent>
  </Popover>
}

export function AnalysisSection({ tab, kind, children }: { tab: AnalysisTab; kind: Kind; children: ReactNode }) {
  const { prefs, update } = useAnalysisPreferences()
  const key = `${tab}.${kind}`
  const collapsed = prefs.collapsed.includes(key)
  const title = kind === 'meaning' ? t("ui.6b6bf2e9ed") : t("ui.72918c0be4")
  return <section className="analysis-section" data-analysis-section={kind} style={{ order: kind === (prefs.statsFirst ? 'stats' : 'meaning') ? 0 : 1 }}>
    <div className="analysis-section-heading">
      <button type="button" aria-expanded={!collapsed} className="analysis-section-toggle" onClick={() => update(current => ({ ...current, collapsed: toggle(current.collapsed, key) }))}><ChevronDown size={16} className={collapsed ? '' : 'rotate-180'} /><span>{title}</span></button>
    </div>
    {!collapsed && <div className="analysis-section-content">{children}</div>}
  </section>
}
