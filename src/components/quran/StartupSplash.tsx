import { APP_NAME, STARTUP_VERSE, STARTUP_VERSE_REFERENCE, STARTUP_VERSE_TRANSLATION } from '@/lib/branding'

export default function StartupSplash({ leaving = false, onHoldChange }: { leaving?: boolean; onHoldChange: (held: boolean) => void }) {
  return <div className={`startup-splash${leaving ? ' startup-leaving' : ''}`} onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      onHoldChange(true)
    }}
    onPointerUp={() => onHoldChange(false)} onPointerCancel={() => onHoldChange(false)}
    onLostPointerCapture={event => { if (event.target === event.currentTarget) onHoldChange(false) }} onContextMenu={event => event.preventDefault()}
    role="status" aria-label={`در حال آماده‌سازی ${APP_NAME}`}>
    <p className="startup-bism font-quran" lang="ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
    <img draggable={false} className="startup-logo" src="/icons/app-logo-v3-maskable-512.png" width="512" height="512" alt="" />
    <h1>{APP_NAME}</h1>
    <div className="startup-caption">
      <p className="startup-verse font-quran" lang="ar">{STARTUP_VERSE.split(' ').map((word, index) => <span key={index}>{index > 0 && ' '}{['مُبَارَكٌ', "لِيَدَّبَّرُوا", 'وَلِيَتَذَكَّرَ'].includes(word) ? <strong>{word}</strong> : word}</span>)}</p>
      <p className="startup-translation" lang="fa">{STARTUP_VERSE_TRANSLATION.split(/(مبارک|تدبر کنند|متذکر شوند)/g).map((part, i) => ['مبارک', 'تدبر کنند', 'متذکر شوند'].includes(part) ? <strong key={i}>{part}</strong> : part)}</p>
      <span className="chip" title="آیهٔ ۲۹ سورهٔ ص">{STARTUP_VERSE_REFERENCE}</span>
    </div>
  </div>
}
