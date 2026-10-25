# Recitation playback

The reader has a play button and a compact playback row above the reading
surface. One click starts the current ayah after loading and opens the controls;
the toolbar button becomes an animated audio-activity icon while playing. When
paused with the control row collapsed it becomes Play again; reopening the row
resumes playback. Collapsing the row itself never changes transport state. The playback row remains the dedicated transport control,
including play/pause, previous/next ayah and settings. Its close button stops playback. A page load alone never starts audio. The analysis sheet remains independent. Clicking the current ayah label
returns to it; automatic following can be disabled. Choosing a different surah manually stops playback.
After the configured repeats finish, playback continues from ayah 1 of the next
surah; it stops at the end of surah 114. Starting playback with a word/root selected
uses its active ayah and opens the analysis sheet’s verse tab, which then follows
playback. Selecting another word while paused retargets the next explicit play.
Pulling the visible reading surface can navigate surahs even with the analysis
sheet open; touching the sheet still controls the sheet itself.

Available reciters: Muhammad Siddiq al-Minshawi (murattal) and Shahriar Parhizgar.
Minshawi remains the initial default; the chosen reciter persists locally.
Ahmad Dabbagh and Shakernejad still need verified sources. Al-Afasy is not included.

Minshawi source: Quran.com verse recitation API, resource 9. Verified API responses for
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
production recordings. For Minshawi, the environment blocks `verses.quran.com`, so its live
media transport, CORS and audio correctness remain unverified here. Audio requests
fail visibly and can be retried. The environment network draft could not be saved
because its base version is stale; the proposed additional domain is
`verses.quran.com`, preserving all existing domains.

## System controls and background playback

The web player registers Media Session metadata (surah, ayah, reciter and artwork),
play/pause/stop, next/previous ayah, seeking and playback position/rate. Callbacks
use current state, not the ayah that happened to be active when registered. Closing
the player unregisters handlers and clears metadata. Track navigation crosses surah
boundaries to the adjacent ayah. Repeats still apply to normal end-of-audio playback.

Background playback is enabled by default. A persisted option can pause playback
on document visibility loss, including pending loads, without resuming automatically
when the page becomes visible again. Browser/OS support and lifecycle policies still
apply; this cannot keep a browser alive after the OS kills it.

Playing ayahs use the existing continuous verse-selection band in flow and mushaf
views. Individual word/prefix backgrounds are suppressed inside this selection.
The analysis sheet's verse target, translation and statistics track the current ayah.

Media Session registration, metadata, actions, timeline and visibility policy were
exercised in Chromium with real audio decoding of WAV fixtures. This does not verify
physical lock-screen notifications, headphones, background behavior on an Android/iOS
device, or native Android Auto integration. The Android SDK and native media service
are absent here. Android Auto needs an Android MediaLibraryService/MediaSession
with a native player and shared offline storage, not only browser Media Session;
that native integration is not implemented by this web change.

## Parhizgar from Tanzil

Tanzil's public player JavaScript lists `parhizgar` and constructs
`https://tanzil.net/res/audio/parhizgar/SSSAAA.mp3`. The files are already split
per ayah (including basmalah where present); no new timestamp alignment is needed.
The player displays Tanzil attribution and does not bundle these recordings.

The source sends playable MP3 files without fetch CORS headers. The fixed-source
`/api/recitation?r=parhizgar&s=20&a=72` endpoint makes caching/downloads available
on the web. Native clients use the public site's same endpoint, with CORS allowed.
It accepts only this reciter, validates surah and actual ayah bounds, rejects
redirects/HTML responses and limits each response to 4 MiB and 20 seconds. It
never accepts a user-supplied upstream URL. Desktop builds omit API routes as before.
Initial online access therefore needs the deployed endpoint; cached/downloaded
recordings play offline. Reciter-specific cache keys keep each voice and its download
status separate; deleting one reciter's surah does not delete another's.

Actual source validation: Tanzil files 1:1 and 20:72 returned valid MP3; the endpoint's
20:72 SHA-256 matched the direct download. Chromium decoded/played the real Taha72
recording. All 135 ayahs of Taha were downloaded (9,116,544 bytes), then Taha73 was
played with networking disabled. Cached Taha72 was reused during download and
switching reciters showed independent download status. This validates the local
production server, not the live Vercel deployment or an Android device.
