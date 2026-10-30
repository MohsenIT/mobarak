import { describe, expect, test } from 'bun:test'
import { formatVerseCopy, mergeSelectionRects, type CopiedVerse } from './verse-copy'

const verse = (ayah: number, text = `نص ${ayah}`): CopiedVerse => ({ surah: 2, name: 'بقره', ayah, text })
describe('copied Quran references', () => {
  test('a single verse or fragment ends with an inline address', () => {
    expect(formatVerseCopy([verse(5, 'بخشی از آیه')])).toBe('بخشی از آیه (بقره، 5)')
  })
  test('consecutive verses are joined with commas and one range reference', () => {
    expect(formatVerseCopy([verse(2), verse(3)])).toBe('نص 2، نص 3 (بقره، 2-3)')
  })
  test('gaps and different surahs retain separate addresses', () => {
    expect(formatVerseCopy([verse(2), verse(3), verse(215), { surah: 3, name: 'آل عمران', ayah: 1, text: 'الم' }]))
      .toBe('نص 2، نص 3 (بقره، 2-3)، نص 215 (بقره، 215)، الم (آل عمران، 1)')
  })
  test('copy omits hidden recitation annotations but retains letters and pronunciation', () => {
    expect(formatVerseCopy([verse(5, 'ٱتَّقُوا۟ رَبَّكُمْ ۚ عَظِيمٌۭ')])).toBe('ٱتَّقُوا رَبَّكُمْ عَظِيمٌ (بقره، 5)')
    expect(formatVerseCopy([verse(5, 'ْكِتَـٰبُ')])).toBe('كِتَـٰبُ (بقره، 5)')
    expect(formatVerseCopy([verse(5, 'نَادَىٰ وَأَهْلَهُۥ')])).toBe('نَادَىٰ وَأَهْلَهُۥ (بقره، 5)')
  })
  test('optional translations stay with their verse and do not introduce line breaks', () => {
    expect(formatVerseCopy([{ ...verse(5, 'عَرَبِيّ'), translation: 'ترجمه' }])).toBe('عَرَبِيّ — ترجمه (بقره، 5)')
    expect(formatVerseCopy([])).toBe('')
  })
})
test('selection bands bridge word gaps on the same line without joining separate lines', () => {
  expect(mergeSelectionRects([
    { left: 100, right: 140, top: 0, bottom: 30 },
    { left: 150, right: 190, top: 0, bottom: 30 },
    { left: 120, right: 130, top: 8, bottom: 24 },
    { left: 100, right: 140, top: 50, bottom: 80 },
  ])).toEqual([{ left: 100, right: 190, top: 0, bottom: 30 }, { left: 100, right: 140, top: 50, bottom: 80 }])
})

test('browser DOMRect getters are copied into each selection band', () => {
  const rect = Object.create({ get left() { return 10 }, get top() { return 20 }, get right() { return 40 }, get bottom() { return 60 } })
  expect(mergeSelectionRects([rect])).toEqual([{ left: 10, top: 20, right: 40, bottom: 60 }])
})
