export default function StartupSplash({ leaving = false }: { leaving?: boolean }) {
  return <div className={`startup-splash${leaving ? ' startup-leaving' : ''}`} role="status" aria-label="در حال آماده‌سازی قرآن واژه">
    <p className="startup-bism font-quran">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
    <img className="startup-logo" src="/icons/app-logo-v3-maskable-512.png" width="512" height="512" alt="" />
    <h1>قرآن واژه</h1>
    <div className="startup-caption">
      <p className="startup-verse font-quran">قَدْ جَاءَكُمْ مِنَ اللَّهِ نُورٌ وَكِتَابٌ مُبِينٌ</p>
      <span className="chip" title="بخشی از آیهٔ ۱۵ سورهٔ مائده">مائده · ۱۵</span>
    </div>
  </div>
}
