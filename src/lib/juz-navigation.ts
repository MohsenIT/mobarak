import type { Meta, SurahMeta } from './quran'

export function juzAtVerse(meta: Meta, s: number, a: number): number {
  return Object.entries(meta.juz).reduce((current, [number, [surah, ayah]]) =>
    surah < s || surah === s && ayah <= a ? Math.max(current, Number(number)) : current, 1)
}

export function surahJuzRange(meta: Meta, surah: SurahMeta): { from: number; to: number } {
  return { from: juzAtVerse(meta, surah.n, 1), to: juzAtVerse(meta, surah.n, surah.vc) }
}

export function juzRailLayout(numbers: number[], availableHeight: number) {
  if (!numbers.length) return { height: 0, padding: 0, labelHeight: 0, dotHeight: 0, slots: [] as { juz: number; labelled: boolean; center: number; height: number }[] }
  const padding = 8
  const labelHeight = 14
  const count = numbers.length
  const height = Math.max(padding * 2 + Math.min(count, 2) * labelHeight + Math.max(0, count - 2) * .5, availableHeight)
  const dotHeight = Math.min(3, Math.max(.5, (height - padding * 2 - Math.min(count, 2) * labelHeight - (count - 1)) / Math.max(1, count - 2)))
  const geometry = (labelled: Set<number>) => {
    const sizes = numbers.map((_, i) => labelled.has(i) ? labelHeight : dotHeight)
    const gaps = numbers.slice(1).map(() => 8)
    return { sizes, gaps, required: padding * 2 + sizes.reduce((a,b) => a+b,0) + gaps.reduce((a,b) => a+b,0) }
  }
  // Choose one complete regular pattern, never rounded scattered labels.
  // Endpoints always remain; in short landscapes only the dot gaps compress.
  let labelled = new Set([0, count - 1])
  for (const interval of [1, 5, 10]) {
    const candidate = new Set(numbers.flatMap((juz, index) => index === 0 || index === count - 1 || juz % interval === 0 ? [index] : []))
    if (geometry(candidate).required <= height) { labelled = candidate; break }
  }
  const { sizes, gaps } = geometry(labelled)
  const gapBudget = height - padding * 2 - sizes.reduce((a,b) => a+b,0)
  const preferredGaps = gaps.reduce((a,b) => a+b,0)
  let cursor = padding
  const slots = numbers.map((juz, index) => {
    const size = sizes[index]
    const slot = { juz, labelled: labelled.has(index), center: cursor + size / 2, height: size }
    cursor += size + (preferredGaps ? (gaps[index] ?? 0) * gapBudget / preferredGaps : 0)
    return slot
  })
  return {
    padding, labelHeight, dotHeight, height: count === 1 ? padding * 2 + labelHeight : height, slots,
  }
}

export function juzAtRailY(y: number, layout: ReturnType<typeof juzRailLayout>): number | null {
  if (!layout.slots.length) return null
  return layout.slots.reduce((nearest, slot) => Math.abs(slot.center - y) < Math.abs(nearest.center - y) ? slot : nearest).juz
}
