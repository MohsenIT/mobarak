import { describe, expect, test } from 'bun:test'
import { nextRecitation, recitationUrl, recitationSourceUrl, RECITERS } from './recitation'
describe('recitation playback',()=>{
  test('uses Minshawi verse URLs supplied by provider',()=>{
    expect(recitationUrl(20,72)).toBe('https://verses.quran.com/Minshawi/Murattal/mp3/020072.mp3')
    expect(()=>recitationUrl(0,1)).toThrow();expect(()=>recitationUrl(20,0)).toThrow()
  })
  test('Parhizgar uses Tanzil source and the download-safe endpoint',()=>{
    expect(recitationSourceUrl(20,72,RECITERS[1])).toBe('https://tanzil.net/res/audio/parhizgar/020072.mp3')
    expect(recitationUrl(20,72,RECITERS[1])).toBe('/api/recitation?r=parhizgar&s=20&a=72')
  })
  test('repeats each verse three times and the whole surah twice, then stops',()=>{
    let p={ayah:1,verseRound:1,surahRound:1};const played:number[]=[]
    for(let i=0;i<20;i++){played.push(p.ayah);const next=nextRecitation(p,2,3,2);if(!next)break;p=next}
    expect(played).toEqual([1,1,1,2,2,2,1,1,1,2,2,2])
  })
  test('infinite verse repeat stays on that verse',()=>expect(nextRecitation({ayah:72,verseRound:99,surahRound:1},135,0,1)).toEqual({ayah:72,verseRound:100,surahRound:1}))
  test('infinite surah repeat wraps to first verse',()=>expect(nextRecitation({ayah:135,verseRound:1,surahRound:99},135,1,0)).toEqual({ayah:1,verseRound:1,surahRound:100}))
  test('ordinary playback stops at end',()=>expect(nextRecitation({ayah:7,verseRound:1,surahRound:1},7,1,1)).toBeNull())
})

test('each additional Tanzil reciter has a separate proxy and cache identity',()=>{
 const supported=RECITERS.filter(r=>r.tanzilDirectory)
 expect(supported.length).toBeGreaterThan(2)
 expect(new Set(supported.map(r=>recitationUrl(20,72,r))).size).toBe(supported.length)
 expect(RECITERS.some(r=>/afasy|alafasy/i.test(r.id))).toBe(false)
})
