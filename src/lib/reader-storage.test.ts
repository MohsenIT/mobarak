import { expect, test } from 'bun:test'
import { readStored, writeStored } from './reader-storage'

/** A minimal in-memory `localStorage` so this can run without a DOM. */
function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    value: (key: string) => data.get(key),
  }
}

function withStorage<T>(store: ReturnType<typeof storage>, run: () => T): T {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true })
  try {
    return run()
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
}

test('a stored preference round-trips through JSON', () => {
  const store = storage({ 'mushaf.page': '42', 'mushaf.marks': '[1,2,3]' })
  withStorage(store, () => {
    expect(readStored('mushaf.page', 1)).toBe(42)
    expect(readStored<number[]>('mushaf.marks', [])).toEqual([1, 2, 3])
    writeStored('mushaf.mode', 'mushaf')
    expect(store.value('mushaf.mode')).toBe('"mushaf"')
  })
})

test('a missing key falls back to the supplied default', () => {
  withStorage(storage(), () => {
    expect(readStored('mushaf.theme', 'paper')).toBe('paper')
    expect(readStored('mushaf.marks', [])).toEqual([])
  })
})

test('unreadable or unavailable storage degrades to the default instead of throwing', () => {
  withStorage(storage({ 'mushaf.page': 'not json' }), () => {
    expect(readStored('mushaf.page', 1)).toBe(1)
    expect(() => writeStored('mushaf.page', 7)).not.toThrow()
  })
  // No `localStorage` at all (server rendering, hardened browser).
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Reflect.deleteProperty(globalThis, 'localStorage')
  try {
    expect(readStored('mushaf.page', 1)).toBe(1)
    expect(() => writeStored('mushaf.page', 7)).not.toThrow()
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
  }
})
