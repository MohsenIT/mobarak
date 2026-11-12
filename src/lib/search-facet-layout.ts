/** Number of whole facet chips that fit on one line, including its overflow action. */
export function visibleFacetCount(available: number, widths: number[], moreWidths: number[], gap: number): number {
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * gap
  if (total <= available) return widths.length
  let used = 0, visible = 0
  for (let i = 0; i < widths.length; i++) {
    used += widths[i] + (i ? gap : 0)
    if (used + gap + (moreWidths[widths.length - i - 1] ?? 0) <= available) visible = i + 1
  }
  return visible
}
