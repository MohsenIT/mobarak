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
