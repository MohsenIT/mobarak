// Quick test: verify keyword scoring on Surah 19 (Maryam)
// Usage: npx tsx /home/z/my-project/scripts/test-keyword-score.ts
import { keywordScore, keywordTier } from '../src/lib/quran'

const surah = require('/home/z/my-project/public/data/surah/19.json')
const roots = require('/home/z/my-project/public/data/roots.json')

const surahWords = surah.v.reduce((n, v) => n + v.w.length, 0)
console.log(`Surah 19 (Maryam) — ${surahWords} words total\n`)

const rows = Object.entries(surah.ri).map(([root, occ]) => {
  const inSurah = occ.length
  const g = roots[root] || {}
  const total = Object.values(g).reduce((a, b) => a + b, 0) || inSurah
  const df = Object.keys(g).length || 1
  const score = keywordScore({ inSurah, total, surahWords, df })
  const tier = keywordTier(score)
  return { root, inSurah, total, df, score, tier: tier.label }
})

const sorted = rows.sort((a, b) => b.score - a.score)

console.log('Top 25 roots by keyword score:')
console.log('rank | root    | score | inSurah | total | df  | tier')
console.log('-----+---------+-------+---------+-------+-----+------')
sorted.slice(0, 25).forEach((r, i) => {
  console.log(
    String(i + 1).padStart(4) +
    ' | ' + r.root.padEnd(7) +
    ' | ' + r.score.toFixed(3).padStart(5) +
    ' | ' + String(r.inSurah).padStart(7) +
    ' | ' + String(r.total).padStart(5) +
    ' | ' + String(r.df).padStart(3) +
    ' | ' + r.tier
  )
})

console.log('\nUser-expected roots in Maryam:')
const expected = ['رحم', 'ورث', 'وعد', 'عهد', 'عتو']
expected.forEach(root => {
  const r = sorted.find(x => x.root === root)
  if (!r) return console.log(`  ${root}: NOT FOUND`)
  const rank = sorted.findIndex(x => x.root === root) + 1
  console.log(`  ${root}: score=${r.score.toFixed(3)}, rank=${rank}/${sorted.length}, inSurah=${r.inSurah}, total=${r.total}, df=${r.df}, tier=${r.tier}`)
})
