import { APP_NAME, STARTUP_VERSE, STARTUP_VERSE_REFERENCE } from '@/lib/branding'

export default function StartupSplash({ leaving = false }: { leaving?: boolean }) {
  return <div className={`startup-splash${leaving ? ' startup-leaving' : ''}`} role="status" aria-label={`در حال آماده‌سازی ${APP_NAME}`}>
    <p className="startup-bism font-quran" lang="ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
    <img className="startup-logo" src="/icons/app-logo-v3-maskable-512.png" width="512" height="512" alt="" />
    <h1>{APP_NAME}</h1>
    <div className="startup-caption">
      <p className="startup-verse font-quran" lang="ar">{STARTUP_VERSE.split(' ').map((word, index) => <span key={index}>{index > 0 && ' '}{['مُبَارَكٌ', "لِيَدَّبَّرُوا", 'وَلِيَتَذَكَّرَ'].includes(word) ? <strong>{word}</strong> : word}</span>)}</p>
      <span className="chip" title="آیهٔ ۲۹ سورهٔ ص">{STARTUP_VERSE_REFERENCE}</span>
    </div>
  </div>
}
