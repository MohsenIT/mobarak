# Introduction at /about

The Persian editorial presentation was supplied as `Mobarak-Introduction-v4.html`.
Its ten slides, copy, original embedded screenshots and visual styling are
preserved in `public/about/`. Next rewrites `/about` to its standalone
`index.html`, keeping the supplied document isolated from reader global styles,
React providers and reader state. The file also works at `/about/index.html`.
It is an authored Persian document, rather than a localized application panel.

Embedded image bytes were extracted unchanged into eighteen local files. Local
Vazirmatn fonts replace Google Fonts; screenshots have intrinsic dimensions,
lazy loading and an eager opening image. Metadata includes a canonical URL,
description and social preview. The original style sheet is separated from
small technical refinements for fixed navigation, safe areas and keyboard focus.

`presentation.js` enhances the document with native buttons, keyboard handling
and directional touch gestures. Space on a focused button retains native
activation, vertical scrolling does not change slides, and screen-reader focus
and the live counter follow the current slide. Without JavaScript, all slides
remain readable and inactive navigation is hidden.

The service worker gives the introduction its own document fallback and caches
visited `/about/` assets. It must never replace the reader or study document.
Coverage: `src/lib/document-shells.test.ts` and
`tests/e2e/about-presentation.spec.cjs`, including an offline reader/about round
trip. Quran data, the reader UI and reading/history state are unchanged.
