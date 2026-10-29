/** Replace the selected span; speech never submits a form or executes a search action. */
export function insertDictation(value:string,start:number,end:number,spoken:string,maxLength=-1){
 const before=value.slice(0,start),after=value.slice(end)
 let text=spoken.trim()
 const left=before&&!/\s$/.test(before)&&text?' ':''
 const right=after&&!/^\s/.test(after)&&text?' ':''
 if(maxLength>=0){const capacity=maxLength-before.length-after.length-left.length-right.length;if(capacity<1)return {value,caret:start};text=text.slice(0,capacity)}
 return {value:before+left+text+right+after,caret:(before+left+text).length}
}
export type SpeechResult={isFinal:boolean;[index:number]:{transcript:string}}
export interface SpeechEngine {
 lang:string;interimResults:boolean;continuous:boolean
 onresult:((event:{results:ArrayLike<SpeechResult>})=>void)|null
 onerror:((event:{error:string})=>void)|null
 onstart?:((()=>void)|null)
 onend:(()=>void)|null
 start:()=>void;stop:()=>void;abort:()=>void
}
export type SpeechConstructor=new()=>SpeechEngine
export function speechConstructor():SpeechConstructor|undefined{
 if(typeof window==='undefined')return
 const browser=window as typeof window&{SpeechRecognition?:SpeechConstructor;webkitSpeechRecognition?:SpeechConstructor}
 if((window as unknown as {QuranNativeSpeech?:NativeSpeechPort}).QuranNativeSpeech)return NativeSpeechEngine
 return browser.SpeechRecognition??browser.webkitSpeechRecognition
}

/** Speech services on Android expect a language/region tag, rather than a bare UI code. */
export function speechLanguage(language:string, preferred:readonly string[]=[]){
 const match=preferred.find(value=>value.toLowerCase().startsWith(language.toLowerCase()+'-'))
 if(match)return match
 try { const locale=new Intl.Locale(language).maximize();return locale.region?`${locale.language}-${locale.region}`:language } catch { return language }
}

interface NativeSpeechPort {postMessage:(text:string)=>void;onmessage:((event:{data:string})=>void)|null}
let speechId=0
/** Android uses the OS recognition service, rather than unsupported WebView Web Speech. */
export class NativeSpeechEngine implements SpeechEngine {
 lang='fa-IR';interimResults=true;continuous=false
 onstart:(()=>void)|null=null;onend:(()=>void)|null=null
 onresult:SpeechEngine['onresult']=null;onerror:SpeechEngine['onerror']=null
 private port:NativeSpeechPort|null=null;private id=0
 start(){
  const port=(window as unknown as {QuranNativeSpeech?:NativeSpeechPort}).QuranNativeSpeech
  if(!port)throw Error('native-speech-unavailable')
  this.port=port;this.id=++speechId
  port.onmessage=event=>{
   let data:{id:number;type:string;value:string};try{data=JSON.parse(event.data)}catch{return}
   if(data.id!==this.id)return
   if(data.type==='start')this.onstart?.()
   else if(data.type==='result'||data.type==='partial')this.onresult?.({results:[{isFinal:data.type==='result',0:{transcript:data.value}}]})
   else if(data.type==='error')this.onerror?.({error:data.value})
   else if(data.type==='end'){this.port=null;this.onend?.()}
  }
  port.postMessage(JSON.stringify({id:this.id,op:'start',language:this.lang}))
 }
 stop(){this.port?.postMessage(JSON.stringify({id:this.id,op:'stop'}))}
 abort(){this.port?.postMessage(JSON.stringify({id:this.id,op:'abort'}));this.port=null;this.onerror?.({error:'aborted'});this.onend?.()}
}
