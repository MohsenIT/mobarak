/** Reproducible JVM fixture for real native service/bridge classes; not a device E2E test. */
import {cp,mkdir,mkdtemp,writeFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {configureAndroidAuto} from './configure-android-auto.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT
if(!sdk)throw Error('ANDROID_HOME or ANDROID_SDK_ROOT is required')
const fixture=await mkdtemp(path.join(tmpdir(),'quran-native-tests-'))
await cp(path.join(root,'android-auto/fixture'),fixture,{recursive:true})
await writeFile(path.join(fixture,'local.properties'),`sdk.dir=${sdk.replaceAll('\\','\\\\')}\n`)
await configureAndroidAuto(root,fixture)
const tests=path.join(fixture,'app/src/test/java/app/quranmubarak/reader/auto')
await mkdir(tests,{recursive:true});await cp(path.join(root,'android-auto/tests'),tests,{recursive:true})
console.log(`Native test fixture: ${fixture}`)
const run=spawnSync(process.env.GRADLE_BIN||'gradle',['-p',fixture,'testDebugUnitTest','compileDebugKotlin'],{stdio:'inherit'})
if(run.error)throw run.error
process.exitCode=run.status??1
