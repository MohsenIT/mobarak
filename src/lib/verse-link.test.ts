import { expect, test } from 'bun:test'
import { readVerseAddress } from './verse-link'
test('verse links accept surah, verse and optional word', () => {
  expect(readVerseAddress('?s=20&a=47')).toEqual({s:20,a:47,pos:1})
  expect(readVerseAddress('?s=20&a=47&w=3')).toEqual({s:20,a:47,pos:3})
  for (const value of ['?s=115&a=1','?s=20&a=0','?s=20&a=1.5','?s=20&a=1&w=0','?s=20','?p=42']) expect(readVerseAddress(value)).toBeNull()
})
