# Ayah recitation catalogue

Sources are explicitly registered in `public/data/recitation-sources.json`; profiles are separate in `public/data/resources.json`. The 20 additional entries come from the published `reciteList` in https://tanzil.net/dist/tanzil.js?v106437 (checked 2026-10-26). Existing Minshawi and Parhizgar IDs and cache identities remain unchanged. Mishary Alafasy remains excluded by user preference. Ahmed Dabbagh and Hamed Shakernejad have not been added without a verified complete ayah source.

Each new directory was probed at 001001, 020072 and 114006. This checks sample availability, not all 6,236 recordings. A second Basfar recording is labelled separately; it is not a second person. Audio remains online by default; a surah is pinned only by explicit download and recordings use separate reciter cache IDs.

The audio proxy accepts only registered reciter IDs and valid surah/ayah pairs. It constructs the source URL itself, rejects redirects and non-audio responses, and caps a response at 4 MiB. No caller-supplied origin or directory is accepted. Tanzil audio flows through this endpoint for browser/native caching compatibility; it is not bundled in the initial app.

Portraits are local assets shared by picker and profile, with a neutral icon when no verified image is available or loading fails. The incorrectly labelled Ahmad Ali Hudhaifi image was excluded because it does not identify Ali Abdulrahman Hudhaifi. Collection attribution is retained in `reciter-portraits-LICENSE.txt`; these metadata are not added to the user-facing profile. Pictures are included in the core offline manifest and handled by the startup service worker.

## Registered recordings

| Recording | Audio source | Local portrait |
| --- | --- | --- |
| محمد صدیق منشاوی | [Quran.com](https://quran.com/) | Yes |
| شهریار پرهیزگار | [تنزیل](https://tanzil.net/) | Yes |
| عبدالباسط عبدالصمد | [تنزیل](https://tanzil.net/) | Yes |
| عبدالله بصفر | [تنزیل](https://tanzil.net/) | Yes |
| عبدالله بصفر — ضبط دوم | [تنزیل](https://tanzil.net/) | Yes |
| احمد العجمی | [تنزیل](https://tanzil.net/) | Not available |
| سعد الغامدی | [تنزیل](https://tanzil.net/) | Not available |
| علی عبدالرحمن الحذیفی | [تنزیل](https://tanzil.net/) | Not available |
| محمود خلیل الحصری | [تنزیل](https://tanzil.net/) | Not available |
| ابوبکر الشاطری | [تنزیل](https://tanzil.net/) | Yes |
| سعود الشریم | [تنزیل](https://tanzil.net/) | Yes |
| عبدالرحمن السدیس | [تنزیل](https://tanzil.net/) | Yes |
| محمد محمود الطبلاوی | [تنزیل](https://tanzil.net/) | Not available |
| هانی الرفاعی | [تنزیل](https://tanzil.net/) | Yes |
| ابراهیم الاخضر | [تنزیل](https://tanzil.net/) | Yes |
| ماهر المعیقلی | [تنزیل](https://tanzil.net/) | Yes |
| محمد ایوب | [تنزیل](https://tanzil.net/) | Yes |
| محمد جبریل | [تنزیل](https://tanzil.net/) | Yes |
| صلاح بوخاطر | [تنزیل](https://tanzil.net/) | Not available |
| عبدالمحسن القاسم | [تنزیل](https://tanzil.net/) | Not available |
| عبدالله عواد الجهنی | [تنزیل](https://tanzil.net/) | Not available |
| عبدالله المطرود | [تنزیل](https://tanzil.net/) | Not available |
