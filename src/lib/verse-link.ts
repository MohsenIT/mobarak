export type VerseAddress = { s: number; a: number; pos: number }
export function readVerseAddress(search: string): VerseAddress | null {
  const q = new URLSearchParams(search)
  const s = Number(q.get('s')), a = Number(q.get('a')), pos = q.has('w') ? Number(q.get('w')) : 1
  return Number.isInteger(s) && s >= 1 && s <= 114 && Number.isInteger(a) && a >= 1 && a <= 286 && Number.isInteger(pos) && pos >= 1 && pos <= 500 ? { s, a, pos } : null
}
export function writeVerseAddress(address: VerseAddress, replace = false) {
  const url = new URL(window.location.href)
  url.searchParams.delete('p')
  url.searchParams.set('s', String(address.s))
  url.searchParams.set('a', String(address.a))
  if (address.pos > 1) url.searchParams.set('w', String(address.pos))
  else url.searchParams.delete('w')
  if (url.href !== window.location.href) window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', url)
}
