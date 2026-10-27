/** Apply native Auto support after `tauri android init` regenerates its ignored project. */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
export async function configureAndroidAuto(root=repo,android=path.join(root,'src-tauri/gen/android')){
  const app=path.join(android,'app'),main=path.join(app,'src/main')
  const reciters=JSON.parse(await readFile(path.join(root,'public/data/recitation-sources.json'),'utf8'))
  const {surahs}=JSON.parse(await readFile(path.join(root,'public/data/meta.json'),'utf8'))
  if(surahs.length!==114 || surahs.reduce((n,s)=>n+s.vc,0)!==6236)throw Error('Invalid Quran catalogue')
  if(new Set(reciters.map(r=>r.id)).size!==reciters.length || reciters.some(r=>!/^[-a-z0-9]+$/.test(r.id) || (r.tanzilDirectory&&!/^[a-z0-9]+$/.test(r.tanzilDirectory))))throw Error('Invalid recitation source')
  for(const surah of surahs){
    const data=JSON.parse(await readFile(path.join(root,`public/data/surah/${surah.n}.json`),'utf8'))
    surah.texts=data.v.map(v=>v.w.map(w=>w.t.replace(/[\u06D6-\u06DC\u06DE\u06DF\u06E2\u06E3\u06E9\u06EB\u06ED]/g,'').trim()).join(' '))
    if(surah.texts.length!==surah.vc)throw Error('Incomplete verse text')
  }
  const {readdir}=await import('node:fs/promises'),labels={}
  const brand=JSON.parse(await readFile(path.join(root,'public/data/branding.json'),'utf8'))
  for(const f of await readdir(path.join(root,'src/messages'))){
    if(!/^[a-z]{2,3}\.json$/.test(f))continue
    const m=JSON.parse(await readFile(path.join(root,'src/messages',f),'utf8'))
    labels[f.slice(0,-5)]={app:brand.APP_NAME,verse:m['ui.b1b168c791'],resume:m['ui.f432f383bf'],repeatVerse:m['ui.9645b5c54f'],repeatSurah:m['ui.2cfa25518d'],speed:m['ui.991d782fda']}
  }
  await mkdir(path.join(main,'assets'),{recursive:true})
  await writeFile(path.join(main,'assets/quran-auto.json'),JSON.stringify({reciters,surahs,labels}))
  const java=path.join(main,'java/app/quranmubarak/reader/auto');await mkdir(java,{recursive:true})
  for(const file of ['QuranCarService.java','QuranAudioBridge.java'])await copyFile(path.join(root,'android-auto',file),path.join(java,file))
  const activity=path.join(main,'java/app/quranmubarak/reader/MainActivity.kt')
  let kotlin=await readFile(activity,'utf8')
  kotlin=kotlin.replace(/\s*\/\/ quran-audio:start[\s\S]*?\/\/ quran-audio:end/g,'')
  if(/override fun (onWebViewCreate|onDestroy)/.test(kotlin))throw Error('MainActivity has custom lifecycle hooks; merge native audio explicitly')
  const hooks=`
    // quran-audio:start
    @androidx.annotation.OptIn(markerClass = [androidx.media3.common.util.UnstableApi::class])
    private var quranAudioBridge: app.quranmubarak.reader.auto.QuranAudioBridge? = null
    @androidx.annotation.OptIn(markerClass = [androidx.media3.common.util.UnstableApi::class])
    override fun onWebViewCreate(webView: android.webkit.WebView) {
        super.onWebViewCreate(webView)
        quranAudioBridge?.close()
        if (androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.WEB_MESSAGE_LISTENER)) {
            quranAudioBridge = app.quranmubarak.reader.auto.QuranAudioBridge(this, webView)
        }
    }
    // quran-audio:end`
  const declaration=/class MainActivity\s*:\s*TauriActivity\(\)\s*(\{)?/
  if(!declaration.test(kotlin))throw Error('Unrecognized generated MainActivity')
  kotlin=kotlin.replace(declaration,(_all,brace)=>`class MainActivity : TauriActivity() {${hooks}${brace?'':'\n}'}`)
  await writeFile(activity,kotlin)
  const xml=path.join(main,'res/xml');await mkdir(xml,{recursive:true})
  await writeFile(path.join(xml,'automotive_app_desc.xml'),'<?xml version="1.0" encoding="utf-8"?><automotiveApp><uses name="media"/></automotiveApp>\n')
  const manifest=path.join(main,'AndroidManifest.xml')
  let m=await readFile(manifest,'utf8')
  const permission=['android.permission.INTERNET','android.permission.FOREGROUND_SERVICE','android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK','android.permission.WAKE_LOCK']
  for(const p of permission)if(!m.includes(`android:name="${p}"`))m=m.replace(/<application\b/,`<uses-permission android:name="${p}"/>\n    <application`)
  m=m.replace(/\s*<!-- quran-auto:start -->[\s\S]*?<!-- quran-auto:end -->/g,'')
  if(!m.includes('</application>'))throw Error('Generated Android manifest has no application')
  m=m.replace(/\s*<\/application>/,`\n        <!-- quran-auto:start -->
        <meta-data android:name="com.google.android.gms.car.application" android:resource="@xml/automotive_app_desc"/>
        <service android:name="app.quranmubarak.reader.auto.QuranCarService" android:exported="true" android:foregroundServiceType="mediaPlayback">
            <intent-filter>
                <action android:name="androidx.media3.session.MediaLibraryService"/>
                <action android:name="android.media.browse.MediaBrowserService"/>
                <action android:name="android.media.action.MEDIA_PLAY_FROM_SEARCH"/>
            </intent-filter>
        </service>
        <!-- quran-auto:end -->
    </application>`)
  await writeFile(manifest,m)
  const gradle=path.join(app,'build.gradle.kts')
  let g=await readFile(gradle,'utf8')
  g=g.replace(/\n?\/\/ quran-auto:start[\s\S]*?\/\/ quran-auto:end\n?/g,'\n')
  g+='\n// quran-auto:start\ndependencies {\n    implementation("androidx.media3:media3-exoplayer:1.5.1")\n    implementation("androidx.media3:media3-session:1.5.1")\n    implementation("androidx.webkit:webkit:1.12.1")\n}\n// quran-auto:end\n'
  await writeFile(gradle,g)
  return {reciters:reciters.length,surahs:surahs.length,verses:6236}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Android Auto configured:',await configureAndroidAuto())
