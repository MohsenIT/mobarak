export const explicitMarks = /[\u064b-\u0652\u06e1]/
export const hasExplicitSearchSyntax = (input: string) =>
  /["«»“”„*?؟…|()\u2212-]|\.{3}/u.test(input) || explicitMarks.test(input)
export type ProfessionalAtom = { words: string[]; exact: boolean }
export type Gap = { min: number; max: number }
export type ProfessionalNode =
  | { kind: 'atom'; atom: ProfessionalAtom }
  | { kind: 'sequence'; atoms: ProfessionalAtom[]; gaps: Gap[] }
  | { kind: 'not'; child: ProfessionalNode }
  | { kind: 'and' | 'or'; children: ProfessionalNode[] }
export type ProfessionalQuery = { status: 'ordinary' } | { status: 'invalid' } |
  { status: 'valid'; node: ProfessionalNode; boolean: boolean }

type Token = { kind: 'atom'; atom: ProfessionalAtom } | { kind: 'gap'; gap: Gap } |
  { kind: '(' | ')' | '|' | '-'; end: number; start: number }

const wordParts = /[^\p{L}\p{M}*?؟|()\-\u200c\u200d]+/u
const quotes: Record<string, string> = { '"': '"', '«': '»', '“': '”', '„': '“' }
const hasPattern = (word: string) => /[\p{L}?؟]/u.test(word.replace(/ـ/g, ''))

export function parseProfessionalQuery(raw: string): ProfessionalQuery {
  if (!hasExplicitSearchSyntax(raw) && !/(?:^|\s)و(?=\s|$)/u.test(raw)) return { status: 'ordinary' }
  if (raw.length > 160) return { status: 'invalid' }
  const input = raw.normalize('NFC').replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) & 15)).replaceAll('−', '-')
  const tokens: Token[] = []
  let boolean = false
  for (let i = 0; i < input.length;) {
    const char = input[i]
    if (/\s/u.test(char)) { i++; continue }
    if (quotes[char]) {
      const end = input.indexOf(quotes[char], i + 1)
      if (end < 0 || /[\p{L}\p{M}*?؟]/u.test(input[end + 1] ?? '')) return { status: 'invalid' }
      const words = input.slice(i + 1, end).split(wordParts).filter(Boolean)
      if (!words.length || !words.some(hasPattern)) return { status: 'invalid' }
      tokens.push({ kind: 'atom', atom: { words, exact: true } })
      i = end + 1
      continue
    }
    const gap = input.slice(i).match(/^(\(\s*\*\s*\)|(?:\.{3}|…)(?:\s*\{\s*(\d+)\s*(?:(?:,|،)\s*(\d+)\s*)?\})?)/u)
    if (gap) {
      const next = i + gap[0].length
      if (input.slice(next).trimStart().startsWith('{')) return { status: 'invalid' }
      const min = gap[1].startsWith('(') ? 1 : Number(gap[2] ?? 0)
      const max = gap[1].startsWith('(') ? 1 : gap[2] ? Number(gap[3] ?? gap[2]) : Infinity
      if (!Number.isSafeInteger(min) || min > max || (max !== Infinity && !Number.isSafeInteger(max))) return { status: 'invalid' }
      tokens.push({ kind: 'gap', gap: { min, max } })
      i = next
      continue
    }
    if (char === '(' || char === ')' || char === '|' || char === '-') {
      boolean = true
      tokens.push({ kind: char, start: i, end: i + 1 })
      if (char === '-' && (!input[i + 1] || /\s/u.test(input[i + 1]) || /[\p{L}\p{M}*?؟)]/u.test(input[i - 1] ?? ''))) return { status: 'invalid' }
      i++
      continue
    }
    const word = input.slice(i).match(/^[\p{L}\p{M}*?؟\u200c\u200d]+/u)?.[0]
    if (!word || !hasPattern(word)) return { status: 'invalid' }
    const words = [word]
    i += word.length
    // A written conjunction belongs to the following stem, not to an unrelated hit.
    if (/^و[\u064b-\u0652\u06e1]*$/u.test(word)) {
      const next = input.slice(i).match(/^\s+([\p{L}\p{M}*?؟\u200c\u200d]+)/u)
      if (next && hasPattern(next[1])) { words.push(next[1]); i += next[0].length }
    }
    tokens.push({ kind: 'atom', atom: { words, exact: words.length > 1 } })
  }
  if (tokens.length > 64) return { status: 'invalid' }
  let index = 0
  function primary(depth: number): ProfessionalNode | null {
    if (depth > 16) return null
    const token = tokens[index++]
    if (!token) return null
    if (token.kind === '-') {
      const child = primary(depth + 1)
      return child && { kind: 'not', child }
    }
    if (token.kind === '(') {
      const node = expression(depth + 1)
      return tokens[index++]?.kind === ')' ? node : null
    }
    if (token.kind !== 'atom') return null
    const atoms = [token.atom]
    const gaps: Gap[] = []
    while (tokens[index]?.kind === 'gap') {
      const gap = tokens[index++]
      const next = tokens[index++]
      if (gap.kind !== 'gap' || next?.kind !== 'atom') return null
      gaps.push(gap.gap)
      atoms.push(next.atom)
    }
    return gaps.length ? { kind: 'sequence', atoms, gaps } : { kind: 'atom', atom: token.atom }
  }
  function conjunction(depth: number): ProfessionalNode | null {
    const children: ProfessionalNode[] = []
    while (index < tokens.length && tokens[index].kind !== '|' && tokens[index].kind !== ')') {
      const node = primary(depth)
      if (!node) return null
      children.push(node)
    }
    return !children.length ? null : children.length === 1 ? children[0] : { kind: 'and', children }
  }
  function expression(depth: number): ProfessionalNode | null {
    const first = conjunction(depth)
    if (!first) return null
    const children = [first]
    while (tokens[index]?.kind === '|') {
      index++
      const next = conjunction(depth)
      if (!next) return null
      children.push(next)
    }
    return children.length === 1 ? first : { kind: 'or', children }
  }
  const node = expression(0)
  return node && index === tokens.length ? { status: 'valid', node, boolean } : { status: 'invalid' }
}
