/** Bundle verbatim openings, never represent these extracts as AI summaries. */
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const directory=path.join(root,'public/data/mizan-excerpts')
await mkdir(directory,{recursive:true})
const summaryDirectory=path.join(root,'public/data/mizan-summaries')
await mkdir(summaryDirectory,{recursive:true})
let bytes=0,verses=0
for(let surah=1;surah<=114;surah++){
 const source=JSON.parse(await readFile(path.join(root,`public/data/mizan/${surah}.json`),'utf8'))
 const passages=source.passages.map(p=>{
  // Prefer the opening explanation over the preceding Arabic/translation block.
  // Keep exact character offsets: no normalization, paraphrase or silent joins.
  const heading=/بيان\s+آيات|بیان\s+آیات/.exec(p.text)
  let sourceStart=heading?heading.index+heading[0].length:0
  while(/\s/.test(p.text[sourceStart]??'')&&sourceStart<p.text.length)sourceStart++
  let sourceEnd=Math.min(p.text.length,sourceStart+620)
  if(sourceEnd<p.text.length){
   const space=p.text.lastIndexOf(' ',sourceEnd)
   if(space>sourceStart)sourceEnd=space
  }
  while(sourceEnd>sourceStart&&/\s/.test(p.text[sourceEnd-1]))sourceEnd--
  return {from:p.from,to:p.to,sourceSha256:p.sourceSha256,sourceStart,sourceEnd,text:p.text.slice(sourceStart,sourceEnd),truncated:sourceEnd<p.text.length}
 })
 const output=JSON.stringify({surah,verses:source.verses,passages})+'\n'
 await writeFile(path.join(directory,`${surah}.json`),output)
 // Empty, bundled indexes keep pending ayahs usable on a cold offline install.
 // Never replace composed/reviewed rows when rebuilding the excerpts.
 try{await writeFile(path.join(summaryDirectory,`${surah}.json`),JSON.stringify({surah,rows:{}})+'\n',{flag:'wx'})}catch(error){if(error.code!=='EEXIST')throw error}
 bytes+=Buffer.byteLength(output);verses+=source.verses
}
console.log(`Verbatim Al-Mizan openings: ${verses} ayahs, 114 core files, ${bytes} bytes. Full commentary remains optional.`)
