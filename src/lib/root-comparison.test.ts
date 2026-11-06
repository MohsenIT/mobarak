import { expect, test } from 'bun:test'
import { mutedComparisonRoots, toggleComparisonRoot, visibleComparison } from './root-comparison'

const roots = { كتب: 10, علم: 20, رحم: 30 }

test('no solo, no hidden: every root is visible', () => {
  expect([...mutedComparisonRoots(roots, visibleComparison())]).toEqual([])
})

test('a hidden root is muted and the others stay visible', () => {
  const visibility = { hidden: new Set(['علم']), solo: null }
  expect([...mutedComparisonRoots(roots, visibility)]).toEqual(['علم'])
})

test('solo mutes every other root and ignores the hidden set', () => {
  // The hidden set is remembered but not consulted while a root is soloed.
  const visibility = { hidden: new Set(['رحم']), solo: 'كتب' }
  expect([...mutedComparisonRoots(roots, visibility)].sort()).toEqual(['رحم', 'علم'])
})

test('muting a root that is not in the comparison has no display effect', () => {
  const visibility = { hidden: new Set(['غفر']), solo: null }
  expect([...mutedComparisonRoots(roots, visibility)]).toEqual([])
})

test('tapping a visible root mutes it, tapping a muted root reveals it', () => {
  const muted = toggleComparisonRoot('كتب', visibleComparison())
  expect([...muted.hidden]).toEqual(['كتب'])
  const revealed = toggleComparisonRoot('كتب', muted)
  expect([...revealed.hidden]).toEqual([])
})

test('tapping a root while another is soloed leaves solo mode', () => {
  // Tapping a *different* root than the soloed one reveals it and keeps the
  // previously muted roots muted, while dropping solo.
  const next = toggleComparisonRoot('علم', { hidden: new Set(['رحم']), solo: 'كتب' })
  expect(next.solo).toBeNull()
  expect([...next.hidden].sort()).toEqual(['رحم'])
})

test('tapping the soloed root itself mutes it and leaves solo mode', () => {
  const next = toggleComparisonRoot('كتب', { hidden: new Set(), solo: 'كتب' })
  expect(next.solo).toBeNull()
  expect([...next.hidden]).toEqual(['كتب'])
})

test('toggling never mutates the set it was given', () => {
  const hidden = new Set(['علم'])
  const next = toggleComparisonRoot('رحم', { hidden, solo: null })
  expect([...hidden]).toEqual(['علم'])
  expect([...next.hidden].sort()).toEqual(['رحم', 'علم'])
})

test('a soloed root that has no occurrences still mutes everything else', () => {
  // Picking a root from the range sheet before its roots finish loading.
  expect([...mutedComparisonRoots(roots, { hidden: new Set(), solo: 'غفر' })].sort()).toEqual(['رحم', 'علم', 'كتب'])
})
