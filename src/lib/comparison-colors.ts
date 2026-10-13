import type { CSSProperties } from 'react'

/** Stable root identity: sorting or changing the range never changes its color. */
export function rootHue(root: string): number {
  let hash = 2166136261
  for (const char of root) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0) % 36000 / 100
}
export function rootColorStyle(hue: number): CSSProperties {
  const code = Math.round(hue * 100)
  return { '--comparison-hue': hue, '--comparison-saturation': `${55 + code % 25}%`, '--comparison-lightness': `${78 + Math.floor(code / 25) % 12}%`, '--comparison-darkness': `${22 + Math.floor(code / 25) % 10}%` } as CSSProperties
}
