import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('dialog system headings follow the document writing direction', () => {
  // alert-dialog.tsx was removed as dead code (zero imports anywhere in the
  // app, see AGENTS.md "dependency boundaries"); dialog.tsx is the only
  // component from this scaffold still in use.
  const source = readFileSync(resolve(import.meta.dir, '../..', 'src/components/ui/dialog.tsx'), 'utf8')
  expect(source).toContain('flex flex-col gap-2 text-start')
  expect(source).not.toContain('text-center sm:text-left')
})
