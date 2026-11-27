import { hasExplicitSearchSyntax } from './professional-query'
import { resolveDestination, type Destination } from './navigation'
import type { Meta } from './quran'
import { normalizeQuranSearch, typoDistance } from './quran-search'
import { readSearchLink, searchLink, type SearchLinkState } from './search-link'

export const SEARCH_AND_GO_HISTORY_KEY = 'mushaf.search-and-go-history.v1'
const RECENT_LIMIT = 12
const CONTINUATION_WINDOW = 5 * 60 * 1000

export type SearchOperation = { type: 'navigation'; destination: Destination; word?: number } | { type: 'text'; link: string }
export type SearchHistorySource = 'live' | 'confirmed'
export type SearchOperationEntry = { id: string; operation: SearchOperation; time: number; pinned: boolean; source?: 'live' }

export function textSearchOperation(state: SearchLinkState, includeCriteria = false): SearchOperation | null {
  if (!includeCriteria && (state.mode !== 'text' || state.occurrence)) return null
  if (!state.query.trim() && !state.occurrence) return null
  const url = searchLink('https://mobarak.invalid', state)
  return { type: 'text', link: url.pathname + url.search }
}

function restoredOperation(meta: Meta, input: unknown, includeCriteria: boolean): SearchOperation | null {
  if (!input || typeof input !== 'object') return null
  const operation = input as SearchOperation
  if (operation.type === 'text') {
    const link = operation.link
    if (typeof link !== 'string' || !link.startsWith('/q?')) return null
    const state = readSearchLink(link)
    return state && textSearchOperation(state, includeCriteria)
  }
  if (operation.type !== 'navigation') return null
  const target = operation.destination
  if (!target || typeof target !== 'object') return null
  let destination: Destination | null
  switch (target.kind) {
    case 'surah':
      if (!Number.isInteger(target.s)) return null
      destination = resolveDestination(meta, 'surah', String(target.s), 1)
      break
    case 'page':
      if (!Number.isInteger(target.p)) return null
      destination = resolveDestination(meta, 'page', String(target.p), 1)
      break
    case 'verse':
      if (!Number.isInteger(target.s) || !Number.isInteger(target.a) || !meta.surahs[target.s - 1]) return null
      destination = resolveDestination(meta, 'verse', String(target.a), target.s)
      break
    case 'context':
      if (!Number.isInteger(target.s) || !Number.isInteger(target.index) || !meta.surahs[target.s - 1]) return null
      destination = resolveDestination(meta, 'context', String(target.index), target.s)
      if (destination?.kind !== 'context' || destination.from !== target.from || destination.to !== target.to) return null
      break
    default:
      return null
  }
  if (!destination) return null
  const word = operation.word
  if (word !== undefined && (destination.kind !== 'verse' || !Number.isInteger(word) || word < 1 || word > 500)) return null
  return { type: 'navigation', destination, ...(word && word > 1 ? { word } : {}) }
}

function operationId(operation: SearchOperation) {
  if (operation.type === 'text') return operation.link
  const target = operation.destination
  if (target.kind === 'page') return `page:${target.p}`
  if (target.kind === 'verse') return `verse:${target.s}:${target.a}:${operation.word ?? 1}`
  if (target.kind === 'context') return `context:${target.s}:${target.index}`
  return `surah:${target.s}`
}

function limitRecent(entries: SearchOperationEntry[]) {
  let recent = 0
  return entries.filter(entry => entry.pinned || ++recent <= RECENT_LIMIT)
}

export function readOperationHistory(meta: Meta, stored: unknown, includeCriteria = false): SearchOperationEntry[] {
  if (!Array.isArray(stored)) return []
  const entries = stored.flatMap((entry): SearchOperationEntry[] => {
    if (!entry || typeof entry !== 'object' || !Number.isFinite(entry.time) || entry.time < 0) return []
    const operation = restoredOperation(meta, entry.operation, includeCriteria)
    return operation ? [{ id: operationId(operation), operation, time: entry.time, pinned: entry.pinned === true,
      ...(operation.type === 'text' && entry.source === 'live' ? { source: 'live' as const } : {}) }] : []
  }).sort((a, b) => b.time - a.time)
  const byId = new Map<string, SearchOperationEntry>()
  for (const entry of entries) {
    const previous = byId.get(entry.id)
    if (!previous) byId.set(entry.id, entry)
    else {
      if (entry.pinned) previous.pinned = true
      if (!entry.source) delete previous.source
    }
  }
  return limitRecent([...byId.values()])
}

function textIdentity(link: string) {
  const params = new URLSearchParams(link.slice(3))
  const raw = params.get('q') ?? ''
  const professional = hasExplicitSearchSyntax(raw)
  const query = professional ? raw.trim() : normalizeQuranSearch(raw, false, params.get('sp') === '1')
  params.delete('q')
  return { query, professional, filters: params.toString() }
}

function isContinuation(a: string, b: string) {
  if (a.includes('"') || b.includes('"') || Math.min(a.length, b.length) < 3) return false
  if (a.startsWith(b) || b.startsWith(a)) return true
  const aEnd = a.lastIndexOf(' '), bEnd = b.lastIndexOf(' ')
  if (aEnd < 0 || aEnd !== bEnd || a.slice(0, aEnd + 3) !== b.slice(0, bEnd + 3)) return false
  const aLast = a.slice(aEnd + 1), bLast = b.slice(bEnd + 1)
  return Math.min(aLast.length, bLast.length) >= 4 && typoDistance(aLast, bLast, 1) === 1
}

export function rememberOperation(entries: SearchOperationEntry[], operation: SearchOperation, time: number, source: SearchHistorySource = 'confirmed') {
  let id = operationId(operation)
  const identity = operation.type === 'text' ? textIdentity(operation.link) : null
  let previous = entries.find(entry => entry.id === id)
  let previousQuery = identity?.query
  if (!previous && identity?.query) {
    for (const entry of entries) {
      if (entry.pinned || entry.operation.type !== 'text') continue
      const candidate = textIdentity(entry.operation.link)
      if (identity.filters !== candidate.filters) continue
      if (identity.query !== candidate.query && (
        time - entry.time > CONTINUATION_WINDOW || (source === 'confirmed' && !entry.source) ||
        identity.professional || candidate.professional || !isContinuation(identity.query, candidate.query)
      )) continue
      previous = entry
      previousQuery = candidate.query
      break
    }
  }
  if (previous && source === 'live' && (!previous.source || (previousQuery?.length ?? 0) > (identity?.query.length ?? 0))) {
    // A confirmed search or a more complete live phrase wins over a recent edit.
    operation = previous.operation
    id = previous.id
    source = previous.source ?? 'confirmed'
  }
  const entry: SearchOperationEntry = { id, operation, time, pinned: previous?.pinned ?? false,
    ...(source === 'live' && operation.type === 'text' ? { source } : {}) }
  return limitRecent([entry, ...entries.filter(item => item.id !== id && item.id !== previous?.id)])
}

export function toggleOperationPin(entries: SearchOperationEntry[], id: string) {
  return limitRecent(entries.map(entry => entry.id === id ? { ...entry, pinned: !entry.pinned } : entry))
}
