import {expect,test} from 'bun:test'
import {nativePosition,nativeCommand,NativeRecitationAudio,nativeRecitationAvailable,type NativePlaybackState} from './native-recitation'

test('native session identifiers accept known recordings and Quran locations only',()=>{
 expect(nativePosition('v/minshawi-murattal/20/72')).toEqual({r:'minshawi-murattal',s:20,a:72})
 for(const id of ['https://example.com/audio.mp3','v/unknown/20/72','v/parhizgar/0/1','v/parhizgar/115/1','v/parhizgar/20/0'])expect(nativePosition(id)).toBeNull()
})
test('native state drives audio events and ignores a stale item while a new selection is pending',async()=>{
 const previous=globalThis.window
 let bridge:{postMessage:(s:string)=>void;onmessage:((e:{data:string})=>void)|null}
 const commands:Record<string,unknown>[]=[]
 const state:NativePlaybackState={type:'state',connected:true,playing:false,playWhenReady:false,ready:true,ended:false,position:0,duration:20,speed:1,item:'v/minshawi-murattal/20/72'}
 bridge={onmessage:null,postMessage:s=>{const command=JSON.parse(s);commands.push(command);queueMicrotask(()=>{bridge.onmessage?.({data:JSON.stringify({id:command.id,ok:true})});bridge.onmessage?.({data:JSON.stringify(state)})})}}
 globalThis.window={QuranNativeAudio:bridge} as unknown as Window&typeof globalThis
 const element=new EventTarget() as HTMLAudioElement,events:string[]=[],positions:number[]=[]
 for(const e of ['canplay','play','pause','timeupdate'])element.addEventListener(e,()=>events.push(e))
 const native=new NativeRecitationAudio(element,p=>positions.push(p.a))
 try{
  expect(nativeRecitationAvailable()).toBe(true)
  await nativeCommand({op:'hello'})
  expect(positions).toEqual([72]);expect(events).toContain('canplay')
  native.expect({r:'minshawi-murattal',s:20,a:73})
  bridge.onmessage?.({data:JSON.stringify({...state,playing:true})})
  expect(positions).toEqual([72])
  bridge.onmessage?.({data:JSON.stringify({...state,item:'v/minshawi-murattal/20/73',playing:true,playWhenReady:true})})
  expect(positions).toEqual([72,73]);expect(events).toContain('play');expect(native.paused).toBe(false)
  await native.play();expect(commands.some(c=>c.op==='play')).toBe(true)
 }finally{native.dispose();globalThis.window=previous}
})
