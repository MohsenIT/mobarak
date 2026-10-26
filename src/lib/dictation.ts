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
 onend:(()=>void)|null
 start:()=>void;stop:()=>void;abort:()=>void
}
export type SpeechConstructor=new()=>SpeechEngine
export function speechConstructor():SpeechConstructor|undefined{
 if(typeof window==='undefined')return
 const browser=window as typeof window&{SpeechRecognition?:SpeechConstructor;webkitSpeechRecognition?:SpeechConstructor}
 return browser.SpeechRecognition??browser.webkitSpeechRecognition
}
