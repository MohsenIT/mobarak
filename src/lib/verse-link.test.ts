import { expect, test } from 'bun:test'
import { readVerseAddress, readingUrl, versePath, readSurahNumber, readPageNumber } from './verse-link'
test('verse links accept surah, verse and optional word', () => {
  expect(readVerseAddress('?s=20&a=47')).toEqual({s:20,a:47,pos:1})
  expect(readVerseAddress('?s=20&a=47&w=3')).toEqual({s:20,a:47,pos:3})
  for (const value of ['?s=115&a=1','?s=20&a=0','?s=20&a=1.5','?s=20&a=1&w=0','?s=20','?p=42']) expect(readVerseAddress(value)).toBeNull()
})

test('readable verse paths and legacy query links identify the same word', () => {
  expect(readVerseAddress('', '/surah/20/ayah/7/word/6')).toEqual({s:20,a:7,pos:6})
  expect(readVerseAddress('', '/surah/20/ayah/7')).toEqual({s:20,a:7,pos:1})
  expect(readVerseAddress('?s=20&_refresh=1792648533116&a=7&w=6')).toEqual({s:20,a:7,pos:6})
  expect(readVerseAddress('', '/surah/115/ayah/7')).toBeNull()
})

test('canonical reading links consume refresh tokens and clear stale verse addresses', () => {
  expect(readingUrl('https://example.com/?s=20&_refresh=1792648533116&a=7&w=6', 'flow', 20, 1).href).toBe('https://example.com/surah/20/ayah/7/word/6')
  expect(readingUrl('https://example.com/surah/20/ayah/7/word/6', 'flow', 21, 1).pathname).toBe('/surah/21')
  expect(readingUrl('https://example.com/surah/20/ayah/7/word/6', 'mushaf', 20, 12).pathname).toBe('/page/12')
  expect(versePath({s:20,a:7,pos:1})).toBe('/surah/20/ayah/7')
  expect(readSurahNumber('', '/surah/20/ayah/7')).toBe(20)
  expect(readPageNumber('', '/page/12')).toBe(12)
})
test('native reading addresses stay on the bundled entry point without server rewrites', () => {
  expect(readingUrl('tauri://localhost/?s=20&a=7&w=6&_refresh=123', 'flow', 20, 1, true).href).toBe('tauri://localhost/?s=20&a=7&w=6')
})
