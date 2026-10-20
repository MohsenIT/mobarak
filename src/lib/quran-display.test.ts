import { expect, test } from 'bun:test'
import { quranDisplayText } from './quran-display'

test('the sakin-sin hamza seat retains its tooth in the Hafs display', () => {
  expect(quranDisplayText('نَسْـَٔلُكَ')).toBe('نَسْئَلُكَ')
  expect(quranDisplayText('يَسْـَٔلُونَكَ')).toBe('يَسْئَلُونَكَ')
  expect(quranDisplayText('مَسْـُٔولًۭا')).toBe('مَسْئُولًا')
})

test('unrelated hamza carriers and letters are not rewritten', () => {
  expect(quranDisplayText('ٱلْـَٔاخِرَةِ')).toBe('ٱلْـَٔاخِرَةِ')
  expect(quranDisplayText('بِـَٔايَـٰتِنَا')).toBe('بِـَٔايَـتِنَا')
  expect(quranDisplayText('نَسْلُكُهُۥ')).toBe('نَسْلُكُهُ')
})

test('the compatibility fix covers the same pattern across all 114 surahs', async () => {
  let affected = 0
  for (let s = 1; s <= 114; s++) {
    const surah = await Bun.file(`${import.meta.dir}/../../public/data/surah/${s}.json`).json()
    for (const verse of surah.v) for (const word of verse.w) {
      const original = word.t as string
      const matches = original.match(/سْـٔ/g)?.length ?? 0
      affected += matches
      const result = quranDisplayText(original)
      expect(result.includes('سْـٔ')).toBe(false)
      // Retain every hamza, including those unrelated to the affected carrier.
      const hamzas = (text: string) => text.normalize('NFD').match(/[ء\u0654\u0655]/g)?.length ?? 0
      expect(hamzas(result)).toBe(hamzas(original))
      expect(word.t).toBe(original)
    }
  }
  expect(affected).toBe(91)
})

test('hidden pause signs do not leave whitespace inside selectable words', () => {
  expect(quranDisplayText('مِسَاسَ ۖ')).toBe('مِسَاسَ')
  expect(quranDisplayText('أَسِفًۭا ۚ')).toBe('أَسِفًا')
  expect(quranDisplayText('لَا مِسَاسَ ۖ')).toBe('لَا مِسَاسَ')
})
