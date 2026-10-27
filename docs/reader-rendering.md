# Reader rendering safeguards

Quran text is stored verbatim. `quranDisplayText` is only a presentation adapter for the bundled Hafs font. Its previous broad removal of U+06D6–U+06ED and U+0670 incorrectly hid superscript alef and small waw/yeh, among other pronunciation marks. It now removes only the explicitly listed standalone pause/section symbols. The existing narrowly scoped sakin-sin hamza-seat compatibility rule remains. Whole-corpus tests check preservation of yeh, alef maqsura, superscript alef and the small letters/reading signs.

A cmap and composite-glyph audit of the shipped KFGQPC Hafs font found three codepoints mapped to the visible `uni0600` placeholder: U+06DF (3,988 source occurrences), U+06E3 (one), and U+06EB (one). These are omitted only at display time; all other supported letters/reading marks remain. This audit was performed against font SHA-256 `8c00e7a7d5f773bcfb1642fdcfba505dbd81975fef39f14718827a32d075020c`. Re-audit the compatibility exclusions when replacing the font. Regression tests cover all 3,990 occurrences and separately preserve superscript alef and small waw/yeh.

In Saffat 37:75, `نَادَىٰنَا` contains alef maqsura and superscript alef, not an ordinary dotted yeh. Restoring its superscript alef is correct; adding two dots would change the writing. The ordinary yeh in 37:76 `وَنَجَّيْنَـٰهُ` is preserved independently.

The original React touch handlers from before `eb75896` are restored: the initial two-finger distance and font scale are captured on touchstart, every touchmove directly updates the actual font in 5% steps, and touchend clears the gesture. The later native capture listener, target restriction, animation-frame gate and click suppression are removed. The only retained performance change is deferring the preference write by 200ms, so storage is not written for every movement. No transform preview or new interaction is introduced. Physical Android feel still needs device verification.

The translation icon uses the exact two filled vector outlines supplied by the user in `New Project.svg`; it is not approximated with font glyphs, images or hand-drawn paths. It retains the original 512-unit view box and inherits currentColor.

Optional high/low meem annotations U+06E2 and U+06ED are hidden at display time by explicit user preference (0.4.10). Ordinary meem U+0645, vowels, superscript alef and source data remain unchanged. Corpus regression checks cover both annotations in all 114 surahs.

Navigation to a word/root occurrence or ayah now leaves a fully exposed target unchanged. Hidden or partially obscured targets align 12px below the top of the actual reading window, accounting for the visual viewport, overlay sheet, update notice and player where they overlap the target. Tail space permits the same alignment for final ayahs. A mounted Mushaf target no longer resets the page before checking visibility. This replaces both the selection-centering and search-position formulas.


## Whole-ayah navigation (0.4.19)

Ayah navigation and recitation following measure the complete ayah, rather than only word one. Flow bounds include its marker and displayed translation fragments. Mushaf bounds combine all rendered word boxes and the closing ayah marker. A fully exposed ayah stays still. A partially hidden ayah that fits moves only enough to reveal the obscured edge, with margins reduced when necessary to fit. A completely offscreen ayah starts at the exposed top. An ayah taller than the available area starts at the top without changing font size; simultaneous full visibility is impossible in that case. Root/word-occurrence navigation retains its word-based visibility rule. Overlay geometry, reader-only scrolling and end-of-document spacer handling are shared.
