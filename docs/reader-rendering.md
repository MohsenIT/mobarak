# Reader rendering safeguards

Quran text is stored verbatim. `quranDisplayText` is only a presentation adapter for the bundled Hafs font. Its previous broad removal of U+06D6–U+06ED and U+0670 incorrectly hid superscript alef and small waw/yeh, among other pronunciation marks. It now removes only the explicitly listed standalone pause/section symbols. The existing narrowly scoped sakin-sin hamza-seat compatibility rule remains. Whole-corpus tests check preservation of yeh, alef maqsura, superscript alef and the small letters/reading signs.

A cmap and composite-glyph audit of the shipped KFGQPC Hafs font found three codepoints mapped to the visible `uni0600` placeholder: U+06DF (3,988 source occurrences), U+06E3 (one), and U+06EB (one). These are omitted only at display time; all other supported letters/reading marks remain. This audit was performed against font SHA-256 `8c00e7a7d5f773bcfb1642fdcfba505dbd81975fef39f14718827a32d075020c`. Re-audit the compatibility exclusions when replacing the font. Regression tests cover all 3,990 occurrences and separately preserve superscript alef and small waw/yeh.

In Saffat 37:75, `نَادَىٰنَا` contains alef maqsura and superscript alef, not an ordinary dotted yeh. Restoring its superscript alef is correct; adding two dots would change the writing. The ordinary yeh in 37:76 `وَنَجَّيْنَـٰهُ` is preserved independently.

The original React touch handlers from before `eb75896` are restored: the initial two-finger distance and font scale are captured on touchstart, every touchmove directly updates the actual font in 5% steps, and touchend clears the gesture. The later native capture listener, target restriction, animation-frame gate and click suppression are removed. The only retained performance change is deferring the preference write by 200ms, so storage is not written for every movement. No transform preview or new interaction is introduced. Physical Android feel still needs device verification.

The translation icon uses the exact two filled vector outlines supplied by the user in `New Project.svg`; it is not approximated with font glyphs, images or hand-drawn paths. It retains the original 512-unit view box and inherits currentColor.

Optional high/low meem annotations U+06E2 and U+06ED are hidden at display time by explicit user preference (0.4.10). Ordinary meem U+0645, vowels, superscript alef and source data remain unchanged. Corpus regression checks cover both annotations in all 114 surahs.
