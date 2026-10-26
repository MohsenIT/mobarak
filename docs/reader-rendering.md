# Reader rendering safeguards

Quran text is stored verbatim. `quranDisplayText` is only a presentation adapter for the bundled Hafs font. Its previous broad removal of U+06D6–U+06ED and U+0670 incorrectly hid superscript alef and small waw/yeh, among other pronunciation marks. It now removes only the explicitly listed standalone pause/section symbols. The existing narrowly scoped sakin-sin hamza-seat compatibility rule remains. Whole-corpus tests check preservation of yeh, alef maqsura, superscript alef and the small letters/reading signs.

In Saffat 37:75, `نَادَىٰنَا` contains alef maqsura and superscript alef, not an ordinary dotted yeh. Restoring its superscript alef is correct; adding two dots would change the writing. The ordinary yeh in 37:76 `وَنَجَّيْنَـٰهُ` is preserved independently.

Pinch interaction uses `useReaderPinch` with a `data-pinch-content` surface inside each reading scroller. During the gesture, a single animation-frame callback changes only a CSS transform. React font state and translation geometry are not updated for each touchmove. Reflow is committed once at gesture end, retaining the preview until layout commits and anchoring the same word through the translated-mushaf height measurements. A new touch, pointer or wheel interaction releases the short anchoring period; cancellation restores the original view. Listeners are nonpassive for a two-finger gesture, single-finger reading remains available, and accidental post-pinch word clicks are suppressed briefly. Font limits remain 55–190%; storage is deferred until the gesture has committed.

Browser checks use touch events and fourfold CPU throttling in flow/mushaf, with and without translation. These checks exercise compositor preview without changing the stored font size, commit, anchor stability and cancellation. They do not establish physical Android performance.

The translation icon uses the exact two filled vector outlines supplied by the user in `New Project.svg`; it is not approximated with font glyphs, images or hand-drawn paths. It retains the original 512-unit view box and inherits currentColor.
