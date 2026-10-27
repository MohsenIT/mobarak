# Reader rendering safeguards

Quran text is stored verbatim. `quranDisplayText` is only a presentation adapter for the bundled Hafs font. Its previous broad removal of U+06D6–U+06ED and U+0670 incorrectly hid superscript alef and small waw/yeh, among other pronunciation marks. It now removes only the explicitly listed standalone pause/section symbols. The existing narrowly scoped sakin-sin hamza-seat compatibility rule remains. Whole-corpus tests check preservation of yeh, alef maqsura, superscript alef and the small letters/reading signs.

A cmap and composite-glyph audit of the shipped KFGQPC Hafs font found three codepoints mapped to the visible `uni0600` placeholder: U+06DF (3,988 source occurrences), U+06E3 (one), and U+06EB (one). These are omitted only at display time; all other supported letters/reading marks remain. This audit was performed against font SHA-256 `8c00e7a7d5f773bcfb1642fdcfba505dbd81975fef39f14718827a32d075020c`. Re-audit the compatibility exclusions when replacing the font. Regression tests cover all 3,990 occurrences and separately preserve superscript alef and small waw/yeh.

In Saffat 37:75, `نَادَىٰنَا` contains alef maqsura and superscript alef, not an ordinary dotted yeh. Restoring its superscript alef is correct; adding two dots would change the writing. The ordinary yeh in 37:76 `وَنَجَّيْنَـٰهُ` is preserved independently.

Pinch interaction uses `useReaderPinch` with live, discrete 5% font-size steps. Each new step changes the actual reader font while both fingers are still down; no transform, zoomed screenshot or end-only reflow is used. Duplicate moves within the same step are ignored and updates are coalesced to animation frames. The final pending step is flushed on touchend, font limits remain 55–190%, and the existing deferred preference write remains. Single-finger reading and scroll/surah navigation are left available; a brief click guard prevents accidental word selection after a pinch.

The compositor-preview experiment in 0.4.7 was reverted after user feedback: live step-by-step resizing is the intended behavior. Physical Android performance still needs device verification.

The translation icon uses the exact two filled vector outlines supplied by the user in `New Project.svg`; it is not approximated with font glyphs, images or hand-drawn paths. It retains the original 512-unit view box and inherits currentColor.

Optional high/low meem annotations U+06E2 and U+06ED are hidden at display time by explicit user preference (0.4.10). Ordinary meem U+0645, vowels, superscript alef and source data remain unchanged. Corpus regression checks cover both annotations in all 114 surahs.
