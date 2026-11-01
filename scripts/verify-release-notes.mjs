import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'

const base=process.env.RELEASE_BASE || (()=>{ try{return execFileSync('git',['merge-base','HEAD','origin/main'],{encoding:'utf8'}).trim()}catch{return 'HEAD^'} })()
const changed=execFileSync('git',['diff','--name-only',`${base}...HEAD`],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
if(changed.length && !changed.includes('src/lib/app-releases.ts')) throw new Error('A user-facing push needs a new release entry in src/lib/app-releases.ts.')
const source=readFileSync('src/lib/app-releases.ts','utf8')
const versions=[...source.matchAll(/version:'(\d+)\.(\d+)\.(\d+)'/g)].map(match=>match.slice(1).map(Number))
if(versions.length<2 || versions.slice(1).some((version,index)=>versions[index][0]*1_000_000+versions[index][1]*1_000+versions[index][2] <= version[0]*1_000_000+version[1]*1_000+version[2])) throw new Error('Release versions must be newest first.')
if(!/version:'\d+\.\d+\.\d+'.+?title:'[^']+'.+?changes:\[/s.test(source)) throw new Error('The newest release entry needs a title and change notes.')
