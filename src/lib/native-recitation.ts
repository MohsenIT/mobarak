import {RECITERS} from './recitation'
export type NativePosition={r:string;s:number;a:number}
export type NativePlaybackState={type:'state';connected:boolean;playing:boolean;playWhenReady:boolean;ready:boolean;ended:boolean;position:number;duration:number;speed:number;item?:string;error?:string}
type Bridge={postMessage:(message:string)=>void;onmessage:((event:{data:string})=>void)|null}
declare global{interface Window{QuranNativeAudio?:Bridge}}
let serial=0,bound:Bridge|undefined,connected=false
const pending=new Map<number,{resolve:()=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>(),listeners=new Set<(state:NativePlaybackState)=>void>()
export const nativeRecitationAvailable=()=>typeof window!=='undefined'&&typeof window.QuranNativeAudio?.postMessage==='function'
export function nativeCommand(command:Record<string,unknown>):Promise<void>{
 const bridge=typeof window!=='undefined'?window.QuranNativeAudio:undefined
 if(!bridge)return Promise.reject(new Error('native-unavailable'))
 if(bound!==bridge){bound=bridge;connected=false;bridge.onmessage=event=>{
  let data:Record<string,unknown>;try{data=JSON.parse(event.data)}catch{return}
  if(data.type==='state'){connected=data.connected===true;for(const listener of listeners)listener(data as unknown as NativePlaybackState);return}
  const p=pending.get(Number(data.id));if(!p)return
  clearTimeout(p.timer);pending.delete(Number(data.id));if(data.error)p.reject(new Error(String(data.error)));else p.resolve()
 }}
 const id=++serial
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(new Error('native-timeout'))},20000)
  pending.set(id,{resolve,reject,timer})
  try{bridge.postMessage(JSON.stringify({...command,id}))}catch(error){clearTimeout(timer);pending.delete(id);reject(error instanceof Error?error:new Error('native-failed'))}
 })
}
async function waitForConnection(){
 if(connected)return
 await new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>{listeners.delete(check);reject(new Error('native-not-connected'))},20000)
  const check=(s:NativePlaybackState)=>{if(s.connected){clearTimeout(timer);listeners.delete(check);resolve()}}
  listeners.add(check);void nativeCommand({op:'hello'}).catch(error=>{clearTimeout(timer);listeners.delete(check);reject(error)})
 })
}
export function nativePosition(item?:string):NativePosition|null{
 const m=item?.match(/^v\/([-a-z0-9]+)\/(\d+)\/(\d+)$/)
 if(!m||!RECITERS.some(r=>r.id===m[1]))return null
 const s=Number(m[2]),a=Number(m[3]);return s>=1&&s<=114&&a>=1&&a<=286?{r:m[1],s,a}:null
}
export async function cacheNativeVerse(blob:Blob,position:NativePosition,pin=false){
 if(blob.size<4||blob.size>4*1024*1024)throw new Error('invalid-audio-size')
 const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})
 await nativeCommand({op:'cache',...position,data,pin})
}
/** HTML-audio-shaped transport so the existing reader controls keep their behavior. */
export class NativeRecitationAudio{
 readonly native=true
 state:NativePlaybackState={type:'state',connected:false,playing:false,playWhenReady:false,ready:false,ended:false,position:0,duration:0,speed:1}
 wanted:string|null=null
 private lastPosition=''
 private rate=1
 private revision=0
 private receive=(state:NativePlaybackState)=>{
  if(this.wanted&&state.item&&state.item!==this.wanted){
   if(state.playWhenReady!==this.state.playWhenReady){this.state={...this.state,playing:state.playing,playWhenReady:state.playWhenReady};this.emit(state.playWhenReady?'play':'pause')}
   return
  }
  if(state.item===this.wanted)this.wanted=null
  const old=this.state;this.state=state;this.rate=state.speed
  const position=nativePosition(state.item),key=state.item+':'+state.playing
  if(position&&key!==this.lastPosition){this.lastPosition=key;this.onPosition(position,state)}
  if(state.error&&state.error!==old.error)this.emit('error')
  if(state.ready&&(!old.ready||state.item!==old.item))this.emit('canplay')
  if(!state.ready&&old.ready)this.emit('loadstart')
  if(state.playing!==old.playing)this.emit(state.playing?'play':'pause')
  if(state.speed!==old.speed)this.emit('ratechange')
  this.emit('timeupdate')
 }
 constructor(readonly element:HTMLAudioElement,private onPosition:(position:NativePosition,state:NativePlaybackState)=>void){listeners.add(this.receive);void nativeCommand({op:'hello'}).catch(()=>this.emit('error'))}
 private emit(type:string){this.element.dispatchEvent(new Event(type))}
 expect(position:NativePosition){this.revision++;this.wanted=`v/${position.r}/${position.s}/${position.a}`}
 cancel(position:NativePosition){if(this.wanted===`v/${position.r}/${position.s}/${position.a}`){this.wanted=null;this.revision++}}
 matches(position:NativePosition){return this.state.item===`v/${position.r}/${position.s}/${position.a}`&&!this.wanted&&!this.state.error}
 async prepare(blob:Blob,position:NativePosition,play:boolean|(()=>boolean),verse:number,surah:number,signal?:AbortSignal){
  this.expect(position);const revision=this.revision;this.emit('loadstart');await waitForConnection();await cacheNativeVerse(blob,position)
  if(signal?.aborted||this.revision!==revision)return
  await nativeCommand({op:'speed',value:this.rate});await nativeCommand({op:'repeat',verse,surah});if(signal?.aborted)return;await nativeCommand({op:'select',...position,play:typeof play==='function'?play():play})
 }
 configure(verse:number,surah:number){void waitForConnection().then(()=>nativeCommand({op:'repeat',verse,surah})).catch(()=>this.emit('error'))}
 play(){return waitForConnection().then(()=>nativeCommand({op:'play'}))}
 pause(){void nativeCommand({op:'pause'}).catch(()=>this.emit('error'))}
 get paused(){return !this.state.playWhenReady||this.state.ended}
 get ended(){return this.state.ended}
 get duration(){return this.state.duration}
 get currentTime(){return this.state.position}
 set currentTime(position:number){void nativeCommand({op:'seek',position}).catch(()=>this.emit('error'))}
 get playbackRate(){return this.rate}
 set playbackRate(value:number){this.rate=value;void waitForConnection().then(()=>nativeCommand({op:'speed',value})).catch(()=>this.emit('error'))}
 addEventListener(...args:Parameters<HTMLAudioElement['addEventListener']>){this.element.addEventListener(...args)}
 removeEventListener(...args:Parameters<HTMLAudioElement['removeEventListener']>){this.element.removeEventListener(...args)}
 dispose(){listeners.delete(this.receive)}
}
