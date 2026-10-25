import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
const base = 'public'
const groups = { core: [], tahqiq: [], maqayis: [], ishtiqaqi: [] }
const translations=JSON.parse(await readFile('public/data/translations/catalogue.json','utf8'))
for(const item of translations)groups[`translation:${item.id}`]=[]
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name)
    if (item.isDirectory()) { await walk(file); continue }
    if (!/\.(json|woff2?|ttf|otf)$/.test(file) || file.endsWith('offline-manifest.json')) continue
    const relative = file.slice(base.length)
    const translation=translations.find(item=>relative===`/data/translations/${item.id}.json`)
    const group = translation?`translation:${translation.id}`:['tahqiq', 'maqayis', 'ishtiqaqi'].find(book => relative.startsWith(`/data/${book}/`)) || 'core'
    const data = await readFile(file)
    groups[group].push({ url: relative, sha256: createHash('sha256').update(data).digest('hex'), bytes: data.length })
  }
}
const excerpts = {}
for (const name of await readdir('public/data/ishtiqaqi')) {
  if (!name.endsWith('.json')) continue
  const data = JSON.parse(await readFile(`public/data/ishtiqaqi/${name}`, 'utf8'))
  excerpts[data.root] = { summary: data.entries.map(entry => entry.translation?.summary).filter(Boolean).join(' ') }
}
await writeFile('public/data/ishtiqaqi-summaries.json', JSON.stringify(excerpts))
await walk(base)
for (const files of Object.values(groups)) files.sort((a,b) => a.url.localeCompare(b.url))
await writeFile('public/offline-manifest.json', JSON.stringify({ version: 1, groups }))
console.log('Offline manifest:', Object.fromEntries(Object.entries(groups).map(([key, files]) => [key, files.length])))
