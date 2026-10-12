import dataset from '../../public/data/contexts.json'

export interface ContextRange {
  id: number
  from: number
  to: number
  sourcePage: number
  sourceLabel?: string
  note?: string
  origin?: string
}
interface SurahContexts {
  status: string
  ranges: ContextRange[]
  sourcePage: number
  sourceHeading: string
  group: number[]
}
const surahs = dataset.surahs as Record<string, SurahContexts>
export const contextSource = dataset.source
export function getSurahContexts(s: number): SurahContexts | undefined { return surahs[String(s)] }
export function getContext(s: number, a: number): ContextRange | undefined {
  return getSurahContexts(s)?.ranges.find(range => a >= range.from && a <= range.to)
}
export function nextContext(s: number, a: number, direction: number): ContextRange | undefined {
  const ranges = getSurahContexts(s)?.ranges ?? []
  const index = ranges.findIndex(range => a >= range.from && a <= range.to)
  if (index < 0) return undefined
  return ranges[Math.max(0, Math.min(ranges.length - 1, index + direction))]
}
