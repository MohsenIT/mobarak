import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {configureAndroidAuto} from './configure-android-auto.mjs'
test('generated Android build gets a complete browse library and idempotent manifest/dependencies',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'quran-auto-fixture-'))
 try{
  const main=path.join(temp,'app/src/main');await mkdir(main,{recursive:true})
  await mkdir(path.join(main,'java/app/quranmubarak/reader'),{recursive:true})
  await writeFile(path.join(main,'java/app/quranmubarak/reader/MainActivity.kt'),'package app.quranmubarak.reader\nclass MainActivity : TauriActivity()\n')
  await writeFile(path.join(main,'AndroidManifest.xml'),'<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:label="Reader"></application></manifest>')
  await writeFile(path.join(temp,'app/build.gradle.kts'),'plugins { id("com.android.application") }\n')
  assert.deepEqual(await configureAndroidAuto(process.cwd(),temp),{reciters:22,surahs:114,verses:6236})
  const activity=await readFile(path.join(main,'java/app/quranmubarak/reader/MainActivity.kt'),'utf8')
  assert.match(activity,/override fun onWebViewCreate/)
  const first=await readFile(path.join(main,'AndroidManifest.xml'),'utf8')
  await configureAndroidAuto(process.cwd(),temp)
  assert.equal(await readFile(path.join(main,'AndroidManifest.xml'),'utf8'),first)
  assert.equal((first.match(/<service /g)||[]).length,1)
  assert.match(first,/foregroundServiceType="mediaPlayback"/)
  assert.match(first,/android.media.browse.MediaBrowserService/)
  assert.equal(await readFile(path.join(main,'java/app/quranmubarak/reader/MainActivity.kt'),'utf8'),activity)
  assert.equal((first.match(/<provider /g)||[]).length,1)
  assert.match(first,/QuranArtworkProvider/)
  for(let n=1;n<=114;n++){
   const image=await readFile(path.join(main,'assets/surah-artwork',String(n).padStart(3,'0')+'.png'))
   assert.equal(image.subarray(1,4).toString(),'PNG')
   assert.equal(image.readUInt32BE(16),512);assert.equal(image.readUInt32BE(20),512)
  }
  assert.match(first,/android:icon="@mipmap\/ic_launcher"/)
  for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'])assert.deepEqual(
   await readFile(path.join(main,'res',`mipmap-${density}`,'ic_launcher.png')),
   await readFile(path.join(process.cwd(),'src-tauri/icons/android',`mipmap-${density}`,'ic_launcher.png')))
  assert.match(await readFile(path.join(main,'res/mipmap-anydpi-v26/ic_launcher.xml'),'utf8'),/quran_launcher_logo/)
  const gradle=await readFile(path.join(temp,'app/build.gradle.kts'),'utf8')
  assert.equal((gradle.match(/media3-session/g)||[]).length,1)
  const catalog=JSON.parse(await readFile(path.join(main,'assets/quran-auto.json'),'utf8'))
  assert.equal(catalog.surahs[36].vc,182)
  assert.equal(catalog.labels.fa.verse,'آیه');assert.equal(catalog.numberingSystems.fa,'arabext');assert.equal(catalog.numberingSystems.ar,'arab')
  for(const labels of Object.values(catalog.labels))for(const key of ['verse','resume','speed','repeatVerse','repeatSurah','home','library','chooseVerse','chooseReciter','surahs','recent','downloads'])assert.ok(labels[key])
 }finally{await rm(temp,{recursive:true,force:true})}
})
