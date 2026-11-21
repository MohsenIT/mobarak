function Magnifier() {
  return <>
    <circle cx="17.5" cy="17.5" r="3.25" />
    <path d="m20 20 2.5 2.5" />
  </>
}

export default function ReaderSearchIcon({ quick = false }: { quick?: boolean }) {
  return <svg width="24" height="24" viewBox={quick ? '12 12 13 13' : '0 0 24 24'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {!quick && <path d="M12 5.5C9 3.5 5 3.5 2 4.5V20c3-1 7-1 10 1V5.5C15 3.5 19 3.5 22 4.5V12" />}
    <Magnifier />
  </svg>
}
