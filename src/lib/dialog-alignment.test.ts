import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('dialog system headings follow the document writing direction', () => {
  for (const file of ['src/components/ui/dialog.tsx', 'src/components/ui/alert-dialog.tsx']) {
    const source = readFileSync(resolve(import.meta.dir, '../..', file), 'utf8')
    expect(source).toContain('flex flex-col gap-2 text-start')
    expect(source).not.toContain('text-center sm:text-left')
  }
})
