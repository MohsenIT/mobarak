# Android Auto audio

The Android APK includes a native Media3 `MediaLibraryService`, independent of the WebView lifecycle. `scripts/configure-android-auto.mjs` installs the Java source, Android manifest declarations, pinned Media3 dependencies and generated catalogue after every `tauri android init`. Local Android builds must run this script between init and build; the release workflow does so automatically.

The media browser exposes all 22 verified reciter recordings, all 114 Arabic surah names, and each selectable ayah. Selecting an ayah builds the whole surah queue and begins at that ayah; previous/next move between ayahs. Standard media controls provide play/pause/seek. Three passive media-session actions toggle repeat-one, repeat-surah, and playback speeds 0.75/1/1.25/1.5. Availability and placement of custom actions are decided by the car host. Arabic/Persian surah-name search is exposed through the media-library search API and play-from-search intent. Last selection, position, repeat and speed survive service recreation; the root includes a resume item. Audio focus handles calls and competing audio, headphone removal pauses, and a foreground media notification supports background playback.

Only IDs from the bundled catalogue resolve into audio URLs. External controllers cannot inject arbitrary playback URLs. Quran text and labels are bundled; audio requires internet. This native queue does not consume the WebView's IndexedDB downloads, and phone-web playback preferences are separate in this first version. No APK signing key or account credentials enter the catalogue.

The now-playing metadata contains Arabic surah name, localized verse number, reciter and verse text as subtitle. Android Auto controls which metadata it shows and may truncate subtitles. This is a media app, not a full Quran reading/editor app on the car display. The phone retains the complete reader and study notebook. No claim is made that all reading, editing and search UI can be mirrored into Android Auto.

UI labels come from the existing language catalogues and Android locale, defaulting to Persian. Arabic Quran titles are never translated. The generator validates 114 surahs/6236 verses and source IDs; a fixture test verifies regeneration does not duplicate manifest or Gradle entries.

## Validation and installation

Run `node --test scripts/configure-android-auto.test.mjs`. Native Java and manifest must also compile against the pinned Android dependencies before publishing. A compiled test fixture is not the signed Tauri release APK. Physical phone/car playback, interruptions and host layouts still require device testing.

Production discovery depends on Android Auto distribution and eligibility rules. A sideloaded APK is not guaranteed to appear automatically. For developer testing use Android Auto developer options and the Desktop Head Unit with a development installation; distribution through a supported Google Play testing/release track is the production path. Installing this APK does not install Android Automotive OS, and no Automotive-specific activity is declared.

Native Auto source/configuration pushes to main trigger the installer workflow immediately; the daily schedule remains as a fallback. Publishing still requires a successful signed build.
