// Static SVG masks reveal the selected logo; they do not delay app readiness.
const LOGO = `<svg class="growth-logo" viewBox="0 0 512 512" role="img" aria-label="نور از کتاب بالا می‌رود و سه گل لوگو می‌رویند"><defs><filter id="softGlow1"><feGaussianBlur stdDeviation="5"/></filter><mask id="grow-1" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><path class="book-reveal" fill="white" d="M45 385 78 348 99 307Q175 288 236 349L256 377 276 349Q342 286 413 308L448 351 469 389 256 457Z"/><path class="stem-reveal middle" d="M256 368V154"/><path class="stem-reveal left" d="M240 350Q234 276 166 236"/><path class="stem-reveal right" d="M274 350Q281 276 345 236"/><circle fill="black" cx="256" cy="117" r="48"/><circle fill="black" cx="135" cy="214" r="47"/><circle fill="black" cx="375" cy="214" r="47"/></mask></defs><circle class="disk" cx="256" cy="256" r="233"/><image href="/icons/logo-5-192.png" width="512" height="512" mask="url(#grow-1)"/><defs><clipPath id="flower-1-right"><circle cx="375" cy="214" r="47"/></clipPath></defs><g class="flower-reveal right" style="transform-box:view-box;transform-origin:375px 214px"><image href="/icons/logo-5-192.png" width="512" height="512" clip-path="url(#flower-1-right)"/></g><defs><clipPath id="flower-1-left"><circle cx="135" cy="214" r="47"/></clipPath></defs><g class="flower-reveal left" style="transform-box:view-box;transform-origin:135px 214px"><image href="/icons/logo-5-192.png" width="512" height="512" clip-path="url(#flower-1-left)"/></g><defs><clipPath id="flower-1-middle"><circle cx="256" cy="117" r="48"/></clipPath></defs><g class="flower-reveal middle" style="transform-box:view-box;transform-origin:256px 117px"><image href="/icons/logo-5-192.png" width="512" height="512" clip-path="url(#flower-1-middle)"/></g><ellipse class="origin-light" cx="256" cy="373" rx="45" ry="12"/><path class="light-stem" d="M256 368V117"/><path class="light-stem left" d="M240 350Q234 276 135 214"/><path class="light-stem right" d="M274 350Q281 276 375 214"/><circle class="bloom-light middle" cx="256" cy="117" r="49"/><circle class="bloom-light left" cx="135" cy="214" r="48"/><circle class="bloom-light right" cx="375" cy="214" r="48"/><image class="complete-logo" href="/icons/logo-5-192.png" width="512" height="512"/></svg>`

export default function StartupSplash() {
  return <div className="startup-splash" role="status" aria-label="در حال آماده‌سازی قرآن واژه">
    <p className="startup-bism font-quran">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
    <div className="startup-logo" aria-hidden="true">
      <span className="startup-halo" />
      <div dangerouslySetInnerHTML={{ __html: LOGO }} />
    </div>
    <h1>قرآن واژه</h1>
    <p className="startup-verse font-quran">قَدْ جَاءَكُمْ مِنَ اللَّهِ نُورٌ وَكِتَابٌ مُبِينٌ</p>
    <span className="chip" title="بخشی از آیهٔ ۱۵ سورهٔ مائده">مائده · ۱۵</span>
    <span className="startup-loading" aria-hidden="true"><i /><i /><i /></span>
  </div>
}
