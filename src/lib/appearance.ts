export const APPEARANCE_KEY = 'mushaf.appearance.v1'
export type ReaderTheme = 'paper' | 'night'
export const COLOR_FIELDS = ['background', 'surface', 'text', 'accent', 'gold', 'highlight', 'selected'] as const
export type ColorField = typeof COLOR_FIELDS[number]
export type Palette = Record<ColorField, string>
export type Appearance = Record<ReaderTheme, Partial<Palette>>
export const DEFAULT_PALETTES: Record<ReaderTheme, Palette> = {
  paper: { background: '#f2ecdc', surface: '#f6f1e3', text: '#0e2a22', accent: '#2a9d8f', gold: '#e9c46a', highlight: '#daddce', selected: '#c6d1c1' },
  night: { background: '#0e2a22', surface: '#123028', text: '#f2ecdc', accent: '#2a9d8f', gold: '#e9c46a', highlight: '#26443a', selected: '#38584d' },
}
export function parseAppearance(value: unknown): Appearance {
  const result: Appearance = { paper: {}, night: {} }
  if (!value || typeof value !== 'object') return result
  for (const theme of ['paper', 'night'] as const) {
    const palette = (value as Record<string, unknown>)[theme]
    if (!palette || typeof palette !== 'object') continue
    for (const field of COLOR_FIELDS) {
      const color = (palette as Record<string, unknown>)[field]
      if (typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)) result[theme][field] = color
    }
  }
  return result
}
export function paletteVariables(palette: Partial<Palette>): Record<string, string> {
  const vars: Record<string, string> = {}
  const mix = (color: string, amount: number) => `color-mix(in srgb, ${color} ${amount}%, transparent)`
  if (palette.background) {
    vars['--paper'] = palette.background
    vars['--paper-2'] = `color-mix(in srgb, ${palette.background} 96%, var(--ink))`
    vars['--paper-3'] = `color-mix(in srgb, ${palette.background} 89%, var(--ink))`
  }
  if (palette.surface) vars['--sheet'] = palette.surface
  if (palette.text) {
    vars['--ink'] = palette.text
    vars['--ink-2'] = palette.text
    for (const [key, amount] of [['ink-soft', 66], ['ink-faint', 38], ['line', 14], ['line-strong', 28]] as const) vars[`--${key}`] = mix(palette.text, amount)
  }
  if (palette.accent) { vars['--sage'] = palette.accent; vars['--teal'] = palette.accent }
  if (palette.gold) {
    vars['--gold'] = palette.gold
    vars['--gold-deep'] = palette.gold
    vars['--gold-faint'] = mix(palette.gold, 16)
  }
  if (palette.highlight) {
    vars['--word-active'] = palette.highlight
    vars['--word-root'] = palette.highlight
    vars['--word-hover'] = mix(palette.highlight, 70)
  }
  if (palette.selected) vars['--word-selected'] = palette.selected
  return vars
}
export function appearanceCss(value: Appearance): string {
  return (['paper', 'night'] as const).map(theme => {
    const selector = theme === 'paper' ? ':root:not([data-theme]),:root[data-theme="paper"]' : ':root[data-theme="night"]'
    return `${selector}{${Object.entries(paletteVariables(value[theme])).map(([key, color]) => `${key}:${color}`).join(';')}}`
  }).join('\n')
}
