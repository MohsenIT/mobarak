import readerArabic from '../../../public/data/reader-arabic.json'
import {t} from '@/lib/i18n'
import { toFa, type SurahMeta } from '@/lib/quran'

export function AyahMarker({ n }: { n: number }) {
  return <span className="ayah-marker" aria-hidden><span>{toFa(n)}</span></span>
}

function RevelationIcon({ makki }: { makki: boolean }) {
  return makki ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7 13 3l8 4v13l-10 3-8-4Z" /><path d="m3 7 8 4 10-4M11 11v12M3 11l8 4 10-4" /><path d="M6 15v4l2 1v-4Z" fill="currentColor" stroke="none" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 16v-2c0-3 4-4 5-7 1 3 5 4 5 7v2Z" fill="currentColor" fillOpacity=".18" /><path d="M7 16h12v5H7Zm6 1v4M3 21V8l1-4 1 4v13M2 21h20M3 10h2M13 4V3" />
    </svg>
  )
}

export function SurahBand({ sm, onNavigate }: { sm: SurahMeta; onNavigate?: () => void }) {
  const Tag = onNavigate ? 'button' : 'div'
  const revelation = sm.rev === 'makkah' ? t("ui.039e791597") : sm.rev === 'madinah' ? t("ui.40f14b2806") : null
  return (
    <Tag onClick={onNavigate} type={onNavigate ? 'button' : undefined} className="surah-band" dir="rtl" role={onNavigate ? undefined : 'group'} aria-label={t("ui.5953d591c3",{p0:(sm.ar),p1:(toFa(sm.n)),p2:(toFa(sm.vc)),p3:(revelation ? `، ${revelation}` : '')})}>
      <span className="band-side">
        <span className="band-meta band-number">{t("ui.53376bea8f")}{' '}{toFa(sm.n)}</span>
        <span className="band-line" />
      </span>
      <span className="band-name">
        {revelation && <span className="band-revelation" title={t("ui.0eb0a3f03f",{p0:(revelation)})} aria-label={revelation}><RevelationIcon makki={sm.rev === 'makkah'} /></span>}
        <span className="band-title" lang="ar" dir="rtl">{readerArabic.surahLabel}{' '}{sm.ar}</span>
      </span>
      <span className="band-side">
        <span className="band-meta band-info">{toFa(sm.vc)}{' '}{t("ui.b1b168c791")}</span>
        <span className="band-line" />
      </span>
    </Tag>
  )
}

export function Bismillah({ size = '1em' }: { size?: string }) {
  return (
    <div className="bismillah-line" lang="ar" dir="rtl" style={{ fontSize: size }}>{readerArabic.bismillah}</div>
  )
}

/** faint 8-point star lattice */
export function PatternBG() {
  return (
    <svg className="app-pattern" width="100%" height="100%" aria-hidden>
      <defs>
        <pattern id="lattice" width="96" height="96" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="var(--ink)" strokeOpacity="0.05" strokeWidth="1">
            <path d="M48 8 L60 36 L88 48 L60 60 L48 88 L36 60 L8 48 L36 36 Z" />
            <circle cx="48" cy="48" r="10" />
            <path d="M0 0 L24 24 M96 0 L72 24 M0 96 L24 72 M96 96 L72 72" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#lattice)" />
    </svg>
  )
}

/* ---------- hand-drawn inline SVG icons (24px, stroke) ---------- */
const I = ({ children, size = 22 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
)

export const IconMenu = () => <I><path d="M4 7h16M4 12h10M4 17h16" /></I>
export const IconClose = () => <I><path d="M6 6l12 12M18 6L6 18" /></I>
export const IconSearch = () => <I><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></I>
export const IconMoon = () => <I><path d="M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5Z" /></I>
export const IconSun = () => <I><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4L19 19M19 5l-1.6 1.6M6.6 17.4L5 19" /></I>
export const IconStar = ({ filled }: { filled?: boolean }) => (
  <I><path d="M12 3.6l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.4 6.9 19l1.1-5.6L3.8 9.5l5.7-.7Z"
    fill={filled ? 'currentColor' : 'none'} /></I>
)
export const IconChevronL = () => <I><path d="M14 6l-6 6 6 6" /></I>
export const IconChevronR = () => <I><path d="M10 6l6 6-6 6" /></I>
export const IconBook = () => <I><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5V5.5M20 18v3H6.5" /></I>
export const IconType = () => <I><path d="M5 7V5h14v2M12 5v14M9.5 19h5" /></I>
// User-supplied vector artwork: preserve the outlines and relative letter proportions.
export const IconTranslate = ({size=22}:{size?:number}) => <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" stroke="none" aria-hidden="true" focusable="false"><path d="m239.7 208.8l2.5-41.4q-8.7-0.6-14.6-0.8-5.6-0.5-12.9-0.5-14.8 0-29.2 1.4-14.2 1.2-32.8 3.6-4.4-3.9-9.4-9.1-4.7-5.3-8-12-3.3-6.9-3.3-15.5 0-17.1 12.6-26.8 12.9-9.8 29.2-9.8 12.6 0 24.9 4.9 12.7 4.7 26.3 12.8l15.9-35.6q-17.9-12.5-35.5-19.1-17.3-6.7-34.2-6.7-21 0-39.4 10.9-18.1 10.6-29.4 28.3-11.1 17.6-11.1 38.4 0 10.2 2.1 19.5 2.3 9 6.7 17.6 4.6 8.3 11.4 16.3-21.6 11.9-35.3 27.4-13.4 15.3-19.8 33.7-6.2 18-6.2 38.6 0 27.5 9.8 47.2 10 19.4 27.1 31.9 17.2 12.1 39 17.9 21.9 5.8 45.9 5.8 22.9 0 46.2-4.8 23.4-5 44-13.9l-11.4-40.4q-17.9 7.2-38.7 11.9-20.6 4.3-42.5 4.3-21 0-39.3-6-18.2-6.3-29.6-19.7-11.1-13.7-11.1-35.8 0-18.5 8.2-32.4 8.5-14 24.9-23.4 16.4-9.6 40.5-14.3 24.3-4.7 56-4.7 4.4 0 8.8 0.1 4.4-0.1 11.7 0.2z"/><path d="m371.7 221.4l-3.3 37.1-83.2 241.1h-50.3l104.6-278.2zm116.7 278.2h-50.5l-83.4-241.1-3.6-37.1h32.4zm-205.8-103.3h151.3v38.1h-151.3z"/></svg>
export const IconRoot = () => <I><circle cx="12" cy="5" r="2.2" /><path d="M12 7.5V12M12 12l-5 4.5M12 12l5 4.5M7 16.5c-1.5 2-2 4.5-2 4.5M17 16.5c1.5 2 2 4.5 2 4.5" /></I>

/** Maximize (square with corner arrows) — for the half-page panel expand button */
export const IconMaximize = () => (
  <I><path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" /></I>
)
/** Restore (two overlapping squares) — for the panel "back to half" button */
export const IconRestore = () => (
  <I><path d="M9 9h8v8H9z" /><path d="M7 7v8a1 1 0 0 0 1 1h8" /></I>
)

/** Sorted index icon — three horizontal bars of different widths (ranked list) */
export const IconSortIndex = () => (
  <I><path d="M4 6h16M4 12h11M4 18h7" /></I>
)

/** Info icon — for the small "what are these marks" tooltip */
export const IconInfo = () => (
  <I><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></I>
)
