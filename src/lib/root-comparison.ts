/**
 * Which roots a range comparison shows and which it mutes.
 *
 * Two independent mechanisms overlap here, and the reader has always resolved
 * them the same way:
 * - `hidden` — roots the reader tapped off, one by one.
 * - `solo` — a single root held down (or picked from the range sheet) to show
 *   on its own.
 * Solo wins: while it is set, every root except it is muted, and the hidden set
 * is remembered but not consulted. Clearing solo restores the hidden set.
 */

export type ComparisonRange = { s: number; from: number; to: number }

export type ComparisonVisibility = {
  /** Roots the reader muted explicitly. */
  hidden: Set<string>
  /** The root shown on its own, or null when every root is visible. */
  solo: string | null
}

/** A comparison with nothing muted and nothing soloed. */
export const visibleComparison = (): ComparisonVisibility => ({ hidden: new Set<string>(), solo: null })

/**
 * Roots to mute for display. Only roots that actually occur in the comparison
 * can be muted — muting a root that is not shown has no meaning.
 */
export function mutedComparisonRoots(roots: Record<string, number>, visibility: ComparisonVisibility): Set<string> {
  const { hidden, solo } = visibility
  return new Set(Object.keys(roots).filter(root => solo ? root !== solo : hidden.has(root)))
}

/**
 * Tapping a root while a comparison is active. Tapping a muted root reveals it,
 * tapping a visible root mutes it, and tapping in solo mode leaves solo mode —
 * except when the tapped root *is* the soloed one, which mutes it instead.
 *
 * `hidden` is copied rather than mutated, so this is safe to use as a React
 * state update.
 */
export function toggleComparisonRoot(root: string, visibility: ComparisonVisibility): ComparisonVisibility {
  const hidden = new Set(visibility.hidden)
  const leavingSoloForAnotherRoot = !!visibility.solo && root !== visibility.solo
  if (leavingSoloForAnotherRoot || hidden.has(root)) hidden.delete(root)
  else hidden.add(root)
  return { hidden, solo: null }
}
