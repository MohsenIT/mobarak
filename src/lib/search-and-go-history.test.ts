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
