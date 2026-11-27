import { lemmaDisplay } from './lemma-display'
import { explicitMarks } from './professional-query'
import { normalizeQuranSearch, quranSearchKeys, typoDistance } from './quran-search'

export type ProfessionalMorphology = [string | null, string | null, string | null]
type Letter = { value: string; marks: string; synthetic?: boolean }
type MatcherOptions = {
  exact: boolean; requireInitial?: boolean; spellingSensitive?: boolean; includePartial?: boolean; includeNear?: boolean; mode?: 'text' | 'root' | 'lemma'
}
const marks = /[\u064b-\u0652\u06e1]/gu

function letters(value: string, restore: boolean, sensitive: boolean, countHamza: boolean): Letter[] {
  const result: Letter[] = []
  for (const piece of value.normalize('NFKC').matchAll(/[^\p{M}]\p{M}*/gu)) {
    const spelling = piece[0].replace(/^؟/, '?')
    if (spelling === '?' || spelling === '*') { result.push({ value: spelling, marks: '' }); continue }
    const base = normalizeQuranSearch(spelling, false, sensitive)
    const normalized = (restore ? normalizeQuranSearch(spelling, true, sensitive) : base) ||
      (countHamza && spelling.startsWith('ء') ? 'ء' : '')
    const vocalization = [...spelling.matchAll(marks)].map(([mark]) => mark === '\u06e1' ? '\u0652' : mark).join('')
    for (const [index, letter] of [...normalized].entries()) {
      if (/\p{L}/u.test(letter)) result.push({ value: letter, marks: index === 0 ? vocalization : '', synthetic: restore && index >= [...base].length && letter !== 'ء' })
    }
  }
  return result
}

function matchesPattern(pattern: Letter[], actual: Letter[], partial: boolean) {
  let reachable = Array<boolean>(actual.length + 1).fill(partial)
  reachable[0] = true
  for (const expected of pattern) {
    const next = Array<boolean>(actual.length + 1).fill(false)
    if (expected.value === '*') {
      next[0] = reachable[0]
      for (let i = 1; i <= actual.length; i++) next[i] = reachable[i] || next[i - 1]
    } else {
      for (let i = 1; i <= actual.length; i++) {
        const letter = actual[i - 1]
        next[i] = reachable[i - 1] && (expected.value === '?' ? !letter.synthetic : expected.value === letter.value) &&
          [...expected.marks].every(mark => letter.marks.includes(mark))
      }
    }
    reachable = next
  }
  return partial ? reachable.some(Boolean) : reachable[actual.length]
}

const isDreamSpelling = (value: string) => value.includes('ء') &&
  /^رءي[اى]$/u.test(value.normalize('NFKC').replace(/[\p{M}ـ]/gu, ''))

export function indexProfessionalSpellings() {
  const caches = [new Map<string, string[]>(), new Map<string, string[]>()]
  return (value: string, sensitive: boolean) => {
    const cache = caches[Number(sensitive)]
    let keys = cache.get(value)
    if (!keys) {
      keys = quranSearchKeys(value, sensitive)
      if (!sensitive && isDreamSpelling(value)) keys.push('رويا')
      cache.set(value, keys)
    }
    return keys
  }
}

export function createProfessionalWordMatcher(pattern: string, options: MatcherOptions, spellings = indexProfessionalSpellings()) {
  const sensitive = !!options.spellingSensitive
  const marked = explicitMarks.test(pattern)
  const wildcard = /[*?؟]/u.test(pattern)
  const blocked = /[^\p{L}\p{M}*?؟\u200c\u200d]/u.test(pattern)
  const mode = options.mode ?? 'text'
  const partial = mode === 'text' && !options.exact && !wildcard && !options.requireInitial && options.includePartial !== false
  const fuzzy = mode === 'text' && !options.exact && !wildcard && !marked && !sensitive && !options.requireInitial && options.includeNear
  const compiled = letters(pattern, false, sensitive, wildcard)
  if (!sensitive && !wildcard && mode === 'text') {
    const key = compiled.map(letter => letter.value).join('')
    if (key === 'صلوت' && /ة\p{M}*$/u.test(pattern)) compiled[2].value = 'ا'
    if ((key === 'رحمان' || key === 'الرحمان') && !compiled[compiled.length - 2].marks) compiled.splice(-2, 1)
  }
  const key = compiled.map(letter => letter.value).join('')
  const cache = new Map<string, boolean>()
  const pieces = key.split(/[*?]/u)
  const [prefix, suffix] = [pieces[0], pieces.at(-1)!]
  const minimum = key.replace(/\*/g, '').length
  const threshold = key.length >= 6 ? 2 : 1
  const couldMatch = (spelling: string) => wildcard
    ? spelling.length >= minimum && (key.includes('*') || spelling.length === minimum) &&
      spelling.startsWith(prefix) && spelling.endsWith(suffix) && pieces.every(piece => spelling.includes(piece))
    : partial ? spelling.includes(key) : spelling === key
  return (surface: string, morphology?: ProfessionalMorphology) => {
    const value = mode === 'root' ? morphology?.[0] : mode === 'lemma' ? morphology?.[1] && lemmaDisplay(morphology[1]) : surface
    if (!value || !key || blocked) return false
    const known = cache.get(value)
    if (known !== undefined) return known
    const spellingsForValue = spellings(value, sensitive)
    const direct = spellingsForValue.some(couldMatch)
    if ((!marked && !wildcard) || (!direct && !(wildcard && value.includes('ء')))) {
      const matched = direct || !!fuzzy && key.length >= 3 &&
        spellingsForValue.some(spelling => typoDistance(key, spelling, threshold) <= threshold)
      cache.set(value, matched)
      return matched
    }
    const variants = [letters(value, false, sensitive, wildcard)]
    if (!sensitive) {
      const restored = letters(value, true, false, wildcard)
      variants.push(restored)
      // This Uthmani spelling has an unseated hamza and sometimes a final ya-shaped alif.
      if (!wildcard && isDreamSpelling(value)) {
        const dream = letters(value, false, true, false)
        dream[1].value = 'و'
        dream[3].value = 'ا'
        variants.push(dream)
      }
      if (/ة\p{M}*(?:[^\p{L}\p{M}]|$)/u.test(value)) {
        variants.push(...variants.map(variant => variant.map((letter, index) =>
          index === variant.length - 1 && letter.value === 'ت' ? { ...letter, value: 'ه' } : letter)))
      }
    }
    const matched = variants.some(variant => matchesPattern(compiled, variant, partial))
    cache.set(value, matched)
    return matched
  }
}
