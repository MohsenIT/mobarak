/**
 * Reader presentation settings: the values that decide how the text looks and
 * which list of surahs the drawer offers, plus the rules for updating them.
 *
 * This module is the pure half. `page.tsx` still owns the React state (and the
 * `mushaf.*` writes) so the values keep their existing lifecycle; what moved
 * here is the arithmetic that used to live inline in render/event callbacks:
 * scale clamping, the recent-surah cap, bookmark/pin list updates.
 */

import { isTranslator, type Translator } from './translations'

/** Smallest and largest reader scale the UI offers. */
export const MIN_SCALE = 0.55
export const MAX_SCALE = 1.9
/** How many recently visited surahs the drawer remembers. */
export const RECENT_SURAHS_LIMIT = 12
/** The default translation when the reader has expressed no preference. */
export const DEFAULT_TRANSLATOR: Translator = 's'

/** Scale steps round to the nearest 5% so the percentage readout stays clean. */
export const roundScale = (value: number) => Math.round(value * 20) / 20

/** Clamp an arbitrary scale to the range the UI exposes, rounded to a step. */
export function clampScale(value: number): number {
  return roundScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)))
}

/**
 * One zoom-in/zoom-out step (ctrl+wheel, pinch, buttons). `direction` is the
 * sign of the delta: negative zooms in, positive zooms out.
 */
export function stepScale(scale: number, delta: number): number {
  return clampScale(scale + (delta < 0 ? 0.1 : -0.1))
}

/**
 * The translator to start with. Older readers only ever saw one bundled
 * translation, so `mushaf.safavi-default.v1` marks the ones who opted in; a
 * stored translator only counts if it is still a real one, otherwise we fall
 * back to the default rather than rendering a missing translation.
 */
export function resolveInitialTranslator(storedTranslator: unknown, savafiDefault: boolean): Translator {
  if (savafiDefault && isTranslator(storedTranslator)) return storedTranslator
  return DEFAULT_TRANSLATOR
}

/**
 * The recent-surah list after visiting `surah`. The visited surah moves to the
 * front, duplicates are dropped, and the list is capped. Invalid numbers are
 * filtered out rather than poisoning the list — this runs on every page load.
 */
export function rememberSurah(recent: number[], surah: number): number[] {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return recent
  return [surah, ...recent.filter(n => n !== surah && Number.isInteger(n) && n >= 1 && n <= 114)].slice(0, RECENT_SURAHS_LIMIT)
}

/** Pin/unpin a surah, keeping the list in insertion order. */
export function togglePinnedSurah(pinned: number[], surah: number): number[] {
  return pinned.includes(surah) ? pinned.filter(n => n !== surah) : [...pinned, surah]
}

/** Drop a page from the bookmark list (the drawer's remove action). */
export function removeBookmark(bookmarks: number[], page: number): number[] {
  return bookmarks.filter(n => n !== page)
}
