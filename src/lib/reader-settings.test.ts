import { expect, test } from 'bun:test'
import {
  DEFAULT_TRANSLATOR,
  MAX_SCALE,
  MIN_SCALE,
  RECENT_SURAHS_LIMIT,
  clampScale,
  rememberSurah,
  removeBookmark,
  resolveInitialTranslator,
  stepScale,
  togglePinnedSurah,
} from './reader-settings'

test('scale clamps to the range the UI exposes', () => {
  expect(clampScale(0.1)).toBe(MIN_SCALE)
  expect(clampScale(5)).toBe(MAX_SCALE)
  expect(clampScale(1)).toBe(1)
})

test('scale rounds to the nearest 5%', () => {
  expect(clampScale(1.03)).toBe(1.05)
  expect(clampScale(1.02)).toBe(1)
  expect(clampScale(1.08)).toBe(1.1)
})

test('a zoom step moves one 5% notch in the direction of the delta', () => {
  // Negative wheel delta zooms in, positive zooms out.
  expect(stepScale(1, -1)).toBe(1.1)
  expect(stepScale(1, 1)).toBe(0.9)
})

test('a zoom step cannot leave the range', () => {
  expect(stepScale(MAX_SCALE, -1)).toBe(MAX_SCALE)
  expect(stepScale(MIN_SCALE, 1)).toBe(MIN_SCALE)
})

test('a stored translator only counts when it is still a real one', () => {
  expect(resolveInitialTranslator('f', true)).toBe('f')
  expect(resolveInitialTranslator('not-a-translator', true)).toBe(DEFAULT_TRANSLATOR)
})

test('readers who never opted in to per-translation settings get the default', () => {
  // mushaf.safavi-default.v1 is the opt-in marker; without it a stored value
  // is stale from a build that did not have that setting.
  expect(resolveInitialTranslator('f', false)).toBe(DEFAULT_TRANSLATOR)
})

test('visiting a surah moves it to the front of the recent list', () => {
  expect(rememberSurah([2, 3], 1)).toEqual([1, 2, 3])
  expect(rememberSurah([1, 2, 3], 2)).toEqual([2, 1, 3])
})

test('the recent list is capped and duplicates never appear', () => {
  const full = Array.from({ length: RECENT_SURAHS_LIMIT }, (_, i) => i + 1)
  const next = rememberSurah(full, 114)
  expect(next).toHaveLength(RECENT_SURAHS_LIMIT)
  expect(next[0]).toBe(114)
  expect(new Set(next).size).toBe(next.length)
})

test('an invalid surah leaves the recent list untouched', () => {
  // This runs on every page load, so junk must not poison the list.
  expect(rememberSurah([1, 2], 0)).toEqual([1, 2])
  expect(rememberSurah([1, 2], 115)).toEqual([1, 2])
  expect(rememberSurah([1, 2], 1.5)).toEqual([1, 2])
})

test('junk entries already in the stored list are dropped on the next visit', () => {
  expect(rememberSurah([0, 2, 999], 1)).toEqual([1, 2])
})

test('pinning toggles and preserves insertion order', () => {
  expect(togglePinnedSurah([], 2)).toEqual([2])
  expect(togglePinnedSurah([2], 5)).toEqual([2, 5])
  expect(togglePinnedSurah([2, 5], 2)).toEqual([5])
})

test('removing a bookmark leaves the rest in order', () => {
  expect(removeBookmark([1, 4, 9], 4)).toEqual([1, 9])
  expect(removeBookmark([1, 4], 7)).toEqual([1, 4])
})
