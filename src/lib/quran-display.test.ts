import { expect, test } from 'bun:test'
import { quranDisplayText } from './quran-display'

test('the sakin-sin hamza seat retains its tooth in the Hafs display', () => {
  expect(quranDisplayText('نَسْـَٔلُكَ')).toBe('نَسْئَلُكَ')
  expect(quranDisplayText('يَسْـَٔلُونَكَ')).toBe('يَسْئَلُونَكَ')
  expect(quranDisplayText('مَسْـُٔولًۭا')).toBe('مَسْئُولًا')
})

test('unrelated hamza carriers and letters are not rewritten', () => {
  expect(quranDisplayText('ٱلْـَٔاخِرَةِ')).toBe('ٱلْـَٔاخِرَةِ')
  expect(quranDisplayText('بِـَٔايَـٰتِنَا')).toBe('بِـَٔايَـٰتِنَا')
  expect(quranDisplayText('نَسْلُكُهُۥ')).toBe('نَسْلُكُهُۥ')
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

test('superscript alef and real yeh remain distinct in the reported Saffat verses',()=>{
 expect(quranDisplayText('نَادَىٰنَا')).toBe('نَادَىٰنَا')
 expect(quranDisplayText('وَنَجَّيْنَـٰهُ')).toBe('وَنَجَّيْنَـٰهُ')
 expect(quranDisplayText('وَأَهْلَهُۥ')).toBe('وَأَهْلَهُۥ')
})

test('Quran letters and supported pronunciation marks are preserved across the corpus',async()=>{
 let alefs=0,smallLetters=0
 for(let s=1;s<=114;s++){
  const data=await Bun.file(`${import.meta.dir}/../../public/data/surah/${s}.json`).json()
  for(const verse of data.v)for(const word of verse.w){
   const original=word.t as string,result=quranDisplayText(original)
   for(const mark of ['\u0670','\u06E0','\u06E5','\u06E6','\u06E7','\u06E8','\u06EA','\u06EC','ي','ى']){
    expect(result.split(mark).length).toBe(original.split(mark).length)
   }
   alefs+=(original.match(/\u0670/g)||[]).length
   smallLetters+=(original.match(/[\u06E5-\u06E8]/g)||[]).length
  }
 }
 expect(alefs).toBe(9725)
 expect(smallLetters).toBe(2253)
})

test('the font placeholder characters are omitted without stripping real letters',()=>{
 expect(quranDisplayText('وَقَالُوا۟')).toBe('وَقَالُوا')
 expect(quranDisplayText('ٱحْشُرُوا۟')).toBe('ٱحْشُرُوا')
 expect(quranDisplayText('ظَلَمُوا۟')).toBe('ظَلَمُوا')
 expect(quranDisplayText('كَانُوا۟')).toBe('كَانُوا')
 expect(quranDisplayText('ۣ۫')).toBe('')
 expect(quranDisplayText('نَادَىٰنَا وَنَجَّيْنَـٰهُ وَأَهْلَهُۥ')).toBe('نَادَىٰنَا وَنَجَّيْنَـٰهُ وَأَهْلَهُۥ')
})

test('all occurrences of the three audited placeholder glyphs are covered',async()=>{
 let removed=0
 for(let s=1;s<=114;s++){
  const data=await Bun.file(`${import.meta.dir}/../../public/data/surah/${s}.json`).json()
  for(const verse of data.v)for(const word of verse.w){
   const original=word.t as string
   removed+=(original.match(/[\u06DF\u06E3\u06EB]/g)||[]).length
   expect(quranDisplayText(original)).not.toMatch(/[\u06DF\u06E3\u06EB]/)
   expect(word.t).toBe(original)
  }
 }
 expect(removed).toBe(3990)
})


test('optional meem annotations stay hidden throughout all surahs, preserving real meem', async () => {
 let affected = 0
 for (let s = 1; s <= 114; s++) {
  const data = await Bun.file(`${import.meta.dir}/../../public/data/surah/${s}.json`).json()
  for (const verse of data.v) for (const word of verse.w) {
   const original = word.t as string, displayed = quranDisplayText(original)
   affected += (original.match(/[\u06E2\u06ED]/g) || []).length
   expect(displayed).not.toMatch(/[\u06E2\u06ED]/)
   expect(displayed.split('م').length).toBe(original.split('م').length)
   expect(word.t).toBe(original)
  }
 }
 expect(affected).toBeGreaterThan(0)
 for (const [source, expected] of [['غَوْلٌۭ','غَوْلٌ'],['عِينٌۭ','عِينٌ'],['مَّكْنُونٌۭ','مَّكْنُونٌ']]) expect(quranDisplayText(source)).toBe(expected)
})
