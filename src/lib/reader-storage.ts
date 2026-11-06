/**
 * Reader preferences live in `localStorage` under the `mushaf.*` namespace.
 * Every read and write is best-effort: a browser with storage disabled must
 * still render the reader, so failures fall back to the supplied default.
 *
 * Never rename or repurpose a key — that silently resets real users'
 * settings. Add a new key for new data instead.
 */
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Reading still works without browser storage. */
  }
}
