/** Build a self-contained client without changing the server-backed web build. */
import { cp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestBuild = spawnSync(process.execPath, [path.join(root, 'scripts/build-offline-manifest.mjs')], { cwd: root, stdio: 'inherit' })
if (manifestBuild.status !== 0) process.exit(manifestBuild.status ?? 1)
const stage = path.join(root, '.desktop-build')
await rm(stage, { recursive: true, force: true })
await mkdir(stage, { recursive: true })
for (const file of ['src', 'public', 'package.json', 'tsconfig.json', 'postcss.config.mjs']) await cp(path.join(root, file), path.join(stage, file), { recursive: true })
for (const book of ['maqayis', 'ishtiqaqi']) await rm(path.join(stage, 'public/data', book), { recursive: true, force: true })
const extraTranslations=JSON.parse(await (await import('node:fs/promises')).readFile(path.join(root,'public/data/translations/catalogue.json'),'utf8'))
for(const item of extraTranslations)await rm(path.join(stage,'public/data/translations',`${item.id}.json`),{force:true})
const extraTranslations=JSON.parse(await (await import('node:fs/promises')).readFile(path.join(root,'public/data/translations/catalogue.json'),'utf8'))
for(const item of extraTranslations)await rm(path.join(stage,'public/data/translations',`${item.id}.json`),{force:true})
const extraTranslations=JSON.parse(await (await import('node:fs/promises')).readFile(path.join(root,'public/data/translations/catalogue.json'),'utf8'))
for(const item of extraTranslations)await rm(path.join(stage,'public/data/translations',`${item.id}.json`),{force:true})
const extraTranslations=JSON.parse(await (await import('node:fs/promises')).readFile(path.join(root,'public/data/translations/catalogue.json'),'utf8'))
for(const item of extraTranslations)await rm(path.join(stage,'public/data/translations',`${item.id}.json`),{force:true})
await rm(path.join(stage, 'src/app/api'), { recursive: true, force: true })
const { readFile } = await import('node:fs/promises')
const manifest = path.join(stage, 'src/app/manifest.ts')
await writeFile(manifest, "export const dynamic = 'force-static'\n" + await readFile(manifest, 'utf8'))
await symlink(path.join(root, 'node_modules'), path.join(stage, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
await writeFile(path.join(stage, 'next.config.mjs'), `export default {
  output: 'export',
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_DESKTOP: '1', NEXT_PUBLIC_APP_VERSION: ${JSON.stringify(process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'desktop')} },
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
}\n`)
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], { cwd: stage, stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status ?? 1)
await rm(path.join(root, 'desktop-dist'), { recursive: true, force: true })
await cp(path.join(stage, 'out'), path.join(root, 'desktop-dist'), { recursive: true })
console.log('Offline client ready in desktop-dist (Quran, translations, Tahqiq and summaries bundled; other books downloaded on demand).')
