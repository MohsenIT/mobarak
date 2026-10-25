import { recitationUrl, RECITER, type Reciter } from './recitation'
interface AudioEntry { id: string; surah: number; audio: Blob; pinned: boolean; used: number }
const MAX_BYTES = 40 * 1024 * 1024
const MAX_AGE = 7 * 24 * 60 * 60 * 1000
const key = (s: number, a: number,reciter:Reciter) => `${reciter.id}:${s}:${a}`
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('quran-audio-verses', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('verses', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database()
  try { return await new Promise<T>((resolve, reject) => {
    const tx = db.transaction('verses', mode)
    const request = action(tx.objectStore('verses'))
    tx.oncomplete = () => resolve(request.result)
    tx.onabort = tx.onerror = () => reject(tx.error || request.error)
  }) } finally { db.close() }
}
const read = (s: number, a: number,reciter:Reciter) => transact<AudioEntry | undefined>('readonly', store => store.get(key(s,a,reciter)))
async function put(entry: AudioEntry) {
  const db = await database()
  try { await new Promise<void>((resolve,reject) => {
    const tx=db.transaction('verses','readwrite'); const store=tx.objectStore('verses'); const request=store.get(entry.id)
    request.onsuccess=()=>store.put({ ...entry, pinned:entry.pinned || !!request.result?.pinned })
    tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error)
  }) } finally { db.close() }
}
export async function audioDownloadStatus(s: number, total: number,reciter:Reciter=RECITER) {
  const all = await transact<AudioEntry[]>('readonly', store => store.getAll())
  const saved=all.filter(item=>item.surah===s && item.pinned && item.id.startsWith(`${reciter.id}:`))
  return { complete:saved.length===total, count:saved.length, bytes:saved.reduce((sum,item)=>sum+item.audio.size,0) }
}
export async function deleteRecitation(s: number,reciter:Reciter=RECITER) {
  const all = await transact<AudioEntry[]>('readonly', store => store.getAll())
  for (const entry of all.filter(item => item.surah === s && item.id.startsWith(`${reciter.id}:`))) await transact('readwrite', store => store.delete(entry.id))
}
export async function cleanAudioCache() {
  const db=await database()
  try { await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('verses','readwrite'); const store=tx.objectStore('verses'); const request=store.getAll()
    request.onsuccess=()=>{
      const temporary=(request.result as AudioEntry[]).filter(item=>!item.pinned).sort((a,b)=>a.used-b.used)
      let bytes=temporary.reduce((sum,item)=>sum+item.audio.size,0)
      for(const item of temporary) if(Date.now()-item.used>MAX_AGE || bytes>MAX_BYTES){store.delete(item.id);bytes-=item.audio.size}
    }
    tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error)
  }) } finally {db.close()}
}
/** Cache only verses actually requested. Downloaded verses are never evicted by cleanup. */
export async function getVerseAudio(s: number, a: number, signal: AbortSignal, pin = false,reciter:Reciter=RECITER): Promise<{ blob: Blob; saved: boolean }> {
  const existing = await read(s,a,reciter).catch(() => undefined)
  signal.throwIfAborted()
  if (existing && (existing.pinned || Date.now()-existing.used < MAX_AGE)) {
    await put({ ...existing, used: Date.now(), pinned: existing.pinned || pin }).catch(error => { if (pin) throw error })
    return { blob: existing.audio, saved: true }
  }
  const response = await fetch(recitationUrl(s,a,reciter), { signal })
  if (!response.ok || !response.headers.get('content-type')?.match(/audio|octet-stream/i)) throw new Error('download')
  const blob = await response.blob()
  signal.throwIfAborted()
  if (!blob.size) throw new Error('empty-audio')
  let saved = false
  try { await put({ id:key(s,a,reciter), surah:s, audio:blob, used:Date.now(), pinned:pin }); saved = true }
  catch (error) { if (pin) throw error }
  if(saved && !pin) await cleanAudioCache().catch(()=>{})
  return { blob, saved }
}
export async function downloadRecitation(s: number, total: number, signal: AbortSignal, progress: (done: number) => void,reciter:Reciter=RECITER) {
  // Sequential requests keep mobile bandwidth/memory bounded and resume partial downloads.
  for (let a=1; a<=total; a++) { signal.throwIfAborted(); await getVerseAudio(s,a,signal,true,reciter); progress(a) }
  await navigator.storage?.persist?.().catch(() => false)
}
