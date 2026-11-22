import { expect, test } from 'bun:test'
import meta from '../../public/data/meta.json'
import { readStored, writeStored } from './reader-storage'
import { readSurahPosition, rememberSurahPosition, SURAH_POSITIONS_KEY } from './surah-position'

const taha = { s: 20, a: 40, pos: 2, mode: 'flow' as const }
const baqara = { s: 2, a: 255, pos: 1, mode: 'mushaf' as const }

test('remembers different positions per surah across serialization', () => {
  const positions = rememberSurahPosition(rememberSurahPosition({}, taha), baqara)
  const stored: unknown = JSON.parse(JSON.stringify(positions))
  expect(readSurahPosition(stored, 20, meta.surahs[19].vc)).toEqual(taha)
  expect(readSurahPosition(stored, 2, meta.surahs[1].vc)).toEqual(baqara)
  expect(rememberSurahPosition(positions, { ...taha })).toBe(positions)
  expect(readSurahPosition(stored, 1, meta.surahs[0].vc)).toBeNull()
})

test('missing and invalid entries safely fall back without touching pinned or recent surahs', () => {
  for (const stored of [null, 4, [20, 2], { 20: { ...taha, a: 136 } }, { 20: { ...taha, pos: 0 } }, { 20: { ...taha, s: 2 } }, { 20: { ...taha, mode: 'unknown' } }]) {
    expect(readSurahPosition(stored, 20, 135)).toBeNull()
  }
  expect(() => writeStored(SURAH_POSITIONS_KEY, { 20: taha })).not.toThrow()
  expect(readSurahPosition(readStored(SURAH_POSITIONS_KEY, {}), 20, 135)).toBeNull()
})
