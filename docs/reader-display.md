# Reader display quick access

The toolbar eye opens `ReaderDisplayMenu`, a non-modal Radix popover with
collision handling, Escape/outside dismissal, and focus restoration. It uses
the application's existing theme tokens in both paper and night themes.

`ReaderDisplayControls` shares the mode and font controls with `SettingsScreen`.
Mode changes still call `page.tsx`'s `switchMode` and `useReadingRoute`; translation
visibility and font scale still belong to `useReaderPresentation`. No new storage
keys or parallel navigation state are introduced. The quick translation switch
uses the existing Arabic ayn/Latin A icon; the toolbar trigger uses an eye.

The native range input supports keyboard and touch and uses the existing
`reader-settings` limits. Browser coverage in `reader-display.spec.cjs` checks
viewport bounds, preferences after reload, shared settings, route preservation,
and Escape/focus behavior. Existing reading-mode and scale tests cover the
settings placement.
