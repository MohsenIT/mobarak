import { beforeEach, describe, expect, test } from 'bun:test'
import { quranCopyText, formatVerseCopy, mergeSelectionRects, type CopiedVerse } from './verse-copy'
import { DEFAULT_COPY_SETTINGS } from './copy-settings'

import { setUiLanguage } from './i18n'
beforeEach(async () => { await setUiLanguage('fa', false) })

const verse = (ayah: number, text = `نص ${ayah}`): CopiedVerse => ({ surah: 2, name: 'بقره', ayah, text })
describe('copied Quran references', () => {
  test('the default is a paragraph-safe compact reference with no leading line break', () => {
    expect(formatVerseCopy([verse(5, 'بخشی از آیه')])).toBe('بخشی از آیه {بقره، ۵}')
    expect(formatVerseCopy([verse(2), verse(3)])).toBe('نص 2، نص 3 {بقره، ۲-۳}')
  })
  test('the complete preset leads with one reference and keeps each verse number', () => {
    expect(formatVerseCopy([verse(2), verse(3)], undefined, { ...DEFAULT_COPY_SETTINGS, format: 'full' })).toBe('سوره بقره، آیات ۲-۳: نص 2 (۲) نص 3 (۳)')
  })
  test('gaps stay explicit in the heading and different surahs have separate sections', () => {
    expect(formatVerseCopy([verse(2), verse(3), verse(215), { surah: 3, name: 'آل عمران', ayah: 1, text: 'الم' }], undefined, { ...DEFAULT_COPY_SETTINGS, format: 'full' }))
      .toBe('سوره بقره، آیات ۲-۳، ۲۱۵: نص 2 (۲) نص 3 (۳) نص 215 (۲۱۵) سوره آل عمران، آیه ۱: الم (۱)')
  })
  test('copy omits hidden recitation annotations but retains letters and pronunciation', () => {
    expect(formatVerseCopy([verse(5, 'ٱتَّقُوا۟ رَبَّكُمْ ۚ عَظِيمٌۭ')])).toBe('ٱتَّقُوا رَبَّكُمْ عَظِيمٌ {بقره، ۵}')
    expect(formatVerseCopy([verse(5, 'ْكِتَـٰبُ')])).toBe('كِتَـٰبُ {بقره، ۵}')
    expect(formatVerseCopy([verse(5, 'نَادَىٰ وَأَهْلَهُۥ')])).toBe('نَادَى وَأَهْلَهُۥ {بقره، ۵}')
  })
  test('optional translations and bismillah remain in the body below the heading', () => {
    expect(formatVerseCopy([{ ...verse(5, 'عَرَبِيّ'), translation: 'ترجمه' }])).toBe('عَرَبِيّ — ترجمه {بقره، ۵}')
    expect(formatVerseCopy([verse(5, 'نص')], 'بسم الله')).toBe('بسم الله نص {بقره، ۵}')
    expect(formatVerseCopy([])).toBe('')
  })
  test('custom formatting independently controls the reference, verse numbers, translation and line breaks', () => {
    const settings = { format: 'custom' as const, custom: { heading: 'end' as const, verseNumbers: true, translation: true, lineBreaks: true } }
    expect(formatVerseCopy([{ ...verse(2), translation: 'دو' }, { ...verse(3), translation: 'سه' }], undefined, settings)).toBe('نص 2 (۲) — دو نص 3 (۳) — سه {بقره، ۲-۳}')
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

test('Taha copy omits Word-incompatible lengthening annotations without removing hamza or vowels', () => {
  const source = ['طه', 'مَآ أَنزَلْنَا عَلَيْكَ ٱلْقُرْءَانَ لِتَشْقَىٰٓ', 'إِلَّا تَذْكِرَةًۭ لِّمَن يَخْشَىٰ']
  const copied = formatVerseCopy(source.map((text, i) => ({ surah: 20, name: 'طه', ayah: i + 1, text })))
  expect(copied).toBe('طه، مَا أَنزَلْنَا عَلَيْكَ ٱلْقُرْءَانَ لِتَشْقَى، إِلَّا تَذْكِرَةً لِّمَن يَخْشَى {طه، ۱-۳}')
  expect(copied).not.toMatch(/[\u0653\u06D6-\u06ED]/u)
  expect(quranCopyText('آمَنَ أَحَدٌ إِلَّا سُـِٔلَ الرَّحْمَـٰنُ')).toBe('آمَنَ أَحَدٌ إِلَّا سُـِٔلَ الرَّحْمَـٰنُ')
})
