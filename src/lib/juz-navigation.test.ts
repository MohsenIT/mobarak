import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import rawMeta from '../../public/data/meta.json'
import type { Meta, SurahData } from './quran'
import { juzAtRailY, juzAtVerse, juzRailLayout, surahJuzRange } from './juz-navigation'

const meta = rawMeta as unknown as Meta
const numbers = Object.keys(meta.juz).map(Number).sort((a,b) => a-b)

test('compact rail has every juz with the specified anchors and exact dot counts', () => {
  const layout = juzRailLayout(numbers, 480)
  expect(layout.slots.map(slot => slot.juz)).toEqual(numbers)
  expect(layout.slots.filter(slot => slot.labelled).map(slot => slot.juz)).toEqual([1,5,10,15,20,25,30])
  expect(layout.slots.filter(slot => slot.juz > 1 && slot.juz < 5 && !slot.labelled)).toHaveLength(3)
  for (const start of [5,10,15,20,25]) expect(layout.slots.filter(slot => slot.juz > start && slot.juz < start + 5 && !slot.labelled)).toHaveLength(4)
  const last = layout.slots.at(-1)!
  expect(layout.height - last.center - layout.labelHeight / 2).toBeCloseTo(layout.padding)
})

test('taller displays reveal more labels while all pointer coordinates retain the same juz mapping', () => {
  const layouts = [480,660,1000].map(height => juzRailLayout(numbers,height))
  expect(layouts[1].slots.filter(s=>s.labelled).length).toBeGreaterThan(layouts[0].slots.filter(s=>s.labelled).length)
  expect(layouts[2].slots.filter(s=>s.labelled)).toHaveLength(30)
  for (const [index,layout] of layouts.entries()) {
    expect(layout.height).toBeCloseTo([480,660,1000][index])
    for (const slot of layout.slots) expect(juzAtRailY(slot.center,layout)).toBe(slot.juz)
    expect(juzAtRailY(-100,layout)).toBe(1)
    expect(juzAtRailY(layout.height+100,layout)).toBe(30)
  }
  expect(juzAtRailY(0,juzRailLayout([],100))).toBeNull()
})

test('surah ranges and juz boundaries agree with every original Quran verse', () => {
  expect(surahJuzRange(meta,meta.surahs[17])).toEqual({from:15,to:16})
  expect(surahJuzRange(meta,meta.surahs[1])).toEqual({from:1,to:3})
  for (const surah of meta.surahs) {
    const data = JSON.parse(readFileSync(`public/data/surah/${surah.n}.json`,'utf8')) as SurahData
    expect(surahJuzRange(meta,surah)).toEqual({from:data.v[0].j,to:data.v.at(-1)!.j})
    for (const verse of data.v) expect(juzAtVerse(meta,surah.n,verse.n)).toBe(verse.j)
  }
})
