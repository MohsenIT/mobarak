import {expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
const read = (file: string) => JSON.parse(readFileSync(`public/data/${file}.json`, 'utf8'))
test('Sharh stays on page 596 and all of Alaq stays on page 597', () => {
  const meta = read('meta')
  expect(meta.pages[595].find((segment: {s: number}) => segment.s === 94)).toEqual({s:94,f:1,t:8})
  expect(meta.pages[596]).toEqual([{s:95,f:1,t:8},{s:96,f:1,t:19}])
  expect(meta.pages[597].some((segment: {s: number}) => segment.s === 96)).toBe(false)
  for (const [surah, page] of [[94,596],[96,597]]) {
    const data = read(`surah/${surah}`)
    expect(data.v.every((verse: {p: number}) => verse.p === page)).toBe(true)
    expect(data.v.flatMap((verse: {w: {l: number}[]}) => verse.w).every((word: {l: number}) => word.l >= 1 && word.l <= 15)).toBe(true)
  }
})

test('all 604 pages preserve Quran word order with each of the 6236 verses exactly once', () => {
  const meta = read('meta')
  const surahs = Array.from({length:114}, (_, i) => read(`surah/${i + 1}`))
  const expected = surahs.flatMap(surah => surah.v.flatMap((verse: {n: number; w: unknown[]}) => verse.w.map((_, index) => `${surah.n}:${verse.n}:${index + 1}`)))
  const rendered: string[] = []
  let verses = 0
  expect(meta.pages).toHaveLength(604)
  meta.pages.forEach((segments: {s:number;f:number;t:number}[], index: number) => {
    let line = 0
    expect(segments.length).toBeGreaterThan(0)
    for (const segment of segments) {
      for (const verse of surahs[segment.s - 1].v.filter((verse: {n:number}) => verse.n >= segment.f && verse.n <= segment.t)) {
        expect(verse.p).toBe(index + 1)
        if (verse.n === 1) expect(meta.surahs[segment.s - 1].pg).toBe(index + 1)
        verses++
        verse.w.forEach((word: {l:number}, wordIndex: number) => {
          expect(word.l).toBeGreaterThanOrEqual(line)
          expect(word.l).toBeLessThanOrEqual(15)
          line = word.l
          rendered.push(`${segment.s}:${verse.n}:${wordIndex + 1}`)
        })
      }
    }
  })
  expect(verses).toBe(6236)
  expect(rendered).toEqual(expected)
})
