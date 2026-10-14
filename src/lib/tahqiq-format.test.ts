import { expect, test } from 'bun:test'
import { splitTahqiqText } from './tahqiq-format'
import study from '../../public/data/tahqiq/علم.json'
import apkSource from '../../data/tahqiq/source.json'
import supplement from '../../data/tahqiq/supplement-source.json'

test('vocalized Quran quotes are separated from references and Persian translation', () => {
  const text = 'شرح.سوره مباركه انعام آيه 80: وَسِعَ رَبِّي كُلَّ شَيْءٍ عِلْماً، علم پروردگارم.'
  const parts = splitTahqiqText(text)
  expect(parts.map(p => p.text).join('')).toBe(text)
  expect(parts.find(p => p.kind === 'quran')?.text.trim()).toBe('وَسِعَ رَبِّي كُلَّ شَيْءٍ عِلْماً')
  expect(parts.at(-1)?.kind).toBe('text')
})
test('conservative fallback preserves prose and quoted words without a citation', () => {
  for (const text of ['اصل واحد، حضور و احاطه است.', '«آیه» نشانه است.', 'سوره مبارکه انعام آیه 80: متن بدون اعراب.']) {
    const parts = splitTahqiqText(text)
    expect(parts.map(p => p.text).join('')).toBe(text)
    expect(parts.some(p => p.kind === 'quran')).toBe(false)
  }
})
test('real APK text remains byte-for-byte reconstructable after formatting', () => {
  const text = study.entries[0].fa
  const parts = splitTahqiqText(text)
  expect(parts.map(p => p.text).join('')).toBe(text)
  expect(parts.some(p => p.kind === 'quran')).toBe(true)
})

test('formatting preserves every original and supplemental Persian definition', () => {
  for (const entry of [...apkSource.entries, ...Object.values(supplement.entries)]) {
    expect(splitTahqiqText(entry.fa).map(p => p.text).join('')).toBe(entry.fa)
  }
})
