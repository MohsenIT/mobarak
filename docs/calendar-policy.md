# Date display and Android system bars

Date-only release metadata stays in ISO Gregorian form. Only display changes: parse strictly, format at UTC noon in the chosen calendar, and render an unchanged ISO `time[datetime]` so the release date never shifts with device timezone.

Settings → Date and calendar stores an explicit choice in `mubarak.calendar.v1`. Automatic is the default. It first honours an explicit Unicode `u-ca-*` device-locale calendar. Otherwise Persian UI, Iran or Afghanistan select the Persian Solar Hijri calendar. For this Quran app, Arabic UI or an Arab-region locale selects lunar Hijri: Umm al-Qura in Saudi Arabia, calculated civil Hijri elsewhere. This is an explicit product preference requested for the Quran app, not a claim that all Arab countries use Hijri for civil administration. Other locales follow the platform's CLDR-backed default (Gregorian in Western locales, Buddhist in Thailand, etc.). The app language controls month names/digits; the device locale supplies region. A manual choice always overrides automatic.

The UI also offers explicit Persian, the two Hijri variants, Gregorian, Buddhist, Ethiopic, Hebrew, Indian national and Japanese era calendars. A preview and release history update immediately; preferences survive restart. Unsupported calendar formatting falls back to Gregorian rather than failing the history dialog. Source dates and historical bibliographic metadata are not rewritten.

Android system-bar icons previously inherited a light-foreground choice while the app's paper theme was light. `QuranSystemBars` uses `WindowInsetsControllerCompat`: dark icons for paper, light for night. It restores the persisted theme before the WebView is ready and on activity resume; the trusted main-frame bridge receives only the two valid theme IDs. It does not start playback or change insets. Edge-to-edge Android can ignore bar background colours; icon appearance is set directly rather than relying on those colours.

The reveal spacer used to keep its maximum height after a bottom sheet closed. The reader now removes it when no bottom overlay covers the reading window, including when playback controls disappear or the viewport changes. While an overlay is present, existing reveal behavior stays available. The browser regression recreates the stale spacer left by the previous version, closes the real sheet and checks that the end gap is under 100px.

Primary references:
- https://unicode.org/reports/tr35/tr35-dates.html#Calendar_Preference_Data
- https://developer.android.com/develop/ui/views/layout/edge-to-edge#system-bar-icons
