/** Verse URLs supplied by Quran.com's recitation API (resource 9). */
export const RECITER = { id: 'minshawi-murattal', name: 'محمد صدیق منشاوی', resource: 9 } as const
export const AUDIO_ORIGIN = 'https://verses.quran.com'
export function recitationUrl(surah: number, ayah: number) {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1 || ayah > 286) throw new Error('invalid-location')
  return `${AUDIO_ORIGIN}/Minshawi/Murattal/mp3/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`
}
export interface PlaybackPosition { ayah: number; verseRound: number; surahRound: number }
/** A repeat count of zero means repeat until stopped. */
export function nextRecitation(p: PlaybackPosition, total: number, verseRepeats: number, surahRepeats: number): PlaybackPosition | null {
  if (verseRepeats === 0 || p.verseRound < verseRepeats) return { ...p, verseRound: p.verseRound + 1 }
  if (p.ayah < total) return { ...p, ayah: p.ayah + 1, verseRound: 1 }
  if (surahRepeats === 0 || p.surahRound < surahRepeats) return { ayah: 1, verseRound: 1, surahRound: p.surahRound + 1 }
  return null
}
