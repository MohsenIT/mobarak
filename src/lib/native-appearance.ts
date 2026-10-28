import {nativeCommand,nativeRecitationAvailable} from './native-recitation'
let previousBridge:unknown,previousTheme=''
export async function syncNativeAppearance(theme:'paper'|'night'){
 if(!nativeRecitationAvailable())return
 const bridge=window.QuranNativeAudio
 if(previousBridge===bridge&&previousTheme===theme)return
 previousBridge=bridge;previousTheme=theme
 try{await nativeCommand({op:'appearance',theme})}catch{if(previousBridge===bridge&&previousTheme===theme)previousTheme=''}
}
