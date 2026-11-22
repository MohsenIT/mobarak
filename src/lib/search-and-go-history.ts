import { resolveDestination, type Destination } from './navigation'
import type { Meta } from './quran'
import { readSearchLink, searchLink, type SearchLinkState } from './search-link'

export const SEARCH_AND_GO_HISTORY_KEY = 'mushaf.search-and-go-history.v1'
const RECENT_LIMIT = 12

export type SearchOperation = { type: 'navigation'; destination: Destination; word?: number } | { type: 'text'; link: string }
export type SearchOperationEntry = { id: string; operation: SearchOperation; time: number; pinned: boolean }

export function textSearchOperation(state: SearchLinkState): SearchOperation | null {
  if (state.mode !== 'text' || state.occurrence || !state.query.trim()) return null
  const url = searchLink('https://mobarak.invalid', state)
  return { type: 'text', link: url.pathname + url.search }
}

function restoredOperation(meta: Meta, input: unknown): SearchOperation | null {
  if (!input || typeof input !== 'object') return null
  const operation = input as SearchOperation
  if (operation.type === 'text') {
    const link = operation.link
    if (typeof link !== 'string' || !link.startsWith('/q?')) return null
    const state = readSearchLink(link)
    return state && textSearchOperation(state)
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

export function readOperationHistory(meta: Meta, stored: unknown): SearchOperationEntry[] {
  if (!Array.isArray(stored)) return []
  const entries = stored.flatMap((entry): SearchOperationEntry[] => {
    if (!entry || typeof entry !== 'object' || !Number.isFinite(entry.time) || entry.time < 0) return []
    const operation = restoredOperation(meta, entry.operation)
    return operation ? [{ id: operationId(operation), operation, time: entry.time, pinned: entry.pinned === true }] : []
  }).sort((a, b) => b.time - a.time)
  const byId = new Map<string, SearchOperationEntry>()
  for (const entry of entries) {
    const previous = byId.get(entry.id)
    if (!previous) byId.set(entry.id, entry)
    else if (entry.pinned) previous.pinned = true
  }
  return limitRecent([...byId.values()])
}

export function rememberOperation(entries: SearchOperationEntry[], operation: SearchOperation, time: number) {
  const id = operationId(operation)
  const pinned = entries.find(entry => entry.id === id)?.pinned ?? false
  return limitRecent([{ id, operation, time, pinned }, ...entries.filter(entry => entry.id !== id)])
}

export function toggleOperationPin(entries: SearchOperationEntry[], id: string) {
  return limitRecent(entries.map(entry => entry.id === id ? { ...entry, pinned: !entry.pinned } : entry))
}
