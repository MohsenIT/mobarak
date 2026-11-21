'use client'

import { BookOpen, ScrollText, Type } from 'lucide-react'
import { t } from '@/lib/i18n'
import { toFa } from '@/lib/quran'
import { clampScale, MIN_SCALE, MAX_SCALE } from '@/lib/reader-settings'
import type { ReadingMode } from '@/lib/reading-route'
import { IconTranslate } from './Ornaments'

export interface ReaderDisplayProps {
  mode: ReadingMode
  onMode: (mode: ReadingMode) => void
  scale: number
  onScale: (scale: number) => void
}

/** Both placements use the reader's existing route and presentation owners. */
export default function ReaderDisplayControls({ mode, onMode, scale, onScale, translation }: ReaderDisplayProps & {
  translation?: { visible: boolean; onChange: (visible: boolean) => void }
}) {
  return <div className="reader-display-controls">
    <section>
      <h3><BookOpen size={20} aria-hidden="true" />{t('ui.88619bd189')}</h3>
      <div className="reader-display-modes" role="group" aria-label={t('ui.88619bd189')}>
        {(['flow', 'mushaf'] as const).map(item => <button key={item} type="button" aria-pressed={mode === item} onClick={() => onMode(item)}>
          {item === 'mushaf' ? <BookOpen size={19} aria-hidden="true" /> : <ScrollText size={19} aria-hidden="true" />}
          <span>{item === 'mushaf' ? t('ui.f7c7ba28bb') : t('ui.8fef24ffc4')}</span>
          {item === 'mushaf' && <sup className="reader-experimental-tag" style={{ fontSize: ".65em", lineHeight: 1, top: "auto", position: "static", transform: "translateY(-5px)" }} aria-hidden="true">{t('reader.experimental')}</sup>}
        </button>)}
      </div>
    </section>
    {translation && <section className="reader-display-translation">
      <span><IconTranslate size={22} />{t('ui.2d6258b160')}</span>
      <button type="button" className="reader-display-switch" role="switch" aria-label={t('ui.2d6258b160')} aria-checked={translation.visible} onClick={() => translation.onChange(!translation.visible)}><span /></button>
    </section>}
    <section>
      <h3><Type size={20} aria-hidden="true" />{t('ui.1fe7007e7e')}</h3>
      {translation ? <div className="reader-display-scale" dir="ltr">
        <button type="button" className="icon-btn" aria-label={t('ui.2e81f56c3d')} disabled={scale <= MIN_SCALE} onClick={() => onScale(clampScale(scale - .15))}><span className="reader-scale-small">A</span>−</button>
        <input type="range" min={MIN_SCALE} max={MAX_SCALE} step={.05} value={scale} aria-label={t('ui.1fe7007e7e')} aria-valuetext={`${toFa(Math.round(scale * 100))}٪`} onChange={event => onScale(clampScale(Number(event.target.value)))} />
        <button type="button" className="icon-btn" aria-label={t('ui.8b885c6faa')} disabled={scale >= MAX_SCALE} onClick={() => onScale(clampScale(scale + .15))}><span className="reader-scale-large">A</span>+</button>
      </div> : <div className="settings-scale">
        <button type="button" className="icon-btn" aria-label={t('ui.8b885c6faa')} disabled={scale >= MAX_SCALE} onClick={() => onScale(clampScale(scale + .15))}>+</button>
        <output>{toFa(Math.round(scale * 100))}٪</output>
        <button type="button" className="icon-btn" aria-label={t('ui.2e81f56c3d')} disabled={scale <= MIN_SCALE} onClick={() => onScale(clampScale(scale - .15))}>−</button>
      </div>}
    </section>
  </div>
}
