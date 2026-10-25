/** Verified ayah sources; each recording keeps its own cache identity. */
export const RECITERS = [
  { id:'minshawi-murattal',name:'محمد صدیق منشاوی',source:'Quran.com',sourcePage:'https://quran.com/' },
  { id:'parhizgar',name:'شهریار پرهیزگار',source:'تنزیل',sourcePage:'https://tanzil.net/' },
] as const
export type Reciter = typeof RECITERS[number]
export const RECITER: Reciter = RECITERS[0]
export const AUDIO_ORIGIN = 'https://verses.quran.com'
export function recitationSourceUrl(surah:number,ayah:number,reciter:Reciter=RECITER) {
  if(!Number.isInteger(surah)||surah<1||surah>114||!Number.isInteger(ayah)||ayah<1||ayah>286)throw new Error('invalid-location')
  const file=`${String(surah).padStart(3,'0')}${String(ayah).padStart(3,'0')}.mp3`
  return reciter.id==='parhizgar'?`https://tanzil.net/res/audio/parhizgar/${file}`:`${AUDIO_ORIGIN}/Minshawi/Murattal/mp3/${file}`
}
export function recitationUrl(surah:number,ayah:number,reciter:Reciter=RECITER) {
  const source=recitationSourceUrl(surah,ayah,reciter)
  // Tanzil serves playable audio without fetch CORS. Our fixed-source endpoint
  // makes explicit downloads and IndexedDB caching work in browsers and native clients.
  if(reciter.id==='parhizgar')return `${process.env.NEXT_PUBLIC_DESKTOP==='1'?'https://quran-vajeh.vercel.app':''}/api/recitation?r=parhizgar&s=${surah}&a=${ayah}`
  return source
}
export interface PlaybackPosition { ayah: number; verseRound: number; surahRound: number }
/** A repeat count of zero means repeat until stopped. */
export function nextRecitation(p: PlaybackPosition, total: number, verseRepeats: number, surahRepeats: number): PlaybackPosition | null {
  if (verseRepeats === 0 || p.verseRound < verseRepeats) return { ...p, verseRound: p.verseRound + 1 }
  if (p.ayah < total) return { ...p, ayah: p.ayah + 1, verseRound: 1 }
  if (surahRepeats === 0 || p.surahRound < surahRepeats) return { ayah: 1, verseRound: 1, surahRound: p.surahRound + 1 }
  return null
}
