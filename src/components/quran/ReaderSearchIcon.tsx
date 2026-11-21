export default function ReaderSearchIcon({ quick = false }: { quick?: boolean }) {
  if (quick) return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="3.25" /><path d="m13.5 13.5 2.5 2.5" />
  </svg>

  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5.5C9 3.5 5 3.5 2 4.5V20c3-1 7-1 10 1V5.5C15 3.5 19 3.5 22 4.5V12" />
    <circle cx="17.5" cy="17.5" r="3.25" />
    <path d="m20 20 2.5 2.5" />
  </svg>
}
