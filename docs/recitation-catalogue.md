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
| احمد العجمی | [تنزیل](https://tanzil.net/) | Yes |
| سعد الغامدی | [تنزیل](https://tanzil.net/) | Yes |
| علی عبدالرحمن الحذیفی | [تنزیل](https://tanzil.net/) | Yes |
| محمود خلیل الحصری | [تنزیل](https://tanzil.net/) | Yes |
| ابوبکر الشاطری | [تنزیل](https://tanzil.net/) | Yes |
| سعود الشریم | [تنزیل](https://tanzil.net/) | Yes |
| عبدالرحمن السدیس | [تنزیل](https://tanzil.net/) | Yes |
| محمد محمود الطبلاوی | [تنزیل](https://tanzil.net/) | Yes |
| هانی الرفاعی | [تنزیل](https://tanzil.net/) | Yes |
| ابراهیم الاخضر | [تنزیل](https://tanzil.net/) | Yes |
| ماهر المعیقلی | [تنزیل](https://tanzil.net/) | Yes |
| محمد ایوب | [تنزیل](https://tanzil.net/) | Yes |
| محمد جبریل | [تنزیل](https://tanzil.net/) | Yes |
| صلاح بوخاطر | [تنزیل](https://tanzil.net/) | Yes |
| عبدالمحسن القاسم | [تنزیل](https://tanzil.net/) | Yes |
| عبدالله عواد الجهنی | [تنزیل](https://tanzil.net/) | Yes |
| عبدالله المطرود | [تنزیل](https://tanzil.net/) | Yes |

All 22 registered recording entries now have local portraits (21 people; Basfar has two recordings). Nine missing portraits were added from named Assabile profiles and Commons; attribution/source URLs remain in reciter-portraits-LICENSE.txt. No new playback source was added by this image change.

## Release0.4.25
25 recording entries now have separate cache IDs and portraits. EveryAyah adds KarimMansoori40kbps, KhalifaAlTunaiji64kbps and MinshawiMujawwad64kbps; Persian calls the last style «تحقیق» and Arabic «مجوّد». Index coverage is6236 canonical verses per source; only001001,020072,114006 were downloaded and probed. Existing MinshawiMurattal and Basfar recording IDs remain unchanged. Persian Fooladvand/Hedayatfar and Makarem/Kabiri retain their Tanzil cache IDs; each001001 file is byte-identical to the corresponding EveryAyah named translation source. The web player now plays translation after Arabic within each verse/repeat and can pin translation separately.
MustafaIsmail's EveryAyah set is incomplete and is not registered as a complete recording. Saeedian,Dabbagh,Shakernژad andAbolghasemi still lack a confirmed complete ayah source. No paid service is used.
