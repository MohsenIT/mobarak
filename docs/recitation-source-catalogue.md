# Verified ayah audio sources — 2026-10-25

Scope: the complete Tanzil reciter catalogue retrieved from https://tanzil.net/dist/tanzil.js?v106437 (`reciteList`). This is not an exhaustive worldwide catalogue. Quran.com metadata was also retrieved from https://api.qurancdn.com/api/v4/resources/recitations .

Each listed Tanzil collection returned HTTP 206 and `audio/mpeg` for range requests to 001001, 020072 and 114006. This samples beginning/middle/end; it does not verify every one of the 6,236 ayah files. Tanzil uses separate ayah MP3 files. The existence of a second recording does not imply a different reader. Nationality/recording identity still need independent profile verification before adding new UI entries.

| Provider ID | Provider name | Sample |
|---|---|---|
| `abdulbasit` | AbdulBasit | https://tanzil.net/res/audio/abdulbasit/020072.mp3 |
| `basfar` | Basfar | https://tanzil.net/res/audio/basfar/020072.mp3 |
| `basfar2` | Basfar II | https://tanzil.net/res/audio/basfar2/020072.mp3 |
| `ajamy` | Al-Ajamy | https://tanzil.net/res/audio/ajamy/020072.mp3 |
| `ghamadi` | Al-Ghamadi | https://tanzil.net/res/audio/ghamadi/020072.mp3 |
| `hudhaify` | Al-Hudhaify | https://tanzil.net/res/audio/hudhaify/020072.mp3 |
| `husary` | Al-Husary | https://tanzil.net/res/audio/husary/020072.mp3 |
| `minshawi` | Al-Minshawi | https://tanzil.net/res/audio/minshawi/020072.mp3 |
| `shateri` | Ash-Shateri | https://tanzil.net/res/audio/shateri/020072.mp3 |
| `shuraim` | Ash-Shuraim | https://tanzil.net/res/audio/shuraim/020072.mp3 |
| `sudais` | As-Sudais | https://tanzil.net/res/audio/sudais/020072.mp3 |
| `tablawi` | At-Tablawi | https://tanzil.net/res/audio/tablawi/020072.mp3 |
| `hani` | Ar-Rafai | https://tanzil.net/res/audio/hani/020072.mp3 |
| `akhdar` | Al-Akhdar | https://tanzil.net/res/audio/akhdar/020072.mp3 |
| `muaiqly` | Al-Muaiqly | https://tanzil.net/res/audio/muaiqly/020072.mp3 |
| `afasy` | Al-Afasy | https://tanzil.net/res/audio/afasy/020072.mp3 |
| `ayyub` | Muhammad Ayyub | https://tanzil.net/res/audio/ayyub/020072.mp3 |
| `jibreel` | Muhammad Jibreel | https://tanzil.net/res/audio/jibreel/020072.mp3 |
| `parhizgar` | Parhizgar | https://tanzil.net/res/audio/parhizgar/020072.mp3 |
| `bukhatir` | Bukhatir | https://tanzil.net/res/audio/bukhatir/020072.mp3 |
| `qasim` | Al-Qasim | https://tanzil.net/res/audio/qasim/020072.mp3 |
| `juhany` | Al-Juhany | https://tanzil.net/res/audio/juhany/020072.mp3 |
| `matrood` | Al-Matrood | https://tanzil.net/res/audio/matrood/020072.mp3 |

Excluded from the murattal list: `abdulbasit-mjwd`, `husary-mjwd`, `minshawi-mjwd` (mujawwad recordings). `basfar2` is a second Basfar recording, not another reader. Al-Afasy is available upstream but must not be added to the application, per the user decision. Ahmad Dabbagh and Shakernejad are not in this catalogue; no full ayah-by-ayah source is verified for them yet.

Application status remains two selectable readers: Minshawi and Parhizgar. All 135 Taha ayahs for Parhizgar were previously downloaded and offline-tested. This research does not download all recordings, add reciters to the app, or prove all source files exist.
