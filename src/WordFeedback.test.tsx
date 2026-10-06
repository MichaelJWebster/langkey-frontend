// @vitest-environment jsdom
//
// The per-take marks are a hint and the tally is the signal, so these fix
// the line between them: a word is only called out once it has enough
// attempts behind it, and the panel never calls itself a grade.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import WordFeedback from './WordFeedback'
import type { Transcript } from './api'

const base: Transcript = {
  text: 'Møte slutter klokke åtte.',
  model: 'NbAiLab/nb-whisper-small',
  target: 'Møtet slutter klokka åtte.',
  attempts_for_pattern: 4,
  words: [
    { word: 'Møtet', verdict: 'slipped', heard: 'møte' },
    { word: 'slutter', verdict: 'said', heard: null },
    { word: 'klokka', verdict: 'slipped', heard: 'klokke' },
    { word: 'åtte.', verdict: 'said', heard: null },
  ],
  history: [
    { word: 'møtet', said: 3, attempts: 5, pattern: false },
    { word: 'slutter', said: 5, attempts: 5, pattern: false },
    { word: 'klokka', said: 7, attempts: 22, pattern: true },
    { word: 'åtte', said: 2, attempts: 2, pattern: false },
  ],
}

afterEach(cleanup)

describe('WordFeedback', () => {
  it('shows every target word', () => {
    render(<WordFeedback transcript={base} />)
    // klokka appears twice on purpose: inline, and again in the practise line.
    for (const w of ['Møtet', 'slutter', 'klokka', 'åtte.']) {
      expect(screen.getAllByText(w).length).toBeGreaterThan(0)
    }
  })

  it('names what the model put there instead', () => {
    render(<WordFeedback transcript={base} />)
    expect(screen.getByText('→ klokke')).toBeTruthy()
    expect(screen.getByText('→ møte')).toBeTruthy()
  })

  it('calls out only the word with enough attempts behind it', () => {
    render(<WordFeedback transcript={base} />)
    const practise = screen.getByText(/Worth practising/)
    expect(practise.textContent).toContain('klokka')
    expect(practise.textContent).toContain('7/22')
    // Never said wrong often enough, or not enough attempts yet.
    expect(practise.textContent).not.toContain('møtet')
    expect(practise.textContent).not.toContain('åtte')
  })

  it('hides the tally for a word with too few attempts to mean anything', () => {
    render(<WordFeedback transcript={base} />)
    expect(screen.queryByText('2/2')).toBeNull() // åtte, only two attempts
    expect(screen.getAllByText('7/22').length).toBeGreaterThan(0)
  })

  it('says plainly that it is not a grade', () => {
    render(<WordFeedback transcript={base} />)
    expect(screen.getByText(/not a grade/)).toBeTruthy()
  })

  it('draws no conclusions when nothing has a record yet', () => {
    render(<WordFeedback transcript={{ ...base, history: [] }} />)
    expect(screen.queryByText(/Worth practising/)).toBeNull()
  })
})
