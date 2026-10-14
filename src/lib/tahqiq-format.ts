export type TahqiqPart = { kind: 'text' | 'reference' | 'quran'; text: string }

/** Conservative formatting of the APK's citation + vocalized verse pattern.
 * All source characters are preserved; unrecognized passages stay as prose.
 */
export function splitTahqiqText(text: string): TahqiqPart[] {
  const reference = /سوره\s+(?:مبار[کك]ه\s+)?[^:\n]{1,45}?\s+آ[یي]ه\s*[۰-۹٠-٩0-9]+\s*[:：]/g
  const parts: TahqiqPart[] = []
  let cursor = 0
  for (const match of text.matchAll(reference)) {
    const start = match.index!
    if (start < cursor) continue
    if (start > cursor) parts.push({ kind: 'text', text: text.slice(cursor, start) })
    parts.push({ kind: 'reference', text: match[0] })
    let position = start + match[0].length
    const tokens = [...text.slice(position).matchAll(/\s*([^\s،؛.]+)/g)]
    let end = position
    let found = false
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (position + token.index! > end) break // punctuation or another gap ends the quotation
      const value = token[1]
      const vocalized = /[\u064b-\u065f\u0670\u06d6-\u06ed]/.test(value)
      const particle = value === 'و' && /[\u064b-\u065f\u0670]/.test(tokens[i + 1]?.[1] ?? '')
      if (!vocalized && !particle) break
      found = true
      end = position + token.index! + token[0].length
    }
    if (found) parts.push({ kind: 'quran', text: text.slice(position, end) })
    cursor = found ? end : position
  }
  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) })
  return parts.length ? parts : [{ kind: 'text', text }]
}
