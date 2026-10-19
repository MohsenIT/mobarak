'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, Settings2 } from 'lucide-react'
import type { AnalysisTab } from '@/lib/analysis'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export const ROOT_BOOKS = [
  { id: 'tahqiq', label: 'التحقیق', index: '/data/tahqiq-index.json', field: 'matchedRoots' },
  { id: 'maqayis', label: 'مقاییس', index: '/data/maqayis-index.json', field: 'translatedRoots' },
  { id: 'ishtiqaqi', label: 'المعجم الاشتقاقی', index: '/data/ishtiqaqi-index.json', field: 'matchedRoots' },
] as const

type Kind = 'meaning' | 'stats'
type Option = { id: string; label: string }
export const STAT_OPTIONS: Record<AnalysisTab, Option[]> = {
  root: [{ id: 'surahCount', label: 'تعداد در سوره' }, { id: 'total', label: 'تعداد در قرآن' }, { id: 'hosts', label: 'سوره‌های میزبان' }, { id: 'keyword', label: 'شاخص کلیدواژگی' }, { id: 'share', label: 'سهم سوره' }, { id: 'distribution', label: 'نمودار پراکندگی' }],
  form: [{ id: 'surahCount', label: 'تعداد در سوره' }, { id: 'total', label: 'تعداد در قرآن' }, { id: 'ayahCount', label: 'تعداد آیات' }, { id: 'hosts', label: 'سوره‌های میزبان' }],
  word: [{ id: 'surahCount', label: 'تعداد در سوره' }, { id: 'total', label: 'تعداد در قرآن' }, { id: 'ayahCount', label: 'تعداد آیات' }, { id: 'hosts', label: 'سوره‌های میزبان' }],
  verse: [{ id: 'words', label: 'تعداد واژه‌ها' }, { id: 'roots', label: 'ریشه‌های متفاوت' }, { id: 'page', label: 'صفحه و جزء' }],
  context: [{ id: 'verses', label: 'تعداد آیات' }, { id: 'words', label: 'تعداد واژه‌ها' }, { id: 'roots', label: 'ریشه‌های متفاوت' }],
}
const MEANING_OPTIONS: Record<AnalysisTab, Option[]> = {
  root: [...ROOT_BOOKS],
  form: [{ id: 'morphology', label: 'شرح ساخت صرفی و منبع' }],
  word: [{ id: 'lemma', label: 'توضیح بن‌واژه' }],
  verse: [{ id: 'translation', label: 'ترجمهٔ آیه' }],
  context: [{ id: 'note', label: 'توضیح سیاق و منبع' }],
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
  return <Popover><PopoverTrigger asChild><button type="button" className="analysis-settings-button" aria-label={kind ? `تنظیمات ${kind === 'meaning' ? 'معنا و شرح' : 'آمار و پراکندگی'}` : 'تنظیمات بخش‌های تحلیل'} title="تنظیمات نمایش"><Settings2 size={16} /></button></PopoverTrigger>
    <PopoverContent className="analysis-settings-popover" dir="rtl" onPointerDown={event => event.stopPropagation()}>
      <p className="font-bold text-sm mb-3">تنظیمات نمایش</p>
      {(['meaning', 'stats'] as const).filter(value => !kind || value === kind).map(value => <fieldset key={value} className="mb-3">
        <legend className="font-bold text-xs mb-2">{value === 'meaning' ? 'معنا و شرح' : 'آمار و پراکندگی'}</legend>
        {(value === 'meaning' ? MEANING_OPTIONS[tab] : STAT_OPTIONS[tab]).map(option => {
          const key = `${tab}.${value}.${option.id}`
          return <label key={key} className="flex items-center gap-2 py-2 text-xs cursor-pointer"><input type="checkbox" checked={!prefs.hidden.includes(key)} onChange={() => update(current => ({ ...current, hidden: toggle(current.hidden, key) }))} />{option.label}</label>
        })}
      </fieldset>)}
      <label className="flex items-center gap-2 text-xs">بخش اول<select aria-label="ترتیب بخش‌های تحلیل" value={prefs.statsFirst ? 'stats' : 'meaning'} onChange={event => update(current => ({ ...current, statsFirst: event.target.value === 'stats' }))} className="analysis-order-select"><option value="meaning">معنا و شرح</option><option value="stats">آمار و پراکندگی</option></select></label>
    </PopoverContent>
  </Popover>
}

export function AnalysisSection({ tab, kind, children }: { tab: AnalysisTab; kind: Kind; children: ReactNode }) {
  const { prefs, update } = useAnalysisPreferences()
  const key = `${tab}.${kind}`
  const collapsed = prefs.collapsed.includes(key)
  const title = kind === 'meaning' ? 'معنا و شرح' : 'آمار و پراکندگی'
  return <section className="analysis-section" data-analysis-section={kind} style={{ order: kind === (prefs.statsFirst ? 'stats' : 'meaning') ? 0 : 1 }}>
    <div className="analysis-section-heading">
      <button type="button" aria-expanded={!collapsed} className="analysis-section-toggle" onClick={() => update(current => ({ ...current, collapsed: toggle(current.collapsed, key) }))}><ChevronDown size={16} className={collapsed ? '' : 'rotate-180'} /><span>{title}</span></button>
    </div>
    {!collapsed && <div className="analysis-section-content">{children}</div>}
  </section>
}
