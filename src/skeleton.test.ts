import { describe, expect, it } from 'vitest'
import { hasMistake, shapeOf, skeleton, typedWords } from './skeleton'

const shapes = (target: string, typed: string) =>
  skeleton(target, typed)
    .slots.map((s) => (s.state === 'blank' || s.state === 'wrong' ? s.shape : s.word))
    .join(' ')

describe('shapeOf', () => {
  it('writes one underscore per letter and leaves punctuation standing', () => {
    expect(shapeOf('Hva')).toBe('___')
    expect(shapeOf('du?')).toBe('__?')
    expect(shapeOf('"Nei,')).toBe('"___,')
  })

  it('counts æ ø å as single letters', () => {
    expect(shapeOf('forstår')).toBe('_______')
    expect(shapeOf('på')).toBe('__')
  })

  it('blanks digits too, since they are typed like anything else', () => {
    expect(shapeOf('klokka')).toBe('______')
    expect(shapeOf('12.')).toBe('__.')
  })
})

describe('typedWords', () => {
  it('treats the last word as still being typed', () => {
    expect(typedWords('Hva het')).toEqual({ words: ['Hva', 'het'], complete: 1 })
  })

  it('treats a trailing space as "done with that one"', () => {
    expect(typedWords('Hva het ')).toEqual({ words: ['Hva', 'het'], complete: 2 })
  })

  it('has nothing complete while the first word is underway', () => {
    expect(typedWords('Hv').complete).toBe(0)
    expect(typedWords('').complete).toBe(0)
  })
})

describe('skeleton', () => {
  it('starts as underscores with the punctuation showing', () => {
    expect(shapes('Hva heter du?', '')).toBe('___ _____ __?')
  })

  it('fills a word in once it is complete and correct', () => {
    expect(shapes('Hva heter du?', 'Hva ')).toBe('Hva _____ __?')
    expect(shapes('Hva heter du?', 'Hva heter ')).toBe('Hva heter __?')
  })

  it('shows the word in the sentence case, not what was typed', () => {
    expect(shapes('Hva heter du?', 'hva ')).toBe('Hva _____ __?')
  })

  // The rule Michael asked for: nothing happens until a word is finished.
  it('reveals nothing at all while a word is being typed', () => {
    for (const typed of ['H', 'Hv', 'Hva']) {
      expect(shapes('Hva heter du?', typed)).toBe('___ _____ __?')
    }
  })

  it('does not flag a part-typed word as wrong', () => {
    // "het" is not "heter" yet, and must not be marked.
    const s = skeleton('Hva heter du?', 'Hva het')
    expect(hasMistake(s)).toBe(false)
    expect(s.slots[1].state).toBe('blank')
  })

  it('flags a completed word that is wrong, and keeps it hidden', () => {
    const s = skeleton('Hva heter du?', 'Hva kaller ')
    expect(s.slots[1].state).toBe('wrong')
    expect(hasMistake(s)).toBe(true)
    // A wrong guess must not be rewarded with the answer.
    expect(shapes('Hva heter du?', 'Hva kaller ')).toBe('Hva _____ __?')
  })

  it('clears the mistake when the word is corrected', () => {
    expect(hasMistake(skeleton('Hva heter du?', 'Hva kaller '))).toBe(true)
    expect(hasMistake(skeleton('Hva heter du?', 'Hva heter '))).toBe(false)
  })

  it('counts a plain a for å as near, never as a mistake', () => {
    const s = skeleton('Forstår du?', 'Forstar ')
    expect(s.slots[0].state).toBe('near')
    expect(hasMistake(s)).toBe(false)
    // Near shows the real spelling, which is the thing worth seeing.
    expect(shapes('Forstår du?', 'Forstar ')).toBe('Forstår __?')
  })

  it('judges each position independently, so a later word still fills', () => {
    const s = skeleton('Hva heter du?', 'Hvem heter ')
    expect(s.slots.map((x) => x.state)).toEqual(['wrong', 'filled', 'blank'])
  })

  it('reports words typed past the end of the sentence', () => {
    const s = skeleton('Hva heter du?', 'Hva heter du i dag ')
    expect(s.extra).toBe(2)
    expect(hasMistake(s)).toBe(true)
  })

  it('ignores the punctuation the learner did not type', () => {
    const s = skeleton('Hva heter du?', 'Hva heter du ')
    expect(s.slots.every((x) => x.state === 'filled')).toBe(true)
    expect(hasMistake(s)).toBe(false)
  })

  it('copes with runs of spaces rather than counting empty words', () => {
    expect(typedWords('Hva   heter ').words).toEqual(['Hva', 'heter'])
    expect(hasMistake(skeleton('Hva heter du?', 'Hva   heter '))).toBe(false)
  })
})
