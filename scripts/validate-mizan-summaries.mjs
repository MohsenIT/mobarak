/** Validate provenance/coverage, never infer semantic fidelity from string matches alone. */
import {readFile,readdir} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const meta=JSON.parse(await readFile(path.join(root,'public/data/meta.json'),'utf8'))
const dir=path.join(root,'public/data/mizan-summaries')
const files=await readdir(dir)
let covered=0
for(const file of files){
 if(!/^\d+\.json$/.test(file))continue
 const s=Number(file.slice(0,-5))
 if(!Number.isInteger(s)||s<1||s>114)throw Error('Invalid surah file')
 const source=JSON.parse(await readFile(path.join(root,`public/data/mizan/${s}.json`),'utf8'))
 const data=JSON.parse(await readFile(path.join(dir,file),'utf8'))
 if(data.surah!==s||!data.rows||Array.isArray(data.rows))throw Error('Invalid summary file')
 for(const [key,row] of Object.entries(data.rows)){
  const a=Number(key),passage=source.passages.find(p=>p.from<=a&&p.to>=a)
  if(!/^\d+$/.test(key)||!Number.isInteger(a)||a<1||a>meta.surahs[s-1].vc||!passage)throw Error('Invalid ayah')
  if(row.sourceSha256!==passage.sourceSha256||row.sourceFrom!==passage.from||row.sourceTo!==passage.to)throw Error(`Stale or mismatched source ${s}:${a}`)
  if(!Array.isArray(row.lines)||row.lines.length<1||row.lines.length>3||row.lines.some(line=>typeof line!=='string'||!line.trim()||line.length>600))throw Error('Expected 1–3 short summary lines')
  if(!row.model||row.review!=='source-checked')throw Error('Unchecked summary cannot be published')
  if(!Array.isArray(row.evidence)||row.evidence.length<1||row.evidence.some(quote=>typeof quote!=='string'||quote.length<15||!passage.text.includes(quote)))throw Error(`Evidence absent from source ${s}:${a}`)
  covered++
 }
}
console.log(`Source-checked summaries: ${covered}/6236; missing ${6236-covered}. Evidence matches validate provenance, not semantic correctness.`)
if(process.argv.includes('--require-complete')&&covered!==6236)process.exitCode=1
