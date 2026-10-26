'use client'
import {forwardRef,useEffect,useImperativeHandle,useRef,useState,type ComponentPropsWithoutRef,type RefObject} from 'react'
import {Mic,Square} from 'lucide-react'
import {t,currentLanguage,useUiLanguage} from '@/lib/i18n'
import {insertDictation,speechConstructor,type SpeechEngine} from '@/lib/dictation'
let active:SpeechEngine|null=null
function useDictation(ref:RefObject<HTMLInputElement|HTMLTextAreaElement|null>){
 useUiLanguage()
 const [supported,setSupported]=useState(false),[listening,setListening]=useState(false),[error,setError]=useState('')
 const engine=useRef<SpeechEngine|null>(null)
 useEffect(()=>{setSupported(!!speechConstructor());return()=>{const r=engine.current;if(r){r.onresult=null;r.onerror=null;r.onend=null;r.abort();if(active===r)active=null}}},[])
 const toggle=()=>{
  if(listening){engine.current?.stop();return}
  const Constructor=speechConstructor(),field=ref.current
  if(!Constructor||!field)return
  active?.abort()
  const r=new Constructor();engine.current=r;active=r
  const value=field.value,start=field.selectionStart??value.length,end=field.selectionEnd??start
  r.lang=currentLanguage();r.interimResults=true;r.continuous=false
  setError('')
  r.onresult=event=>{
   if(engine.current!==r)return
   const element=ref.current
   if(!element)return
   const text=Array.from(event.results).map(result=>result[0]?.transcript??'').join(' ')
   const next=insertDictation(value,start,end,text,element.maxLength)
   const updated=next.value
   const prototype=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype
   Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(element,updated)
   element.dispatchEvent(new Event('input',{bubbles:true}))
   try{element.setSelectionRange(Math.min(next.caret,updated.length),Math.min(next.caret,updated.length))}catch{}
  }
  r.onerror=event=>{if(engine.current!==r)return;setListening(false);if(event.error!=='aborted')setError(event.error==='not-allowed'||event.error==='service-not-allowed'?'voice.denied':'voice.failed')}
  r.onend=()=>{if(engine.current!==r)return;setListening(false);if(active===r)active=null}
  try{r.start();setListening(true)}catch{setListening(false);setError('voice.failed')}
 }
 return {supported,listening,error,toggle}
}
function Control({supported,listening,error,toggle,disabled}:{supported:boolean;listening:boolean;error:string;toggle:()=>void;disabled?:boolean}){
 return <>{supported&&<button type="button" className={`dictation-button${listening?' is-listening':''}`} disabled={disabled} aria-label={t(listening?'voice.stop':'voice.start')} aria-pressed={listening} title={t(listening?'voice.stop':'voice.start')} onClick={toggle}>{listening?<Square size={15} fill="currentColor"/>:<Mic size={18}/>}</button>}<span className="sr-only" role="status">{listening?t('voice.listening'):error?t(error):''}</span></>
}
export const DictationInput=forwardRef<HTMLInputElement,ComponentPropsWithoutRef<'input'>>(function DictationInput(props,forwarded){
 const ref=useRef<HTMLInputElement>(null),state=useDictation(ref)
 useImperativeHandle(forwarded,()=>ref.current!)
 return <div className="dictation-field"><div className="dictation-input-shell"><input {...props} ref={ref} readOnly={props.readOnly||state.listening} aria-busy={state.listening} style={{...props.style,width:'100%',minWidth:0,...(state.supported?{paddingInlineEnd:'44px'}:{})}}/><Control {...state} disabled={props.disabled||props.readOnly}/></div>{state.error&&<span className="dictation-error">{t(state.error)}</span>}</div>
})
export const DictationTextarea=forwardRef<HTMLTextAreaElement,ComponentPropsWithoutRef<'textarea'>>(function DictationTextarea(props,forwarded){
 const ref=useRef<HTMLTextAreaElement>(null),state=useDictation(ref)
 useImperativeHandle(forwarded,()=>ref.current!)
 return <div className="dictation-field dictation-multiline"><div className="dictation-input-shell"><textarea {...props} ref={ref} readOnly={props.readOnly||state.listening} aria-busy={state.listening} style={{...props.style,width:'100%',minWidth:0,...(state.supported?{paddingInlineEnd:'44px'}:{})}}/><Control {...state} disabled={props.disabled||props.readOnly}/></div>{state.error&&<span className="dictation-error">{t(state.error)}</span>}</div>
})
