'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { t } from '@/lib/i18n'
import { APPEARANCE_KEY, COLOR_FIELDS, DEFAULT_PALETTES, appearanceCss, parseAppearance, type Appearance, type ColorField, type ReaderTheme } from '@/lib/appearance'

const AppearanceContext = createContext({
  colors: { paper: {}, night: {} } as Appearance,
  update: (_theme: ReaderTheme, _field: ColorField, _color: string) => {},
  reset: (_theme: ReaderTheme) => {},
})

/** Root-scoped tokens also cover portals, search, and the separate study route. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<Appearance>({ paper: {}, night: {} })
  useEffect(() => {
    const restore = () => {
      try { setColors(parseAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) || '{}'))) } catch { setColors({ paper: {}, night: {} }) }
      try {
        const theme = JSON.parse(localStorage.getItem('mushaf.theme') || '"paper"')
        if (theme === 'paper' || theme === 'night') {
          document.documentElement.dataset.theme = theme
          document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light'
        }
      } catch {}
    }
    restore()
    const storage = (event: StorageEvent) => { if (!event.key || event.key === APPEARANCE_KEY || event.key === 'mushaf.theme') restore() }
    window.addEventListener('storage', storage)
    return () => window.removeEventListener('storage', storage)
  }, [])
  useEffect(() => {
    const sync = () => {
      const root = document.documentElement
      const theme = root.dataset.theme === 'night' ? 'night' : 'paper'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors[theme].background || DEFAULT_PALETTES[theme].background)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [colors])
  const save = (next: Appearance) => {
    setColors(next)
    try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next)) } catch {}
  }
  return <AppearanceContext.Provider value={{ colors,
    update: (theme, field, color) => { if (/^#[\da-f]{6}$/i.test(color)) save({ ...colors, [theme]: { ...colors[theme], [field]: color } }) },
    reset: theme => save({ ...colors, [theme]: {} }),
  }}><style>{appearanceCss(colors)}</style>{children}</AppearanceContext.Provider>
}

export function AppearanceColors() {
  const { colors, update, reset } = useContext(AppearanceContext)
  return <section className="appearance-colors" aria-label={t('appearance.colors')}>
    <h3 className="text-sm font-bold">{t('appearance.colors')}</h3>
    {(['paper', 'night'] as const).map(theme => <fieldset key={theme}>
      <legend>{t(theme === 'paper' ? 'ui.a97a005a42' : 'ui.95b1ddc4a1')}</legend>
      {COLOR_FIELDS.map(field => <label key={field}>
        <span>{t(`appearance.${field}`)}</span>
        <input type="color" value={colors[theme][field] || DEFAULT_PALETTES[theme][field]}
          aria-label={`${t(theme === 'paper' ? 'ui.a97a005a42' : 'ui.95b1ddc4a1')} — ${t(`appearance.${field}`)}`}
          onInput={event => update(theme, field, event.currentTarget.value)}
          onChange={event => update(theme, field, event.target.value)} />
      </label>)}
      <button type="button" className="chip min-h-11" onClick={() => reset(theme)}>{t('appearance.reset')}</button>
    </fieldset>)}
  </section>
}
