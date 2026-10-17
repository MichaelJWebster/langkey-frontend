import { describe, expect, it } from 'vitest'
import { alignedWith, deal, labelOf, shuffle, type GamePair } from './matching-game'

const PAIRS: GamePair[] = [
  { en: 'what', no: 'hva', note: null },
  { en: 'who', no: 'hvem', note: null },
  { en: 'where', no: 'hvor', note: null },
  { en: 'when', no: 'når', note: null },
  { en: 'how long', no: 'hvor lenge', note: 'time' },
  { en: 'how far', no: 'hvor langt', note: 'distance' },
]

/** A deterministic stand-in for Math.random. */
const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}

describe('shuffle', () => {
  it('keeps every item exactly once', () => {
    const out = shuffle([1, 2, 3, 4, 5], seeded(7))
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('does not disturb the input', () => {
    const input = [1, 2, 3]
    shuffle(input, seeded(1))
    expect(input).toEqual([1, 2, 3])
  })
})

describe('deal', () => {
  it('puts the English on the left and the Norwegian on the right', () => {
    const { left, right } = deal(PAIRS, seeded(3))
    expect(left.map((c) => c.side)).toEqual(Array(6).fill('en'))
    expect(right.map((c) => c.side)).toEqual(Array(6).fill('no'))
    expect(left.map((c) => c.label).sort()).toEqual(PAIRS.map((p) => p.en).sort())
    expect(right.map((c) => c.label).sort()).toEqual(PAIRS.map((p) => p.no).sort())
  })

  // The requirement Michael was specific about.
  it('never leaves a card facing its own pair', () => {
    for (let seed = 1; seed < 60; seed++) {
      const { left, right } = deal(PAIRS, seeded(seed))
      expect(alignedWith(left, right)).toBe(false)
    }
  })

  it('breaks an alignment even when the shuffle refuses to help', () => {
    // A degenerate rnd that always returns 0 leaves Fisher-Yates reversing
    // nothing useful, so both columns come out identically ordered.
    const { left, right } = deal(PAIRS, () => 0)
    expect(alignedWith(left, right)).toBe(false)
  })

  it('leaves a single pair alone rather than looping forever', () => {
    const { left, right } = deal([PAIRS[0]], seeded(2))
    expect(left).toHaveLength(1)
    expect(right).toHaveLength(1)
  })

  it('keeps a card’s key pointing at its own pair', () => {
    const { left, right } = deal(PAIRS, seeded(5))
    for (const card of left) {
      const partner = right.find((c) => c.key === card.key)
      const pair = PAIRS.find((p) => p.en === card.label)
      expect(partner?.label).toBe(pair?.no)
    }
  })
})

describe('labelOf', () => {
  it('adds the note only where there is one', () => {
    expect(labelOf({ key: 0, label: 'what', note: null, side: 'en' })).toBe('what')
    expect(labelOf({ key: 4, label: 'how long', note: 'time', side: 'en' })).toBe(
      'how long (time)',
    )
  })

  // The note separates two English words that would otherwise read the same.
  // "hvor lenge" and "hvor langt" are already different words, so repeating it
  // on the Norwegian card labels the answer instead of the question.
  it('leaves the Norwegian side unannotated', () => {
    expect(labelOf({ key: 4, label: 'hvor lenge', note: 'time', side: 'no' })).toBe(
      'hvor lenge',
    )
    expect(
      labelOf({ key: 5, label: 'hvor langt', note: 'distance', side: 'no' }),
    ).toBe('hvor langt')
  })
})
