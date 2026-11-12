import { expect, test } from 'bun:test'
import { visibleFacetCount } from './search-facet-layout'

test('all fitting options use the line without an unnecessary more action', () => {
  expect(visibleFacetCount(330, [80, 70, 60, 70], [0, 70, 70, 70, 70], 5)).toBe(4)
  expect(visibleFacetCount(295, [80, 70, 60, 70], [0, 70, 70, 70, 70], 5)).toBe(4)
})
test('overflow reserves the actual action width and reacts to the viewport', () => {
  expect(visibleFacetCount(290, [80, 70, 60, 70], [0, 60, 60, 60, 60], 5)).toBe(3)
  expect(visibleFacetCount(235, [80, 70, 60, 70], [0, 70, 70, 70, 70], 5)).toBe(2)
  expect(visibleFacetCount(100, [80, 70], [0, 70, 70], 5)).toBe(0)
  expect(visibleFacetCount(0, [], [], 5)).toBe(0)
})
