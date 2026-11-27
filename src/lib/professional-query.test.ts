import { expect, test } from 'bun:test'
import { parseProfessionalQuery, type ProfessionalNode } from './professional-query'

const atom = (...words: string[]): ProfessionalNode => ({ kind: 'atom', atom: { words, exact: false } })
const exact = (...words: string[]): ProfessionalNode => ({ kind: 'atom', atom: { words, exact: true } })

test('ordinary words keep the existing search route', () => {
  for (const input of ['', 'قول رحمة', 'قول OR رحمة', 'والله']) {
    expect(parseProfessionalQuery(input)).toEqual({ status: 'ordinary' })
  }
})

test('Arabic vowels and each wildcard retain the raw pattern for matching', () => {
  expect(parseProfessionalQuery('قُلْ ر؟مة ر?مة ر*')).toEqual({
    status: 'valid', boolean: false,
    node: { kind: 'and', children: [atom('قُلْ'), atom('ر؟مة'), atom('ر?مة'), atom('ر*')] },
  })
  expect(parseProfessionalQuery('و')).toEqual({ status: 'valid', boolean: false, node: atom('و') })
})

test('quoted groups preserve order, repetition, wildcards, and literal punctuation', () => {
  for (const input of ['"قول قول ر؟مة | -علم"', '“قول قول ر؟مة | -علم”', '«قول قول ر؟مة | -علم»']) {
    expect(parseProfessionalQuery(input)).toEqual({
      status: 'valid', boolean: false, node: exact('قول', 'قول', 'ر؟مة', '|', '-علم'),
    })
  }
})

test('negation binds before whitespace conjunction and disjunction', () => {
  expect(parseProfessionalQuery('قول −علم | رحمة مغفرة')).toEqual({
    status: 'valid', boolean: true,
    node: { kind: 'or', children: [
      { kind: 'and', children: [atom('قول'), { kind: 'not', child: atom('علم') }] },
      { kind: 'and', children: [atom('رحمة'), atom('مغفرة')] },
    ] },
  })
})

test('parentheses group mixed alternatives and exclusions', () => {
  expect(parseProfessionalQuery('(قول|رحمة) -(علم|مغفرة)')).toEqual({
    status: 'valid', boolean: true,
    node: { kind: 'and', children: [
      { kind: 'or', children: [atom('قول'), atom('رحمة')] },
      { kind: 'not', child: { kind: 'or', children: [atom('علم'), atom('مغفرة')] } },
    ] },
  })
})

test('gaps bind adjacent ordered atoms with inclusive bounds in all three digit systems', () => {
  expect(parseProfessionalQuery('قول...رحمة …{ ۰ , ٢ } "من علم" (*) مغفرة ...{3} رب')).toEqual({
    status: 'valid', boolean: false,
    node: {
      kind: 'sequence',
      atoms: [
        { words: ['قول'], exact: false }, { words: ['رحمة'], exact: false },
        { words: ['من', 'علم'], exact: true }, { words: ['مغفرة'], exact: false },
        { words: ['رب'], exact: false },
      ],
      gaps: [{ min: 0, max: Infinity }, { min: 0, max: 2 }, { min: 1, max: 1 }, { min: 3, max: 3 }],
    },
  })
})

test('an ordered gap can serve as an alternative in a Boolean expression', () => {
  expect(parseProfessionalQuery('علم|قول…{0}رحمة')).toEqual({
    status: 'valid', boolean: true,
    node: { kind: 'or', children: [atom('علم'), {
      kind: 'sequence',
      atoms: [{ words: ['قول'], exact: false }, { words: ['رحمة'], exact: false }],
      gaps: [{ min: 0, max: 0 }],
    }] },
  })
})

test('incomplete expressions and malformed bounds take the invalid route', () => {
  for (const input of [
    'قول |', '| قول', 'قول || رحمة', '(قول', 'قول)', '()', '- علم', 'قول-', 'قول-علم',
    '"قول', 'قول”', '"  "', 'قول "رحمة"علم', 'قول ...', '... قول', 'قول .... رحمة',
    'قول ...{۳,۲} رحمة', 'قول ...{-1} رحمة', 'قول ...{x} رحمة', 'قول …{2,} رحمة',
    'قول ...{3 رحمة', 'قول ...{99999999999999999999} رحمة',
    'قول ... ... رحمة', 'قول ... -رحمة', 'قول ... (رحمة | مغفرة)',
  ]) {
    expect(parseProfessionalQuery(input)).toEqual({ status: 'invalid' })
  }
})

test('oversized and deeply nested expressions return a safe invalid result', () => {
  expect(parseProfessionalQuery(`قول | ${'رحمة '.repeat(500)}`)).toEqual({ status: 'invalid' })
  expect(parseProfessionalQuery(`${'('.repeat(100)}قول${')'.repeat(100)}`)).toEqual({ status: 'invalid' })
})
