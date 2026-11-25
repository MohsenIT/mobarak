import { expect, test } from 'bun:test'
import source from '../../public/data/meta.json'
import type { Meta } from './quran'
import { filterScopeSurahs, scopeSurahs } from './search-scope'

const meta = source as unknown as Meta

test('scope lists use real surahs and preserve selected surahs with zero results', () => {
  expect(filterScopeSurahs(meta, '', [])).toHaveLength(114)
  expect(filterScopeSurahs(meta, '', [114], { 2: 4, 20: 9, 4: 4 }).map(s => s.n)).toEqual([20, 2, 4, 114])
  expect(scopeSurahs(meta, 20, 'meccan', []).length + scopeSurahs(meta, 20, 'medinan', []).length).toBe(114)
})

test('surah lookup accepts equivalent spellings and localized numbers', () => {
  expect(filterScopeSurahs(meta, 'آل عِمران', []).map(s => s.n)).toEqual([3])
  for (const value of ['۱۱۴', '١١٤', '114']) {
    expect(filterScopeSurahs(meta, value, []).map(s => s.n)).toEqual([114])
  }
})
