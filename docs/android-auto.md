# Android Auto audio

The Android APK includes a native Media3 `MediaLibraryService`, independent of the WebView lifecycle. `scripts/configure-android-auto.mjs` installs the Java source, Android manifest declarations, pinned Media3 dependencies and generated catalogue after every `tauri android init`. Local Android builds must run this script between init and build; the release workflow does so automatically.

The media browser exposes all 22 verified reciter recordings, all 114 Arabic surah names, and each selectable ayah. Selecting an ayah builds the whole surah queue and begins at that ayah; previous/next move between ayahs. Standard media controls provide play/pause/seek. Three passive media-session actions toggle repeat-one, repeat-surah, and playback speeds 0.75/1/1.25/1.5. Availability and placement of custom actions are decided by the car host. Arabic/Persian surah-name search is exposed through the media-library search API and play-from-search intent. Last selection, position, repeat and speed survive service recreation; the root includes a resume item. Audio focus handles calls and competing audio, headphone removal pauses, and a foreground media notification supports background playback.

Only IDs from the bundled catalogue resolve into audio URLs. External controllers cannot inject arbitrary playback URLs. Quran text and labels are bundled; audio requires internet. The reader now hands audio to the same native controller used by Auto. Selected cached verses and explicit full-surah downloads are copied to app-private MP3 files, which the native data source checks when each ayah opens. WebView and native files currently use separate storage copies. Native transient files use a 40 MiB/7-day LRU limit; explicit full-surah downloads are pinned until deletion. Existing pre-bridge downloads must be downloaded/imported again for native offline playback; opening a cached ayah imports that ayah. No APK signing key or account credentials enter the catalogue.

The now-playing metadata contains Arabic surah name, localized verse number, reciter and verse text as subtitle. Android Auto controls which metadata it shows and may truncate subtitles. This is a media app, not a full Quran reading/editor app on the car display. The phone retains the complete reader and study notebook. No claim is made that all reading, editing and search UI can be mirrored into Android Auto.

UI labels come from the existing language catalogues and Android locale, defaulting to Persian. Arabic Quran titles are never translated. The generator validates 114 surahs/6236 verses and source IDs; a fixture test verifies regeneration does not duplicate manifest or Gradle entries.

## Validation and installation

Run `node --test scripts/configure-android-auto.test.mjs`. Native Java and manifest must also compile against the pinned Android dependencies before publishing. A compiled test fixture is not the signed Tauri release APK. Physical phone/car playback, interruptions and host layouts still require device testing.

Production discovery depends on Android Auto distribution and eligibility rules. A sideloaded APK is not guaranteed to appear automatically. For developer testing use Android Auto developer options and the Desktop Head Unit with a development installation; distribution through a supported Google Play testing/release track is the production path. Installing this APK does not install Android Automotive OS, and no Automotive-specific activity is declared.

Native Auto source/configuration pushes to main trigger the installer workflow immediately; the daily schedule remains as a fallback. Publishing still requires a successful signed build.


## Phone playback bridge (0.4.13)

The previous native catalogue alone did not connect the phone's HTML audio transport to the Android service. The reader now uses a native audio adapter only when the trusted WebView bridge exists; browser playback and navigator.mediaSession remain the browser path. The bridge is injected in MainActivity.onWebViewCreate, accepts only the main frame at the two local Tauri origins, and communicates through AndroidX WebKit messages. It binds a MediaController to the existing MediaLibraryService. The same session then owns foreground playback, metadata, phone/lock-screen controls and Auto playback. Native state returns ayah/reciter/play/pause/rate changes to the reader, without restarting a track on a native transition.

Activity destruction releases the controller bridge without stopping the service. TauriActivity.onDestroy is final; cleanup uses Application.ActivityLifecycleCallbacks instead of overriding it. The published 0.2.9 APK was inspected with aapt2/dexdump to verify service metadata and the real activity superclass API.

Native repetition counts match the reader's finite/infinite verse and surah settings; the service advances to the next surah after the configured rounds. MP3 imports validate catalogue IDs, source bounds, size and MP3 headers and write atomically inside app-private storage. Arbitrary external URLs and remote/subframe bridge calls are not accepted.

Fixture compilation includes generated Kotlin activity hooks, Java bridge, service, dependencies and Android lint. Browser integration uses a simulated native controller to verify app play never starts HTML audio, app pause reaches the controller, and native play/next events update the reader. These checks do not establish that a physical phone's notification or Auto launcher works.

For an APK installed from GitHub, Android Auto's developer setting "Unknown sources" may be required before it appears in the app list. Validate that setting separately from playback; the presence of media metadata inside an APK does not prove launcher visibility. Keep installation/discovery claims conditional until a phone/car test succeeds.


## Task-based browsing (0.4.15)

The car host receives three root categories: Home, Surahs and Library, rather than a tab for every reciter. Home offers resume with the actual surah/ayah/reciter, the eight most recent reciter/surah combinations, direct ayah selection for the current surah, and a separate change-reciter entry. Surahs are immediately playable: one selection queues the whole surah at ayah one. Library contains change-reciter, optional start-from-ayah browsing, and complete pinned downloads for the selected reciter. Partial downloads and transient cached ayahs are excluded. Selecting a new reciter keeps the selected surah and ayah and begins that recording at its start, rather than using a timestamp from another reciter. Resume preserves the current or saved playback position. Old r/ and s/ browse IDs remain resolvable for car hosts with cached entries.

Arabic verse text is supplied as subtitle and description; the host controls rendering and truncation. The new structure does not add a full scrollable Quran document, highlighting, editing or phone UI mirroring. Recent playback is stored natively on this installation; this is not account synchronization. Full pinned downloads made through the phone are refreshed after completion/deletion. Custom repeat/speed action placement remains host-dependent.

`android-auto/tests/QuranCarNavigationTest.java` runs with JUnit 4.13.2 and Robolectric 4.14.1 in an Android Gradle fixture containing the generated catalogue, service and bridge. Enable unitTests.isIncludeAndroidResources, SDK 28, and the normal proxy/CA for Robolectric dependencies. It checks the actual service hierarchy, direct surah queues, optional ayah lists, reciter switches, resume positions and complete-download filtering. These simulated Android tests supplement compilation/lint; they do not establish a physical car layout.


## Surah cover artwork (0.4.16)

All 114 surahs have bundled 512px PNG covers generated from the original Arabic surah titles, bundled Hafs font and app branding (`scripts/build-surah-artwork.cjs`, Playwright/Chromium required only for regeneration). Browser Media Session uses the corresponding same-origin PNG. Native verse, surah and resume metadata use a stable content URI for the same cover, so large artwork bytes are not repeated in every ayah of a long queue. Source MP3 ID3 artwork is disabled in the native extractor to avoid a recording provider's embedded logo replacing the selected cover.

`QuranArtworkProvider` intentionally exposes only the bundled, nonprivate covers to external media hosts. The exported provider accepts read-only requests for `/surah/001.png` through `/surah/114.png`, validates the authority, rejects query strings/fragments/other paths and has no write/update/delete API. It does not expose audio, settings, credentials or arbitrary filesystem paths. It serves from a bounded cache copied from APK assets, so car artwork works without internet. Physical car host caching/rendering still requires device validation.


## App language and launcher branding (0.4.17)

Native menu labels and numeric formatting follow the app's saved UI language rather than the device locale. Mounting the UI-language hook sends the restored/default language through the trusted main-frame bridge even when no audio controls are open. Subsequent language changes are sent as well. The service persists that language, defaults to Persian before the first phone session, uses the shared numbering-system catalogue and refreshes subscribed browse entries, action labels and queued media metadata. Metadata replacement keeps media IDs, audio sources, current queue index and position. Host-owned Android Auto chrome still uses the host/device language; Arabic Quran names/text are source content.

The bridge validates supported language codes and the native configureLanguage command is restricted to this app's controller. A language arriving before controller connection is retained and applied on connection. The frontend ignores an unsupported-command response from older native bridges so browser/app language selection remains usable. This is not proof that every car host refreshes already-cached labels immediately; reconnect if necessary.

The actual 0.2.14 APK contained Tauri's placeholder launcher, despite the correct app icons existing under src-tauri/icons. After every Android init, the generator now installs the branded legacy icons in all five densities and a padded adaptive icon using the existing original app logo. Its manifest icon is explicitly set to that resource. Generator tests compare copied icon bytes and check adaptive resources; Android compilation/lint validate the resources. Verify the signed APK resources and test actual car launcher caching before asserting device rendering.

## Study library and explicit playback choices (0.4.20)

Home and Library now expose the phone's reading position, favorite ayahs, named surah playlists and playback settings. The trusted phone bridge stores validated local operations in native preferences; reading-position updates and playlist edits never start audio. Private browse entries and mutations require the app, a trusted controller or Android Auto. A personal playlist queues one surah at a time, advances in order and stops after the last entry.

Speed and repeat choices are explicit, with current-choice check marks. The session's repeat action switches between three plays and no repetition; its label describes the next action. A separate normal-playback action restores speed 1, disables verse/surah repetition, practice ranges and inter-ayah gaps. It resumes an automatic practice gap but preserves an explicit pause. Favorites use standard star icons. Per-item browse actions depend on host support; the phone's playback settings expose the same choices.

Practice ranges start at the current ayah (next five, ten or to the surah end), with three plays per ayah, three rounds and a five-second gap. These choices can be changed separately. Explicit pause/seek cancels a pending automatic resume. Sleep timers stop after 15/30/60 minutes or the current surah/range; a normal-playback reset intentionally leaves the timer and optional translation choice unchanged.

Optional recorded Persian translations use Tanzil's `fa.fooladvand` and `fa.makarem` sources. These are translator labels, not asserted narrator identities. Source URLs were confirmed against the official player's source catalogue and sample MP3s at 1:1, 20:72 and 114:6. This is not a claim that every recording has been audited. A single native ayah item contains Arabic followed by translation; next/previous and repeat operate on that whole pair. Switching translation restarts the current ayah. The phone can download/import each selected translation separately; offline completeness requires both recitation and translation when enabled. No synthesized speech or paid translation API is used. Native simulated tests and browser bridge tests do not replace a real vehicle test.
