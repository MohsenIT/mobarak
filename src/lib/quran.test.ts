/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test'
import { compareRootRange, morphologyLabel, type SurahData } from './quran'
import { readFileSync } from 'node:fs'

const fixture: SurahData = {
  n: 1, ar: '', fa: '', vc: 3,
  v: [
    { n: 1, p: 1, j: 1, w: [{ l: null, t: 'a' }, { l: null, t: 'b' }] },
    { n: 2, p: 1, j: 1, w: [{ l: null, t: 'c' }, { l: null, t: 'd' }] },
    { n: 3, p: 1, j: 1, w: [{ l: null, t: 'e' }, { l: null, t: 'f' }] },
  ],
  ri: { shared: [[1, 1], [1, 2], [3, 1]], within: [[1, 1]], outside: [[2, 1]] },
}
const global = { shared: { '1': 3 }, within: { '1': 1 }, outside: { '1': 1 } }

describe('range comparison', () => {
  test('counts words on each side, excludes roots present on only one side', () => {
    const result = compareRootRange(fixture, global, 1, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ root: 'shared', inside: 2, outside: 1, insideAyahs: [1], outsideAyahs: [3] })
    expect(result[0].connection).toBeGreaterThan(0)
    expect(result[0].connection).toBeLessThanOrEqual(1)
  })
  test('rejects empty complements and invalid ranges', () => {
    for (const [from, to] of [[1, 3], [0, 1], [2, 1], [1, 4], [1.5, 2], [NaN, 1]]) {
      expect(compareRootRange(fixture, global, from, to)).toEqual([])
    }
  })
  test('swapping complementary sections preserves connection strength', () => {
    const left = compareRootRange(fixture, global, 1, 1)[0]
    const right = compareRootRange(fixture, global, 2, 3)[0]
    expect(left.connection).toBeCloseTo(right.connection, 10)
    expect(left.inside).toBe(right.outside)
  })
  test('real Maryam results have accurate disjoint occurrences and descending scores', () => {
    const surah = JSON.parse(readFileSync('public/data/surah/19.json', 'utf8'))
    const roots = JSON.parse(readFileSync('public/data/roots.json', 'utf8'))
    const rows = compareRootRange(surah, roots, 1, 15)
    expect(rows.length).toBeGreaterThan(0)
    rows.forEach((row, i) => {
      expect(row.inside + row.outside).toBe(surah.ri[row.root].length)
      expect(row.insideAyahs.every(a => a >= 1 && a <= 15)).toBe(true)
      expect(row.outsideAyahs.every(a => a > 15)).toBe(true)
      if (i) expect(rows[i - 1].connection).toBeGreaterThanOrEqual(row.connection)
    })
  })
})

test('morphology is per-word: علم contains both plain and intensified forms', () => {
  const surah = JSON.parse(readFileSync('public/data/surah/2.json', 'utf8')) as SurahData
  expect(surah.v[30].w.find(w => w.r === 'علم')?.form).toBe('II') // 2:31 عَلَّمَ
  expect(surah.v[29].w.filter(w => w.r === 'علم').some(w => w.form === 'I')).toBe(true)
  expect(morphologyLabel('II')).toBe('تفعیل')
  expect(morphologyLabel('V')).toBe('تفعّل')
  expect(morphologyLabel('X')).toBe('استفعال')
})
