import {nativeCommand,nativeRecitationAvailable} from './native-recitation'
let lastBridge:unknown,lastLanguage='',pending:Promise<void>|undefined
/** Persist the app language in the native media service, independently of playback. */
export function syncNativeUiLanguage(language:string):Promise<void>{
 if(!nativeRecitationAvailable())return Promise.resolve()
 const bridge=window.QuranNativeAudio
 if(bridge===lastBridge&&language===lastLanguage)return pending??Promise.resolve()
 lastBridge=bridge;lastLanguage=language
 const request=nativeCommand({op:'language',language}).catch(error=>{if(lastBridge===bridge&&lastLanguage===language){lastLanguage='';pending=undefined}throw error})
 pending=request;return request
}
