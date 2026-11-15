import type { Meta, SurahMeta } from './quran'

export function juzAtVerse(meta: Meta, s: number, a: number): number {
  return Object.entries(meta.juz).reduce((current, [number, [surah, ayah]]) =>
    surah < s || surah === s && ayah <= a ? Math.max(current, Number(number)) : current, 1)
}

export function surahJuzRange(meta: Meta, surah: SurahMeta): { from: number; to: number } {
  return { from: juzAtVerse(meta, surah.n, 1), to: juzAtVerse(meta, surah.n, surah.vc) }
}

export function juzRailLayout(numbers: number[], availableHeight: number) {
  if (!numbers.length) return { height: 0, padding: 0, step: 0, labelHeight: 0, slots: [] as { juz: number; labelled: boolean; center: number }[] }
  const padding = 8
  const labelHeight = 12
  const intervals = Math.max(1,numbers.length-1)
  const step = Math.max(1, (availableHeight - padding * 2 - labelHeight) / intervals)
  const labelEvery = step >= 24 ? 1 : step >= 20 ? 2 : 5
  return {
    padding, step, labelHeight, height: (numbers.length-1) * step + labelHeight + padding * 2,
    slots: numbers.map((juz, index) => ({
      juz, center: padding + labelHeight / 2 + index * step,
      labelled: index === 0 || index === numbers.length - 1 || juz % 5 === 0 || juz % labelEvery === 0,
    })),
  }
}

export function juzAtRailY(y: number, layout: ReturnType<typeof juzRailLayout>): number | null {
  if (!layout.slots.length) return null
  const index = Math.max(0, Math.min(layout.slots.length - 1, Math.round((y - layout.padding - layout.labelHeight / 2) / layout.step)))
  return layout.slots[index].juz
}
