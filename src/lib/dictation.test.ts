import {test,expect} from 'bun:test'
import {insertDictation,speechLanguage} from './dictation'
test('dictation inserts at selection without replacing unrelated text',()=>{
 expect(insertDictation('before old after',7,10,'new')).toEqual({value:'before new after',caret:10})
 expect(insertDictation('hello',5,5,'world')).toEqual({value:'hello world',caret:11})
 expect(insertDictation('abc XYZ',4,4,'long speech',10).value).toBe('abc lo XYZ')
 expect(insertDictation('12345',5,5,'word',5).value).toBe('12345')
})

test('speech uses a full locale and respects matching device region',()=>{
 expect(speechLanguage('fa', ['en-US'])).toBe('fa-IR')
 expect(speechLanguage('en', ['en-GB'])).toBe('en-GB')
 expect(speechLanguage('ar', [])).toBe('ar-EG')
})

test('Android speech uses the native bridge and rejects stale session results',async()=>{
 const {speechConstructor,NativeSpeechEngine}=await import('./dictation'),previous=globalThis.window
 const commands:Record<string,unknown>[]=[],events:string[]=[]
 const bridge={onmessage:null as null|((e:{data:string})=>void),postMessage:(text:string)=>commands.push(JSON.parse(text))}
 globalThis.window={QuranNativeSpeech:bridge} as unknown as Window&typeof globalThis
 try{
  expect(speechConstructor()).toBe(NativeSpeechEngine)
  const engine=new NativeSpeechEngine();engine.lang='fa-IR';engine.onstart=()=>events.push('start');engine.onresult=e=>events.push(e.results[0][0].transcript);engine.onend=()=>events.push('end');engine.start()
  const command=commands[0];expect(command.language).toBe('fa-IR')
  bridge.onmessage?.({data:JSON.stringify({id:999999,type:'result',value:'wrong'})})
  bridge.onmessage?.({data:JSON.stringify({id:command.id,type:'start',value:''})})
  bridge.onmessage?.({data:JSON.stringify({id:command.id,type:'result',value:'منصوری'})})
  bridge.onmessage?.({data:JSON.stringify({id:command.id,type:'end',value:''})})
  expect(events).toEqual(['start','منصوری','end'])
 }finally{globalThis.window=previous}
})
