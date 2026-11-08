/** Geometry from the supplied search-scope handoff SVGs, unchanged. */
export default function SearchScopeIcon({ scope }: { scope: 'surah' | 'quran' }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {scope === 'surah' ? <>
      <path d="M12 6.6 C9.4 5 6.6 4.6 2.8 5.3 V18.7 C6.6 18.1 9.4 18.35 12 20 C14.6 18.35 17.4 18.1 21.2 18.7 V5.3 C17.4 4.6 14.6 5 12 6.6 Z" />
      <path d="M12 6.6 V20" />
    </> : <>
      <path d="M12 3.8 C9.4 2.2 6.6 1.8 2.8 2.5 V14.3 C6.6 13.7 9.4 13.95 12 15.6 C14.6 13.95 17.4 13.7 21.2 14.3 V2.5 C17.4 1.8 14.6 2.2 12 3.8 Z" />
      <path d="M12 3.8 V15.6" />
      <path d="M2.8 17.0 C6.6 16.4 9.4 16.65 12 18.3 C14.6 16.65 17.4 16.4 21.2 17.0" />
      <path d="M2.8 19.7 C6.6 19.1 9.4 19.35 12 21.0 C14.6 19.35 17.4 19.1 21.2 19.7" />
    </>}
  </svg>
}
