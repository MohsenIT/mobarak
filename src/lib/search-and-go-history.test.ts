import { expect, test } from 'bun:test'
import rawMeta from '../../public/data/meta.json'
import type { Meta } from './quran'
import { readSearchLink } from './search-link'
import { rememberOperation, readOperationHistory, toggleOperationPin, textSearchOperation, type SearchOperation } from './search-and-go-history'

const meta: Meta = {
  ...rawMeta,
  juz: Object.fromEntries(Object.entries(rawMeta.juz).map(([key, [s, a]]) => [key, [s, a] as [number, number]])),
}
const taha: SearchOperation = { type: 'navigation', destination: { kind: 'verse', s: 20, a: 40 } }
const text = textSearchOperation(readSearchLink('/q?q=علم&p=0')!)!

test('executions deduplicate, keep pins and order newest first after reload', () => {
  let history = rememberOperation([], taha, 10)
  history = toggleOperationPin(history, history[0].id)
  history = rememberOperation(history, text, 20)
  history = rememberOperation(history, taha, 30)
  expect(history.map(entry => [entry.operation.type, entry.time, entry.pinned])).toEqual([
    ['navigation', 30, true], ['text', 20, false],
  ])
  expect(readOperationHistory(meta, JSON.parse(JSON.stringify(history)))).toEqual(history)
  expect(toggleOperationPin(history, history[0].id)[0].pinned).toBe(false)
})

test('untrusted storage cannot replay invalid targets, non-search links or empty searches', () => {
  const invalid: SearchOperation[] = [
    { type: 'navigation', destination: { kind: 'verse', s: 20, a: 136 } },
    { type: 'navigation', destination: { kind: 'page', p: 605 } },
    { type: 'navigation', destination: { kind: 'context', s: 20, index: 6, from: 3, to: 4 } },
    { type: 'text', link: '/q' },
    { type: 'text', link: '//invalid.example/q?q=علم' },
    { type: 'text', link: '/q?q=علم&m=r' },
  ]
  expect(readOperationHistory(meta, invalid.map(operation => ({ time: 10, operation, pinned: true })))).toEqual([])
  expect(readOperationHistory(meta, [20, null, 'legacy'])).toEqual([])
})

test('recent operations are bounded without evicting pinned operations', () => {
  let history = rememberOperation([], taha, 1)
  history = toggleOperationPin(history, history[0].id)
  for (let p = 1; p <= 15; p++) history = rememberOperation(history, { type: 'navigation', destination: { kind: 'page', p } }, p + 1)
  expect(history.length).toBe(13)
  expect(history[0].operation).toEqual({ type: 'navigation', destination: { kind: 'page', p: 15 } })
  expect(history.at(-1)?.pinned).toBe(true)
})

test('phase 2 replay preserves explicitly chosen lemma, root, scope and occurrence', () => {
  for (const url of ['/q?q=علم&m=r&s=20&h=0', '/q?q=علم&m=l&s=20&h=0', '/q?o=f.20.1.1&w=طه&f=II']) {
    const state = readSearchLink(url)!
    const operation = textSearchOperation(state, true)!
    if (operation.type !== 'text') throw new Error('Expected search operation')
    expect(readSearchLink(operation.link)).toEqual(state)
    const history = rememberOperation([], operation, 10)
    expect(readOperationHistory(meta, history, true)).toEqual(history)
    expect(readOperationHistory(meta, history)).toEqual([])
  }
})

const searchOperation = (query: string, filters = '') =>
  textSearchOperation(readSearchLink(`/q?q=${encodeURIComponent(query)}${filters}`)!, true)!

test('live history retains the complete phrase through pauses and deletions', () => {
  const main = searchOperation('فتح و نصر')
  let history = rememberOperation([], searchOperation('فتح و نص'), 10, 'live')
  history = rememberOperation(history, main, 20, 'live')
  history = rememberOperation(history, searchOperation('فتح'), 30, 'live')
  expect(history.map(entry => entry.operation)).toEqual([main])
  expect(readOperationHistory(meta, history, true)).toEqual(history)
})

test('confirmation outranks unfinished edits while confirmed searches, pins and search scopes stay distinct', () => {
  const original = searchOperation('فتح')
  const related = searchOperation('فتح و نصر')
  let history = rememberOperation([], original, 10)
  history = rememberOperation(history, related, 20, 'live')
  expect(history.map(entry => entry.operation)).toEqual([original])
  history = rememberOperation(history, related, 30)
  expect(history.map(entry => entry.operation)).toEqual([related, original])
  history = toggleOperationPin(history, history[0].id)
  const scoped = searchOperation('فتح و نص', '&scope=single&s=48')
  history = rememberOperation(history, scoped, 40, 'live')
  expect(history.map(entry => entry.operation)).toEqual([scoped, related, original])
  expect(history[1].pinned).toBe(true)
})

test('a short edit does not merge different completed phrases that share a prefix', () => {
  const first = searchOperation('فتح مبین')
  const second = searchOperation('فتح و نصر')
  let history = rememberOperation([], first, 10, 'live')
  history = rememberOperation(history, second, 20, 'live')
  history = rememberOperation(history, searchOperation('فتح'), 30, 'live')
  expect(history.map(entry => entry.operation)).toEqual([second, first])
})

test('a recent typo at the end of a phrase groups without collapsing quoted or older searches', () => {
  const typo = searchOperation('فتح الارص')
  const corrected = searchOperation('فتح الارض')
  const quoted = searchOperation('«فتح الارض»')
  let history = rememberOperation([], typo, 10, 'live')
  history = rememberOperation(history, corrected, 20)
  history = rememberOperation(history, quoted, 30, 'live')
  history = rememberOperation(history, searchOperation('فتح'), 400_000, 'live')
  expect(history.map(entry => entry.operation)).toEqual([searchOperation('فتح'), quoted, corrected])
})


test('Boolean, distance, and explicit marks remain distinct in history', () => {
  const queries = ['صبر نصر', 'صبر | نصر', 'صبر ...{0,2} نصر', 'صبر ...{0,3} نصر', 'ذِكر', 'ذَكر']
  const entries = queries.reduce<ReturnType<typeof rememberOperation>>((history, query, i) =>
    rememberOperation(history, searchOperation(query), i * 1000, 'live'), [])
  expect(entries.map(entry => entry.operation)).toEqual(queries.reverse().map(query => searchOperation(query)))
})
