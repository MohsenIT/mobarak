'use client'

import { useState } from 'react'
import { Settings, X } from 'lucide-react'
import { t } from '@/lib/i18n'
import type { Meta, Translator } from '@/lib/quran'
import { AppearanceColors } from './Appearance'
import LanguageSettings from './LanguageSettings'
import CalendarSettings from './CalendarSettings'
import CopyFormatSettings from './CopyFormatSettings'
import ReadingScreenSettings from './ReadingScreen'
import UpdateSettings from './UpdateSettings'
import OfflineSettings from './OfflineSettings'
import DownloadsManager from './DownloadsManager'
import { IconBook, IconMoon, IconSun } from './Ornaments'
import { toFa } from '@/lib/quran'

type Tab = 'appearance' | 'language' | 'downloads' | 'about'

interface Props {
  meta: Meta
  theme: 'paper' | 'night'
  onTheme: (theme: 'paper' | 'night') => void
  translator: Translator
  onTranslator: (translator: Translator) => void
  scale: number
  onScale: (scale: number) => void
  onClose: () => void
}

export default function SettingsScreen({ meta, theme, onTheme, translator, onTranslator, scale, onScale, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('appearance')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'appearance', label: t('appearance.title') },
    { id: 'language', label: t('language.settings') },
    { id: 'downloads', label: t('downloads.manage') },
    { id: 'about', label: t('about.title') },
  ]
  return <section className="settings-screen" role="dialog" aria-modal="true" aria-label={t('ui.6badcac8c1')} dir="rtl">
    <header className="settings-screen-header">
      <h2><Settings size={22} aria-hidden="true" />{t('ui.6badcac8c1')}</h2>
      <button type="button" className="icon-btn" onClick={onClose} aria-label={t('ui.313cbecb4d')}><X size={22} /></button>
    </header>
    <nav className="settings-screen-tabs" aria-label={t('ui.6badcac8c1')}>
      {tabs.map(item => <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}
    </nav>
    <div className="settings-screen-content nice-scroll">
      {tab === 'appearance' && <div className="settings-stack">
        <section><h3><>{theme === 'night' ? <IconMoon /> : <IconSun />}</>{t('ui.90ec529f45')}</h3><div className="settings-theme-choices">
          {(['paper', 'night'] as const).map(item => <button key={item} type="button" aria-pressed={theme === item} onClick={() => onTheme(item)}>{item === 'paper' ? t('ui.a97a005a42') : t('ui.95b1ddc4a1')}</button>)}
        </div></section>
        <AppearanceColors />
        <section><h3><IconBook />{t('ui.1fe7007e7e')}</h3><div className="settings-scale"><button type="button" className="icon-btn" aria-label={t('ui.8b885c6faa')} disabled={scale >= 1.9} onClick={() => onScale(Math.round(Math.min(1.9, scale + .15) * 20) / 20)}>+</button><output>{toFa(Math.round(scale * 100))}٪</output><button type="button" className="icon-btn" aria-label={t('ui.2e81f56c3d')} disabled={scale <= .55} onClick={() => onScale(Math.round(Math.max(.55, scale - .15) * 20) / 20)}>−</button></div></section>
        <ReadingScreenSettings />
      </div>}
      {tab === 'language' && <div className="settings-stack"><LanguageSettings translator={translator} onTranslation={onTranslator} /><CalendarSettings /><CopyFormatSettings /></div>}
      {tab === 'downloads' && <div className="settings-stack"><DownloadsManager meta={meta} /><OfflineSettings /></div>}
      {tab === 'about' && <div className="settings-stack"><UpdateSettings /></div>}
    </div>
  </section>
}
