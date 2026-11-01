export type SujudKind = 'obligatory' | 'recommended'
const obligatory = new Set(['32:15','41:38','53:62','96:19'])
const recommended = new Set(['7:206','13:15','16:49','17:109','19:58','22:18','25:60','27:26','38:24','84:21'])
export const sujudKind = (surah:number, ayah:number): SujudKind | null => obligatory.has(`${surah}:${ayah}`) ? 'obligatory' : recommended.has(`${surah}:${ayah}`) ? 'recommended' : null
