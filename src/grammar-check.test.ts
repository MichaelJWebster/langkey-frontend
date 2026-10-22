import { describe, expect, it } from 'vitest'
import { checkGrammar } from './grammar-check'

describe('checkGrammar', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(checkGrammar('i dag  jobber jeg', ['I dag jobber jeg.'])).toBe('ok')
    expect(checkGrammar('Vi spiser middag og vi ser på TV', ['Vi spiser middag, og vi ser på TV.'])).toBe('ok')
  })

  it('accepts any of the listed answers', () => {
    expect(checkGrammar('jenten', ['Jenta', 'Jenten'])).toBe('ok')
  })

  it('marks word order', () => {
    expect(checkGrammar('I dag jeg jobber.', ['I dag jobber jeg.'])).toBe('wrong')
  })

  it('reports a missing æ ø å as its own kind of wrong', () => {
    expect(checkGrammar('Pa lordag spiser vi middag', ['På lørdag spiser vi middag.'])).toBe('letters')
    expect(checkGrammar('Hun er trott', ['Hun er trøtt.'])).toBe('letters')
  })
})
