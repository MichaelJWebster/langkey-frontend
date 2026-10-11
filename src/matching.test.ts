import { describe, expect, it } from 'vitest'
import { acceptedAnswers, gradeAnswer, ratingFor, wordCredit } from './matching'

describe('acceptedAnswers', () => {
  it('splits comma alternatives and allows dropping articles', () => {
    const accepted = acceptedAnswers('a road, a way')
    expect(accepted).toContain('a road')
    expect(accepted).toContain('road')
    expect(accepted).toContain('a way')
    expect(accepted).toContain('way')
  })

  it('makes a parenthetical clarifier optional', () => {
    const accepted = acceptedAnswers('a bag (plastic/paper)')
    expect(accepted).toContain('a bag')
    expect(accepted).toContain('bag')
  })

  it('drops the infinitive marker', () => {
    expect(acceptedAnswers('to cook')).toContain('cook')
    expect(acceptedAnswers('å bo')).toContain('bo')
  })
})

describe('gradeAnswer', () => {
  it('accepts an exact answer and either alternative', () => {
    expect(gradeAnswer('a road, a way', 'a road').verdict).toBe('exact')
    expect(gradeAnswer('a road, a way', 'way').verdict).toBe('exact')
    expect(gradeAnswer('to cook', 'cook').verdict).toBe('exact')
  })

  it('ignores case and punctuation', () => {
    expect(gradeAnswer("can you repeat?", 'Can you repeat').verdict).toBe('exact')
  })

  it('treats a typo as close, not wrong', () => {
    const mark = gradeAnswer('expensive', 'expensiv')
    expect(mark.verdict).toBe('close')
    expect(mark.similarity).toBeGreaterThan(0.8)
  })

  it('rejects an unrelated guess', () => {
    expect(gradeAnswer('a window', 'a bicycle').verdict).toBe('wrong')
  })

  it('counts a missing diacritic against the answer', () => {
    // Was "exact" until ADR-040: æ ø å have buttons under the box now, so
    // leaving them off costs what any other wrong letter costs.
    expect(gradeAnswer('å forstå', 'a forsta').verdict).toBe('close')
    expect(gradeAnswer('en jente', 'en jentæ').verdict).toBe('close')
  })

  it('marks a diacritic slip on a short word wrong, like any other', () => {
    // The minimal-pair guard applies here too, and should: "far" and "får"
    // are different words, not one word spelt carelessly.
    expect(gradeAnswer('å høre', 'a hore').verdict).toBe('wrong')
  })

  it('still accepts the infinitive marker being left off', () => {
    expect(gradeAnswer('å høre', 'høre').verdict).toBe('exact')
  })

  it('still marks a wrong Norwegian word wrong', () => {
    expect(gradeAnswer('å høre', 'å snakke').verdict).toBe('wrong')
  })
})

describe('ratingFor', () => {
  it('rewards a fast exact answer with Easy and a slower one with Good', () => {
    const exact = gradeAnswer('a cat', 'a cat')
    expect(ratingFor(exact, 2000)).toBe(4)
    expect(ratingFor(exact, 20000)).toBe(3)
  })

  it('gives a near miss Hard and a wrong answer Again', () => {
    expect(ratingFor(gradeAnswer('expensive', 'expensiv'), 3000)).toBe(2)
    expect(ratingFor(gradeAnswer('a window', 'a bicycle'), 3000)).toBe(1)
  })
})

describe('wordCredit', () => {
  it('gives full credit for a right word and partial for a near spelling', () => {
    expect(wordCredit('tusen', 'tusen')).toBe(1)
    expect(wordCredit('tusex', 'tusen')).toBeCloseTo(0.8)
  })

  it('gives nothing for an unrelated or missing word', () => {
    expect(wordCredit('zebra', 'maten')).toBe(0)
    expect(wordCredit(undefined, 'maten')).toBe(0)
  })
})

describe('optional sentence openers', () => {
  it('accepts the meaningful part of a sentence-y entry', () => {
    expect(gradeAnswer("I'm sorry", 'sorry').verdict).toBe('exact')
    expect(gradeAnswer("I'm sorry", "I'm sorry").verdict).toBe('exact')
    expect(gradeAnswer("I'm just looking", 'just looking').verdict).toBe('exact')
  })

  it('does not let an opener alone pass', () => {
    expect(gradeAnswer("I'm sorry", "I'm").verdict).toBe('wrong')
  })
})

describe('short answers are minimal pairs, not typos', () => {
  it('marks a one-letter miss on a short word wrong', () => {
    expect(gradeAnswer('å bo', 'bok').verdict).toBe('wrong')
    expect(gradeAnswer('hun', 'han').verdict).toBe('wrong')
    expect(gradeAnswer('en mann', 'menn').verdict).toBe('wrong')
  })

  it('still forgives a typo in a longer word', () => {
    expect(gradeAnswer('expensive', 'expensiv').verdict).toBe('close')
  })
})

describe('vouched-for alternatives', () => {
  it('accepts an answer the learner recorded', () => {
    expect(gradeAnswer('because', 'since').verdict).toBe('wrong')
    expect(gradeAnswer('because', 'since', ['since']).verdict).toBe('exact')
  })

  it('normalises the recorded answer too', () => {
    expect(gradeAnswer('a road', 'Street!', ['a street']).verdict).toBe('exact')
  })
})
