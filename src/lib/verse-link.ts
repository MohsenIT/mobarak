export type VerseAddress = { s: number; a: number; pos: number }
const integer = (value: string | null | undefined, max: number) => {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null
}
export function readSurahNumber(search: string, pathname = '/'): number | null {
  const path = pathname.match(/^\/(?:s|surah)\/(\d+)(?:\/|$)/)
  return integer(path?.[1] ?? new URLSearchParams(search).get('s'), 114)
}
export function readPageNumber(search: string, pathname = '/'): number | null {
  const path = pathname.match(/^\/(?:p|page)\/(\d+)\/?$/)
  return integer(path?.[1] ?? new URLSearchParams(search).get('p'), 604)
}
export function readVerseAddress(search: string, pathname = '/'): VerseAddress | null {
  const path = pathname.match(/^\/(?:s|surah)\/(\d+)\/(?:a|ayah)\/(\d+)(?:\/(?:w|word)\/(\d+))?\/?$/)
  const q = new URLSearchParams(search)
  const s = integer(path?.[1] ?? q.get('s'), 114)
  const a = integer(path?.[2] ?? q.get('a'), 286)
  const pos = integer(path ? path[3] ?? '1' : q.get('w') ?? '1', 500)
  return s && a && pos ? { s, a, pos } : null
}
export function versePath({ s, a, pos }: VerseAddress): string {
  return `/s/${s}/a/${a}${pos > 1 ? `/w/${pos}` : ''}`
}
/** The refresh token is only for requesting a fresh document, never a reading address. */
export function readingUrl(current: string, mode: 'flow' | 'mushaf', surah: number, page: number, native = false): URL {
  const url = new URL(current)
  const target = readVerseAddress(url.search, url.pathname)
  for (const name of ['s', 'a', 'w', 'p', '_refresh']) url.searchParams.delete(name)
  url.pathname = native ? '/' : mode === 'mushaf' ? `/p/${page}` : target?.s === surah ? versePath(target) : `/s/${surah}`
  if (native) {
    url.searchParams.set(mode === 'flow' ? 's' : 'p', String(mode === 'flow' ? surah : page))
    if (mode === 'flow' && target?.s === surah) {
      url.searchParams.set('a', String(target.a))
      if (target.pos > 1) url.searchParams.set('w', String(target.pos))
    }
  }
  return url
}
export function writeVerseAddress(address: VerseAddress, replace = false) {
  const url = readingUrl(window.location.href, 'flow', address.s, 1, process.env.NEXT_PUBLIC_DESKTOP === '1')
  if (process.env.NEXT_PUBLIC_DESKTOP === '1') {
    url.searchParams.set('a', String(address.a))
    if (address.pos > 1) url.searchParams.set('w', String(address.pos))
    else url.searchParams.delete('w')
  } else url.pathname = versePath(address)
  if (url.href !== window.location.href) window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', url)
}
