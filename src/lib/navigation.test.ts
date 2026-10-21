import { expect, test } from 'bun:test'
import rawMeta from '../../public/data/meta.json'
import type { Meta } from './quran'
import { searchSurahs, resolveDestination } from './navigation'
const meta: Meta = { ...rawMeta, juz: Object.fromEntries(Object.entries(rawMeta.juz).map(([key, [s, a]]) => [key, [s, a] as [number, number]])) }

test('surah search accepts Arabic names, diacritics and both digit sets', () => {
  for (const query of ['بقره', 'الْبَقَرَة', '۲', '٢']) expect(searchSurahs(meta, query).some(s => s.n === 2)).toBe(true)
  expect(resolveDestination(meta, 'surah', 'طه', 1)).toEqual({ kind: 'surah', s: 20 })
  expect(resolveDestination(meta, 'surah', 'نام ناموجود', 1)).toBeNull()
})
test('page and juz destinations are bounded and use the actual juz boundary', () => {
  expect(resolveDestination(meta, 'page', '۶۰۴', 1)).toEqual({ kind: 'page', p: 604 })
  for (const value of ['0', '605', '1.5']) expect(resolveDestination(meta, 'page', value, 1)).toBeNull()
  const [s, a] = meta.juz['2']
  expect(resolveDestination(meta, 'juz', '٢', 1)).toEqual({ kind: 'verse', s, a })
  expect(resolveDestination(meta, 'juz', '31', 1)).toBeNull()
})
test('verse jumps support current surah, named references and explicit prefixes', () => {
  expect(resolveDestination(meta, 'verse', '۱۱', 20)).toEqual({ kind: 'verse', s: 20, a: 11 })
  expect(resolveDestination(meta, 'verse', 'بقره:۲۵۵', 20)).toEqual({ kind: 'verse', s: 2, a: 255 })
  expect(resolveDestination(meta, 'surah', 'آیه طه:۱۱', 1)).toEqual({ kind: 'verse', s: 20, a: 11 })
  expect(resolveDestination(meta, 'surah', 'صفحه ۵۰', 1)).toEqual({ kind: 'page', p: 50 })
  for (const value of ['طه:136', 'طه:0', '20:1:2', '']) expect(resolveDestination(meta, 'verse', value, 20)).toBeNull()
})

test('one navigation field suggests named surahs, explicit references and numeric alternatives', async () => {
  const { destinationSuggestions } = await import('./navigation')
  expect(destinationSuggestions(meta, 'طه', 2)[0].destination).toEqual({ kind: 'surah', s: 20 })
  expect(destinationSuggestions(meta, 'ق', 2)[0].destination).toEqual({ kind: 'surah', s: 50 })
  expect(destinationSuggestions(meta, '۲۰:۱۴', 2)[0].destination).toEqual({ kind: 'verse', s: 20, a: 14 })
  expect(destinationSuggestions(meta, 'صفحه ۵۰', 20)[0].destination).toEqual({ kind: 'page', p: 50 })
  const alternatives = destinationSuggestions(meta, '۲۰', 20)
  expect(alternatives.map(item => item.destination.kind)).toContain('surah')
  expect(alternatives.map(item => item.destination.kind)).toContain('page')
  expect(alternatives.some(item => item.destination.kind === 'verse' && item.destination.s === 20 && item.destination.a === 20)).toBe(true)
  expect(destinationSuggestions(meta, '۹۹۹', 20)).toEqual([])
})
