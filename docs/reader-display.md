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

## Font calibration and mode memory

Both surfaces use `readerFontSize` (22px at 100%). Mushaf never silently fits
the font downward: fixed source lines expand their page's width and the local
RTL horizontal scroll container exposes the full line. Vertical virtualization
and source line grouping remain unchanged; the application itself does not
overflow horizontally.

`useReaderPresentation` owns independent scales under the append-only
`mushaf.scales.v1` key (`{mushaf, flow}`). Missing values migrate from the existing
`mushaf.scale`; that legacy key retains the last edited value for compatibility.
Changing mode selects its remembered value without overwriting the other one.
Slider, settings buttons, pinch and Ctrl/wheel all update the active mode.
Persistence happens after the edit, without a delayed write that could outlive
a quick mode change. `reader-font-memory.spec.cjs` checks rendered pixel sizes,
mode round trips, reload, and local horizontal overflow at large font sizes.
