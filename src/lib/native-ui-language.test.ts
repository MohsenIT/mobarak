import {expect,test} from 'bun:test'
import {syncNativeUiLanguage} from './native-ui-language'
import {setUiLanguage} from './i18n'

test('native menu language follows app selection before opening the audio player',async()=>{
 const previous=globalThis.window,commands:Record<string,unknown>[]=[]
 const bridge={onmessage:null as null|((event:{data:string})=>void),postMessage:(message:string)=>{const c=JSON.parse(message);commands.push(c);queueMicrotask(()=>bridge.onmessage?.({data:JSON.stringify({id:c.id,ok:true})}))}}
 globalThis.window={QuranNativeAudio:bridge} as unknown as Window&typeof globalThis
 try{
  await setUiLanguage('fa',false);await syncNativeUiLanguage('fa');await syncNativeUiLanguage('fa')
  expect(commands.filter(c=>c.op==='language').map(c=>c.language)).toEqual(['fa'])
  await setUiLanguage('en',false);await syncNativeUiLanguage('en')
  expect(commands.filter(c=>c.op==='language').map(c=>c.language)).toEqual(['fa','en'])
  expect(await setUiLanguage('zz',false)).toBe(false);expect(commands).toHaveLength(2)
 }finally{globalThis.window=previous;await setUiLanguage('fa',false)}
})
