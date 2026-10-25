# Recitation playback

The reader has a headphone button and a compact playback row above the reading
surface. The analysis sheet remains independent. Clicking the current ayah label
returns to it; automatic following can be disabled. Choosing a different surah manually stops playback.
After the configured repeats finish, playback continues from ayah 1 of the next
surah; it stops at the end of surah 114. Starting playback with a word/root selected
uses its active ayah and opens the analysis sheet’s verse tab, which then follows
playback. Selecting another word while paused retargets the next explicit play.
Pulling the visible reading surface can navigate surahs even with the analysis
sheet open; touching the sheet still controls the sheet itself.

Initial reciter: Muhammad Siddiq al-Minshawi, murattal. The requested next priorities
are Ahmad Dabbagh, then Shakernejad and Parhizgar. They are not selectable until
matching, verified recordings are available. Al-Afasy is not included.

Source: Quran.com verse recitation API, resource 9. Verified API responses for
chapters 1 and 20 provide `Minshawi/Murattal/mp3/SSSAAA.mp3` verse paths.
Example metadata: https://api.qurancdn.com/api/v4/recitations/9/by_chapter/20?per_page=300
Playback URLs use https://verses.quran.com/ . No secret or account is needed.

- Previous/next ayah, pause/resume, starting ayah, speed 0.75–2×.
- Separate per-ayah and whole-surah repetition: 1, 2, 3, 5, 10, or until stopped.
  A session beginning midway repeats the remaining verses first, then starts the
  next whole-surah pass from ayah 1. After the final pass it advances to the next surah. Repeating the same ayah reuses its loaded audio.
- Speed, repeat counts and following preferences persist locally.
- Only the requested ayah is fetched; online playback does not download the entire
  surah. Successful requests are cached in IndexedDB for seven days, up to 40 MiB,
  with least-recently-used eviction. Browser HTTP caching may also apply.
- Explicit surah downloads pin each verse separately, reuse already cached verses,
  and resume after interruption. Progress is by ayah. Partial downloads can be
  deleted. Pinned audio is excluded from temporary-cache eviction and expiry.
- Downloaded audio works offline. Browser/app data deletion removes it. As with
  other browser storage, the browser can reclaim data; persistent-storage permission
  is requested after downloads. A full downloaded state requires every verse stored.
- No audio is added to the APK's initial bundle. Browser media/background behavior
  varies; real Android/iOS device behavior has not yet been verified.

Validation uses actual browser audio decoding with generated WAV fixtures served
at the remote URLs, deterministic ended events, IndexedDB persistence, disconnected
network playback, and mobile layout checks. It does not substitute for listening to
production recordings. The environment currently blocks `verses.quran.com`, so live
media transport, CORS and audio correctness remain unverified here. Audio requests
fail visibly and can be retried. The environment network draft could not be saved
because its base version is stale; the proposed additional domain is
`verses.quran.com`, preserving all existing domains.
