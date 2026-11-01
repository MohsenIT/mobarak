'use client'

import { useEffect, useState } from 'react'

export const COPY_SETTINGS_KEY = 'mubarak.copy-format.v1'
export type CopyFormat = 'full' | 'compact' | 'custom'
export type CopyCustomFormat = {
  heading: 'start' | 'end' | 'none'
  verseNumbers: boolean
  translation: boolean
  lineBreaks: boolean
}
export type CopySettings = { format: CopyFormat; custom: CopyCustomFormat }

export const DEFAULT_COPY_SETTINGS: CopySettings = {
  format: 'compact',
  custom: { heading: 'end', verseNumbers: false, translation: false, lineBreaks: false },
}

export function parseCopySettings(value: unknown): CopySettings {
  if (!value || typeof value !== 'object') return DEFAULT_COPY_SETTINGS
  const saved = value as Partial<CopySettings>
  const format: CopyFormat = saved.format === 'full' || saved.format === 'custom' ? saved.format : 'compact'
  const custom = saved.custom && typeof saved.custom === 'object' ? saved.custom : {}
  return {
    format,
    custom: {
      heading: custom.heading === 'start' || custom.heading === 'none' ? custom.heading : 'end',
      verseNumbers: !!custom.verseNumbers,
      translation: !!custom.translation,
      lineBreaks: !!custom.lineBreaks,
    },
  }
}

export function readCopySettings(): CopySettings {
  if (typeof window === 'undefined') return DEFAULT_COPY_SETTINGS
  try { return parseCopySettings(JSON.parse(localStorage.getItem(COPY_SETTINGS_KEY) || '{}')) } catch { return DEFAULT_COPY_SETTINGS }
}

export function saveCopySettings(settings: CopySettings) {
  try { localStorage.setItem(COPY_SETTINGS_KEY, JSON.stringify(settings)); window.dispatchEvent(new Event('mobarak-copy-settings')) } catch {}
}

export function useCopySettings() {
  const [settings, setSettings] = useState(DEFAULT_COPY_SETTINGS)
  useEffect(() => {
    const restore = () => setSettings(readCopySettings())
    restore()
    window.addEventListener('storage', restore)
    window.addEventListener('mobarak-copy-settings', restore)
    return () => { window.removeEventListener('storage', restore); window.removeEventListener('mobarak-copy-settings', restore) }
  }, [])
  return settings
}
