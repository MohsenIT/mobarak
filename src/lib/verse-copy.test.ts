import { beforeEach, describe, expect, test } from 'bun:test'
import { formatVerseCopy, mergeSelectionRects, type CopiedVerse } from './verse-copy'

import { setUiLanguage } from './i18n'
beforeEach(async () => { await setUiLanguage('fa', false) })

const verse = (ayah: number, text = `نص ${ayah}`): CopiedVerse => ({ surah: 2, name: 'بقره', ayah, text })
describe('copied Quran references', () => {
  test('a single verse or fragment has a heading and an inline verse number', () => {
    expect(formatVerseCopy([verse(5, 'بخشی از آیه')])).toBe('سوره بقره، آیه ۵:\nبخشی از آیه (۵)')
  })
  test('consecutive verses share a range heading and retain individual numbers', () => {
    expect(formatVerseCopy([verse(2), verse(3)])).toBe('سوره بقره، آیات ۲-۳:\nنص 2 (۲) نص 3 (۳)')
  })
  test('gaps stay explicit in the heading and different surahs have separate sections', () => {
    expect(formatVerseCopy([verse(2), verse(3), verse(215), { surah: 3, name: 'آل عمران', ayah: 1, text: 'الم' }]))
      .toBe('سوره بقره، آیات ۲-۳، ۲۱۵:\nنص 2 (۲) نص 3 (۳) نص 215 (۲۱۵)\n\nسوره آل عمران، آیه ۱:\nالم (۱)')
  })
  test('copy omits hidden recitation annotations but retains letters and pronunciation', () => {
    expect(formatVerseCopy([verse(5, 'ٱتَّقُوا۟ رَبَّكُمْ ۚ عَظِيمٌۭ')])).toBe('سوره بقره، آیه ۵:\nٱتَّقُوا رَبَّكُمْ عَظِيمٌ (۵)')
    expect(formatVerseCopy([verse(5, 'ْكِتَـٰبُ')])).toBe('سوره بقره، آیه ۵:\nكِتَـٰبُ (۵)')
    expect(formatVerseCopy([verse(5, 'نَادَىٰ وَأَهْلَهُۥ')])).toBe('سوره بقره، آیه ۵:\nنَادَىٰ وَأَهْلَهُۥ (۵)')
  })
  test('optional translations and bismillah remain in the body below the heading', () => {
    expect(formatVerseCopy([{ ...verse(5, 'عَرَبِيّ'), translation: 'ترجمه' }])).toBe('سوره بقره، آیه ۵:\nعَرَبِيّ (۵) — ترجمه')
    expect(formatVerseCopy([verse(5, 'نص')], 'بسم الله')).toBe('سوره بقره، آیه ۵:\nبسم الله نص (۵)')
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
