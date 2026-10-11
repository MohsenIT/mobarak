'use client'

/**
 * Render a word of Uthmani mushaf text — with the small Quranic
 * recitation marks stripped out.
 *
 * Why strip them:
 *   The Uthmani text contains small "recitation aid" codepoints in
 *   the U+06D6..U+06ED range (and U+0670 superscript alef). Examples:
 *     • U+06ED small low meem → looks like a tiny "م" floating in words
 *     • U+06E2 small high meem → another tiny "م" above the line
 *     • U+06E5 small waw, U+06E6 small yeh → tiny letters
 *     • U+06DE rub el hizb, U+06E9 place of sajdah → ornamental circles
 *     • U+06DF rounded zero, U+06E0 rectangular zero → small o shapes
 *     • U+06D6/U+06D7 small ligatures, U+06DA small jeem → tiny marks
 *     • U+0670 superscript alef → tiny "ا" above the letter
 *
 *   These are real Quranic script features used by reciters, but for
 *   a reader who just wants to read the text they look like stray
 *   "م"s and circles appearing in the middle of words. The user
 *   explicitly asked to remove them.
 *
 * What we keep:
 *   All the actual letters and the standard diacritics (fatha, kasra,
 *   damma, sukun, shadda, tanwin, dagger alef U+0670 is removed too
 *   since the user said "remove them" referring to all the small
 *   marks), plus tatweel (ـ) and the alef-wasla (ٱ).
 *
 * Implementation note:
 *   We strip at render-time only — the source JSON data files are
 *   untouched, so the marks are still available for any future feature
 *   that wants them (e.g. a "show recitation aids" toggle).
 */

const QURAN_MARK_RE = /[\u06D6-\u06ED\u0670]/g

export default function QuranText({ text }: { text: string }) {
  const cleaned = text.replace(QURAN_MARK_RE, '')
  return <>{cleaned}</>
}
