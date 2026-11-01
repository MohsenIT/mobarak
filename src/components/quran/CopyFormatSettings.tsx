'use client'

import { useState } from 'react'
import { t } from '@/lib/i18n'
import { DEFAULT_COPY_SETTINGS, saveCopySettings, useCopySettings, type CopySettings } from '@/lib/copy-settings'

export default function CopyFormatSettings() {
  const stored = useCopySettings()
  const [draft, setDraft] = useState<CopySettings | null>(null)
  const settings = draft ?? stored
  const update = (next: CopySettings) => { setDraft(next); saveCopySettings(next) }
  const custom = settings.custom
  return <section className="copy-format-settings">
    <h3 className="text-sm font-bold mb-3">{t('copy.settingsTitle')}</h3>
    <p className="text-xs leading-6 mb-3" style={{ color: 'var(--ink-soft)' }}>{t('copy.settingsHelp')}</p>
    <label><span>{t('copy.formatLabel')}</span><select aria-label={t('copy.formatLabel')} value={settings.format} onChange={event => update({ ...settings, format: event.target.value as CopySettings['format'] })}>
      <option value="compact">{t('copy.formatCompact')}</option><option value="full">{t('copy.formatFull')}</option><option value="custom">{t('copy.formatCustom')}</option>
    </select></label>
    {settings.format === 'custom' && <fieldset><legend>{t('copy.customTitle')}</legend>
      <label><span>{t('copy.referencePosition')}</span><select aria-label={t('copy.referencePosition')} value={custom.heading} onChange={event => update({ ...settings, custom: { ...custom, heading: event.target.value as typeof custom.heading } })}><option value="start">{t('copy.referenceStart')}</option><option value="end">{t('copy.referenceEnd')}</option><option value="none">{t('copy.referenceNone')}</option></select></label>
      <label className="choice-row"><input type="checkbox" checked={custom.verseNumbers} onChange={event => update({ ...settings, custom: { ...custom, verseNumbers: event.target.checked } })}/>{t('copy.verseNumbers')}</label>
      <label className="choice-row"><input type="checkbox" checked={custom.translation} onChange={event => update({ ...settings, custom: { ...custom, translation: event.target.checked } })}/>{t('copy.includeTranslation')}</label>
      <label className="choice-row"><input type="checkbox" checked={custom.lineBreaks} onChange={event => update({ ...settings, custom: { ...custom, lineBreaks: event.target.checked } })}/>{t('copy.lineBreaks')}</label>
    </fieldset>}
    <button type="button" className="chip min-h-11" onClick={() => update(DEFAULT_COPY_SETTINGS)}>{t('copy.restoreDefault')}</button>
  </section>
}
