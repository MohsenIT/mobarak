import { getSourceSurahContexts } from './contexts'
import { explicitMarks, type ProfessionalAtom, type ProfessionalNode, type Gap } from './professional-query'
import { createProfessionalWordMatcher, indexProfessionalSpellings, type ProfessionalMorphology } from './professional-word'
import { normalizeQuranSearch, type QuranSearchResult, type SearchCooccurrenceGroup, type SearchVerse } from './quran-search'
import type { SearchCorpus, SearchSessionOptions } from './quran-search-session'
import { bm25, defaultPhase3SearchOptions, searchOrder, searchProximity, unrecordedSearchForm } from './search-query'
import { splitWord } from './word-parts'

type LexicalToken = { text: string; part: 1 | 2; pos: number; canonical: number; row: SearchVerse; morphology?: ProfessionalMorphology }
type Unit = { tokens: LexicalToken[]; rows: SearchVerse[]; group?: SearchCooccurrenceGroup }
type Hit = { first: number; last: number; slots: number[]; facet: number }
type Evidence = Hit[] | null

function lowerBound<T>(values: T[], predicate: (value: T) => boolean) {
  let left = 0, right = values.length
  while (left < right) {
    const middle = (left + right) >>> 1
    if (predicate(values[middle])) right = middle
    else left = middle + 1
  }
  return left
}

// Keep only hits that participate in a whole sequence. This bounds the work
// by the number of hits, without enumerating every combination of endpoints.
function sequence(unit: Unit, layers: Hit[][], gaps: Gap[]): Evidence {
  if (layers.some(hits => !hits.length)) return null
  const position = (index: number) => unit.tokens[index].canonical
  const forward: Hit[][] = [layers[0]]
  for (let i = 1; i < layers.length; i++) {
    const previous = forward[i - 1].map(hit => hit.last).sort((a, b) => a - b)
    const { min, max } = gaps[i - 1]
    const retained = layers[i].filter(hit => {
      const distance = position(hit.first)
      const left = lowerBound(previous, index => position(index) >= distance - max - 1)
      const right = lowerBound(previous, index => index >= hit.first || position(index) > distance - min - (min ? 1 : 0))
      return left < right
    })
    if (!retained.length) return null
    forward.push(retained)
  }
  let next = forward.at(-1)!
  const all = [...next]
  for (let i = layers.length - 2; i >= 0; i--) {
    const starts = next.map(hit => hit.first).sort((a, b) => a - b)
    const { min, max } = gaps[i]
    next = forward[i].filter(hit => {
      const distance = position(hit.last)
      const left = lowerBound(starts, index => index > hit.last && position(index) >= distance + min + (min ? 1 : 0))
      const right = lowerBound(starts, index => position(index) > distance + max + 1)
      return left < right
    })
    all.push(...next)
  }
  return all
}

type Evaluate = (unit: Unit) => Evidence
type LooseLookup = (word: string) => QuranSearchResult[]

export function createProfessionalSearch(corpus: SearchCorpus) {
  type WordMatch = (token: LexicalToken) => boolean
  const spellings = indexProfessionalSpellings()
  let attachedSpellings: Set<string> | undefined
  const indexes = new Map<NonNullable<ReturnType<typeof defaultPhase3SearchOptions>['cooccurrence']>, Unit[]>()

  function hasAttachedWaw(input: string) {
    const terms = normalizeQuranSearch(input).split(' ')
    if (!terms.some(term => term.startsWith('و') && term.length > 2)) return false
    if (!attachedSpellings) {
      attachedSpellings = new Set<string>()
      for (const [s, a, words] of corpus.verses) for (const pos of corpus.waw?.[`${s}:${a}`] ?? []) {
        const word = words[pos - 1]
        if (word) {
          attachedSpellings.add(normalizeQuranSearch(word))
          attachedSpellings.add(normalizeQuranSearch(word, true))
        }
      }
    }
    return terms.some(term => attachedSpellings!.has(term))
  }

  function indexedUnits(unitKind: 'verse' | 'context' | 'surah') {
    const existing = indexes.get(unitKind)
    if (existing) return existing
    const units = new Map<string, Unit>()
    for (const row of corpus.verses) {
      const [s, a, words] = row
      const candidates = unitKind === 'context' ? getSourceSurahContexts(s)?.ranges.filter(range => a >= range.from && a <= range.to) : undefined
      const range = candidates?.length === 1 ? candidates[0] : undefined
      const key = unitKind === 'surah' ? String(s) : range ? `${s}:${range.from}-${range.to}` : `${s}:${a}`
      let unit = units.get(key)
      if (!unit) {
        unit = { tokens: [], rows: [], ...(range ? { group: { unit: 'context', from: range.from, to: range.to } } : {}) }
        units.set(key, unit)
      }
      const canonical = unit.tokens.at(-1)?.canonical ?? 0
      unit.rows.push(row)
      const waw = corpus.waw?.[`${s}:${a}`] ?? []
      const morphology = corpus.morphology[`${s}:${a}`]
      words.forEach((word, i) => {
        const pos = i + 1
        const { prefix, stem } = splitWord({ t: word, wa: waw.includes(pos) })
        if (prefix) unit!.tokens.push({ text: prefix, part: 1, pos, canonical: canonical + pos, row })
        if (stem) unit!.tokens.push({ text: stem, part: 2, pos, canonical: canonical + pos, row, morphology: morphology?.[i] })
      })
    }

    const ordered = [...units.values()]
    indexes.set(unitKind, ordered)
    return ordered
  }

  function execute(node: ProfessionalNode, boolean: boolean, options: SearchSessionOptions, lookup: LooseLookup) {
    const phase = options.phase3 ?? { ...defaultPhase3SearchOptions(), relation: 'phrase' as const }
    const scope = new Set(options.surahs ?? [])
    const unitKind = phase.cooccurrence ?? 'verse'
    const units = indexedUnits(unitKind)
    const corpusRows = scope.size ? corpus.verses.filter(([s]) => scope.has(s)) : corpus.verses

    let facets = 0
    const compiled = new Map<string, WordMatch>()
    function compileWord(word: string, exact: boolean): WordMatch {
      const key = `${exact}:${word}`
      const remembered = compiled.get(key)
      if (remembered) return remembered
      const explicit = /[*?؟]/u.test(word) || explicitMarks.test(word)
      const conjunction = /^و\p{M}*$/u.test(word)
      const textMode = !options.mode || options.mode === 'text'
      const leadingWaw = textMode && word.startsWith('و')
      const lexical = createProfessionalWordMatcher(word, {
        ...options, exact, spellingSensitive: phase.spellingSensitive, requireInitial: conjunction || leadingWaw,
        ...(conjunction ? { mode: 'text' as const } : {}),
      }, spellings)
      const roots = !exact && !explicit && options.includeRoots && !word.startsWith('و') && (!options.mode || options.mode === 'text')
        ? new Map(lookup(word).map(hit => [`${hit.s}:${hit.a}`, hit.parts]))
        : null
      const match: WordMatch = token => (!conjunction || token.part === 1 || textMode) && lexical(token.text, token.morphology) ||
        !!((roots?.get(`${token.row[0]}:${token.row[1]}`)?.[token.pos] ?? 0) & token.part)
      compiled.set(key, match)
      return match
    }

    function atom({ words, exact }: ProfessionalAtom): Evaluate {
      const facet = facets
      facets += words.length
      const matchers = words.map(word => compileWord(word, exact))
      const explicitWaw = words.map(word => {
        if (options.mode && options.mode !== 'text') return null
        const prefix = word.match(/^و\p{M}*/u)?.[0]
        const rest = prefix && word.slice(prefix.length)
        return prefix && rest ? [compileWord(prefix, true), compileWord(rest, true)] : null
      })
      return ({ tokens }) => {
        const hits: Hit[] = []
        for (let first = 0; first < tokens.length; first++) {
          let index = first, term = 0
          const slots: number[] = []
          for (; term < matchers.length && index < tokens.length; term++) {
            const token = tokens[index]
            const pair = explicitWaw[term]
            const next = tokens[index + 1]
            if (pair && token.part === 1 && next?.part === 2 && next.canonical === token.canonical && pair[0](token) && pair[1](next)) {
              slots.push(term, term)
              index += 2
            } else if (matchers[term](token)) {
              // A standalone و typed alongside its stem requires the tagged prefix.
              if (/^و\p{M}*$/u.test(words[term]) && words.length > 1 && (token.part !== 1 || next?.canonical !== token.canonical)) break
              slots.push(term)
              index++
            } else break
          }
          if (term === matchers.length) hits.push({ first, last: index - 1, slots, facet })
        }
        return hits.length ? hits : null
      }
    }

    function compound(atoms: ProfessionalAtom[], gaps: Gap[]): Evaluate {
      const matchers = atoms.map(atom)
      return unit => sequence(unit, matchers.map(match => match(unit) ?? []), gaps)
    }

    function compile(tree: ProfessionalNode): Evaluate {
      if (tree.kind === 'atom') return atom(tree.atom)
      if (tree.kind === 'sequence') return compound(tree.atoms, tree.gaps)
      if (tree.kind === 'not') {
        const match = compile(tree.child)
        return unit => match(unit) === null ? [] : null
      }
      const children = tree.children.map(compile)
      return unit => {
        const hits: Hit[] = []
        let matched = false
        for (const child of children) {
          const result = child(unit)
          if (result === null) {
            if (tree.kind === 'and') return null
            continue
          }
          matched = true
          hits.push(...result)
        }
        return matched ? hits : null
      }
    }

    const defaultAtoms = !boolean && node.kind === 'and' && node.children.every(child => child.kind === 'atom')
      ? node.children.map(child => (child as Extract<ProfessionalNode, { kind: 'atom' }>).atom) : null
    const evaluate = defaultAtoms && phase.relation === 'phrase'
      ? atom({ words: defaultAtoms.flatMap(atom => atom.words), exact: true })
      : defaultAtoms && phase.relation === 'all' && phase.orderedWords
        ? compound(defaultAtoms, defaultAtoms.slice(1).map(() => ({ min: 0, max: Infinity })))
        : compile(!boolean && phase.relation === 'any' && node.kind === 'and' ? { ...node, kind: 'or' } : node)

    const selected = [phase.roots, phase.lemmas, phase.forms]
    const hasFilters = selected.some(group => group.length)
    const rows: { result: QuranSearchResult; occurrences: number[] }[] = []
    const frequency = Array<number>(facets).fill(0)
    for (const unit of units) {
      if (scope.size && !scope.has(unit.rows[0][0])) continue
      const evidence = evaluate(unit)
      if (!evidence) continue
      const hits = new Map<SearchVerse, { parts: Record<number, number>; occurrences: Map<string, number[]>; facets: Set<number>[]; counts: number[] }>()
      for (const { first, last, slots, facet } of evidence) {
        const tokens = unit.tokens.slice(first, last + 1)
        if (hasFilters && !tokens.some(token => token.part === 2 && selected.every((group, column) => !group.length ||
          group.includes(token.morphology?.[column] ?? (column === 2 && token.morphology ? unrecordedSearchForm : ''))))) continue
        const byVerse = new Map<SearchVerse, { parts: Record<number, number>; slots: Map<number, Set<number>> }>()
        for (const [offset, token] of tokens.entries()) {
          let match = byVerse.get(token.row)
          if (!match) { match = { parts: {}, slots: new Map() }; byVerse.set(token.row, match) }
          match.parts[token.pos] = (match.parts[token.pos] ?? 0) | token.part
          if (token.part === 2) {
            const slot = facet + slots[offset]
            let positions = match.slots.get(slot)
            if (!positions) { positions = new Set(); match.slots.set(slot, positions) }
            positions.add(token.pos)
          }
        }
        for (const [row, { parts, slots }] of byVerse) {
          let hit = hits.get(row)
          if (!hit) {
            hit = { parts: {}, occurrences: new Map(), facets: Array.from({ length: facets }, () => new Set<number>()), counts: Array<number>(facets).fill(0) }
            hits.set(row, hit)
          }
          const positions = Object.keys(parts).map(Number)
          const occurrence = positions.map(pos => `${pos}:${parts[pos] & 2 ? 2 : 1}`).join(',')
          if (!hit.occurrences.has(occurrence)) hit.occurrences.set(occurrence, positions)
          for (const pos of positions) {
            hit.parts[pos] = (hit.parts[pos] ?? 0) | parts[pos]
          }
          for (const [slot, positions] of slots) {
            for (const pos of positions) hit.facets[slot].add(pos)
            hit.counts[slot]++
          }
        }
      }
      if (!evidence.length && !hasFilters) hits.set(unit.rows[0], { parts: {}, occurrences: new Map(), facets: [], counts: [] })
      const group = unitKind === 'surah' ? { unit: 'surah' as const, from: unit.rows[0][1], to: unit.rows.at(-1)![1] } : unit.group
      for (const [[s, a, words], hit] of hits) {
        hit.counts.forEach((count, facet) => { if (count) frequency[facet]++ })
        rows.push({
          result: {
            s, a, words, waw: corpus.waw?.[`${s}:${a}`] ?? [], kind: 'exact', score: 0,
            parts: hit.parts, positions: Object.keys(hit.parts).map(Number),
            occurrences: [...hit.occurrences.values()].sort((a, b) => a[0] - b[0]),
            facetPositions: hit.facets.map(group => [...group].sort((a, b) => a - b)),
            ...(group ? { cooccurrenceGroup: group } : {}),
          },
          occurrences: hit.counts,
        })
      }
    }
    const average = corpusRows.reduce((sum, row) => sum + row[2].length, 0) / Math.max(1, corpusRows.length)
    const ranked = rows.map(({ result, occurrences }) => {
      const groups = result.facetPositions?.filter(group => group.length) ?? []
      const relevance = occurrences.reduce((total, count, facet) => total +
        (count ? bm25(count, frequency[facet], result.words.length, average, corpusRows.length) : 0), 0)
      return { result, relevance: relevance * (1 + searchProximity(groups) + 0.25 * searchOrder(groups)) }
    })
    return ranked.sort((a, b) => {
      const canonical = a.result.s - b.result.s || a.result.a - b.result.a
      const difference = phase.sorts[0] === 'relevance' ? b.relevance - a.relevance : canonical
      return (phase.reverseSort ? -difference : difference) || canonical
    }).map(({ result }) => result)
  }

  return { execute, hasAttachedWaw }
}
