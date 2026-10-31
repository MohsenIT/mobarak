/** Decode corpus Buckwalter IDs for display/search; IDs remain unchanged for grouping. */
const symbols = "'|>&<}AbptvjHxd*rzs$SDTZEgfqklmnhwYyFNKaui~o`{^#"
const arabic = 'ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىيًٌٍَُِّْٰٱٓٔ'
const table = Object.fromEntries([...symbols].map((symbol, i) => [symbol, [...arabic][i]]))
export function lemmaDisplay(value: string): string {
  return /[A-Za-z]/.test(value) ? [...value].map(char => table[char] ?? char).join('') : value
}

/** Canonical lemma for labels; never present an inflected surface as a lemma. */
export function wordLemma(word: import('./quran').Word, part?: 'prefix' | 'stem'): string | null {
  if (part === 'prefix' && word.wa) return 'وَ'
  return word.lemma ? lemmaDisplay(word.lemma) : null
}
