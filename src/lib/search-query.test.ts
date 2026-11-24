import { expect, test } from 'bun:test'
import { searchOrder, searchProximity } from './search-query'

test('the order signal favors words in query order at the same proximity', () => {
  const forward = [[1], [2]]
  const reverse = [[2], [1]]
  expect(searchProximity(forward)).toBe(searchProximity(reverse))
  expect(searchOrder(forward)).toBe(0.5)
  expect(searchOrder(reverse)).toBe(0)
  expect(searchOrder([[1, 4], [7], [8]])).toBe(0.2)
})
