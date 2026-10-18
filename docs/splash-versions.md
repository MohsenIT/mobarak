# Splash checkpoints

- **نسخه سیب / Sib**: tag `splash-sib`, commit `fc657e2`. Static splash with a large centered logo, title below the logo, Bismillah above, verse below; minimum one second, then a 180 ms fade.
- The next revision matches the supplied Android screenshot: smaller 128 CSS px icon canvas, center offset -10 px, 24px system-font title at the bottom. Browser viewport excludes the status and navigation bars.

To return only the splash layout to Sib, restore the startup CSS block and `src/components/quran/StartupSplash.tsx` from `splash-sib`. Also restore theme-color timing if needed; preserve unrelated changes in `page.tsx`. The tag records the complete prior state without rewriting history.
