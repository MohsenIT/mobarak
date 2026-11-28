'use client'

import { useState } from 'react'
import { Globe, Heart } from 'lucide-react'
import { STARTUP_TRANSLATION_EMPHASIS, STARTUP_VERSE, STARTUP_VERSE_TRANSLATION } from '@/lib/branding'
import { t } from '@/lib/i18n'

function emphasize(text: string, phrases: readonly string[]) {
  return text.split(new RegExp(`(${phrases.join('|')})`, 'u')).map((part, index) =>
    phrases.includes(part) ? <strong key={index}>{part}</strong> : part
  )
}

export default function AboutMobarak() {
  const [supportOpen, setSupportOpen] = useState(false)
  return <div className="about-mobarak">
    {/* Use the same bundled brand mark as the drawer header. */}
    <img src="/icons/logo-5-192.png" width="64" height="64" alt="" />
    <h3>{t('about.brand')}</h3>
    <p className="about-subtitle">{t('about.subtitle')}</p>
    <div className="about-meaning">
      <p className="about-verse font-quran" lang="ar" dir="rtl">
        {emphasize(STARTUP_VERSE, ['مُبَارَكٌ', 'لِيَدَّبَّرُوا', 'وَلِيَتَذَكَّرَ'])}{' '}
        <span className="about-reference">({t('about.reference')})</span>
      </p>
      <p className="about-translation" lang="fa" dir="rtl">{emphasize(STARTUP_VERSE_TRANSLATION, STARTUP_TRANSLATION_EMPHASIS)}</p>
      <p className="about-caption">{t('about.message')}</p>
    </div>
    <p className="about-caption about-identity">{t('about.identity')}</p>
    <div className="about-links">
      <a className="chip" href="https://mobarak.app" target="_blank" rel="noreferrer"><Globe size={16} aria-hidden="true" /><bdi>mobarak.app</bdi></a>
      <a className="chip" href="https://github.com/MohsenIT/mobarak" target="_blank" rel="noreferrer">GitHub</a>
    </div>
    <button type="button" className="about-support" aria-expanded={supportOpen} aria-controls="about-support-note" onClick={() => setSupportOpen(!supportOpen)}>
      <Heart size={16} aria-hidden="true" />{t('about.support')}
    </button>
    <p id="about-support-note" className="about-caption" hidden={!supportOpen}>{t('about.supportPending')}</p>
  </div>
}
