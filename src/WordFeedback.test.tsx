// @vitest-environment jsdom
//
// The per-take marks are a hint and the tally is the signal, so these fix
// the line between them: a word is only called out once it has enough
// attempts behind it, and the panel never calls itself a grade.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Transcript } from './api'

// jsdom has no Web Audio, so the playback module is stood in for: what
// matters here is which stretches of which clip it is asked to play, and in
// which ear.
const playSegments = vi.fn(async () => {})
let canPlay = true
vi.mock('./playback', () => ({
  canPlaySegments: () => canPlay,
  playSegments: (...a: unknown[]) => (playSegments as unknown as (...x: unknown[]) => unknown)(...a),
  stop: () => {},
}))

const fetchClipWords = vi.fn(async (_text: string, scale: number) => ({
  url: `/api/v1/audio/nb/ref-${scale}.wav`,
  scale,
  model: 'fake-aligner',
  words: [
    { word: 'møtet', start: 0.2, end: 0.6 },
    { word: 'slutter', start: 0.6, end: 1.1 },
    { word: 'klokka', start: 1.1, end: 1.6 },
    { word: 'åtte', start: 1.7, end: 2.0 },
  ],
}))
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  fetchClipWords: (...a: unknown[]) =>
    (fetchClipWords as unknown as (...x: unknown[]) => unknown)(...a),
}))

const referenceBlob = new Blob(['ref'])
vi.mock('./speech', () => ({
  fetchClip: async () => referenceBlob,
}))

import WordFeedback from './WordFeedback'

const base: Transcript = {
  text: 'Møte slutter klokke åtte.',
  model: 'NbAiLab/nb-whisper-small',
  target: 'Møtet slutter klokka åtte.',
  attempts_for_pattern: 4,
  aligned: true,
  words: [
    { word: 'Møtet', verdict: 'slipped', heard: 'møte', take: { start: 0.9, end: 1.3 } },
    { word: 'slutter', verdict: 'said', heard: null, take: { start: 1.3, end: 1.9 } },
    { word: 'klokka', verdict: 'slipped', heard: 'klokke', take: { start: 1.9, end: 2.5 } },
    { word: 'åtte.', verdict: 'said', heard: null, take: { start: 2.6, end: 3.0 } },
  ],
  history: [
    { word: 'møtet', said: 3, attempts: 5, pattern: false },
    { word: 'slutter', said: 5, attempts: 5, pattern: false },
    { word: 'klokka', said: 7, attempts: 22, pattern: true },
    { word: 'åtte', said: 2, attempts: 2, pattern: false },
  ],
}

const takeBlob = new Blob(['take'])
const take = { blob: takeBlob, key: 'take-1' }

beforeEach(() => {
  playSegments.mockClear()
  fetchClipWords.mockClear()
  canPlay = true
})
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

// Michael: "When I don't get a sound or word, I'd like to have the ability to
// play the word against my attempt so I can compare... both simultaneous
// playing panned hard left and right... and also to play each word
// separately. The words should come from the actual sentence audio."
describe('hearing one word', () => {
  it('offers nothing to tap without a take to compare against', () => {
    render(<WordFeedback transcript={base} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByTestId('word-compare')).toBeNull()
  })

  it('offers nothing where words cannot be cut out of a clip', () => {
    canPlay = false
    render(<WordFeedback transcript={base} take={take} scale={3.4} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the three ways to hear a word once it is tapped', async () => {
    render(<WordFeedback transcript={base} take={take} scale={3.4} />)
    fireEvent.click(screen.getByRole('button', { name: 'klokka' }))

    const row = await screen.findByTestId('word-compare')
    expect(row.textContent).toContain('klokka')
    expect(screen.getByText('▸ Reference')).toBeTruthy()
    expect(screen.getByText('▸ You')).toBeTruthy()
    expect(screen.getByText('▸ Both')).toBeTruthy()
  })

  it('plays the reference word cut from the clip at the speed on screen', async () => {
    render(<WordFeedback transcript={base} take={take} scale={2.2} />)
    fireEvent.click(screen.getByRole('button', { name: 'klokka' }))
    const button = screen.getByText('▸ Reference') as HTMLButtonElement
    await waitFor(() => expect(button.disabled).toBe(false))

    fireEvent.click(button)

    expect(fetchClipWords).toHaveBeenCalledWith('Møtet slutter klokka åtte.', 2.2)
    expect(playSegments).toHaveBeenCalledTimes(1)
    const [segments] = playSegments.mock.calls[0] as unknown as [
      { blob: Blob; key: string; start: number; end: number; pan: number }[],
    ]
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ key: '/api/v1/audio/nb/ref-2.2.wav', start: 1.1, end: 1.6 })
  })

  it('plays your own word from the stretch of the take the model heard it in', async () => {
    render(<WordFeedback transcript={base} take={take} scale={3.4} />)
    fireEvent.click(screen.getByRole('button', { name: 'klokka' }))

    fireEvent.click(screen.getByText('▸ You'))

    const [segments] = playSegments.mock.calls[0] as unknown as [
      { blob: Blob; key: string; start: number; end: number }[],
    ]
    expect(segments[0]).toMatchObject({ blob: takeBlob, key: 'take-1', start: 1.9, end: 2.5 })
  })

  it('plays both together, reference in the left ear and you in the right', async () => {
    render(<WordFeedback transcript={base} take={take} scale={3.4} />)
    fireEvent.click(screen.getByRole('button', { name: 'klokka' }))
    const both = screen.getByText('▸ Both') as HTMLButtonElement
    await waitFor(() => expect(both.disabled).toBe(false))

    fireEvent.click(both)

    const [segments] = playSegments.mock.calls[0] as unknown as [
      { key: string; pan: number; start: number }[],
    ]
    expect(segments).toHaveLength(2)
    expect(segments.find((s) => s.key.includes('ref'))).toMatchObject({ pan: -1, start: 1.1 })
    expect(segments.find((s) => s.key === 'take-1')).toMatchObject({ pan: 1, start: 1.9 })
  })

  it('fetches the reference once, however many words are tapped', async () => {
    render(<WordFeedback transcript={base} take={take} scale={3.4} />)
    fireEvent.click(screen.getByRole('button', { name: 'klokka' }))
    await waitFor(() =>
      expect((screen.getByText('▸ Reference') as HTMLButtonElement).disabled).toBe(false),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Møtet' }))
    await waitFor(() =>
      expect((screen.getByText('▸ Reference') as HTMLButtonElement).disabled).toBe(false),
    )

    expect(fetchClipWords).toHaveBeenCalledTimes(1)
  })

  it('says why your side is silent when nothing of yours was heard there', () => {
    const missed: Transcript = {
      ...base,
      words: base.words.map((w) =>
        w.word === 'klokka' ? { ...w, verdict: 'missed', heard: null, take: null } : w,
      ),
    }
    render(<WordFeedback transcript={missed} take={take} scale={3.4} />)
    fireEvent.click(screen.getByRole('button', { name: 'klokka' }))

    const you = screen.getByText('▸ You') as HTMLButtonElement
    expect(you.disabled).toBe(true)
    expect(you.title).toMatch(/nothing of yours was heard/)
    expect((screen.getByText('▸ Both') as HTMLButtonElement).disabled).toBe(true)
  })

  it('says so when the take could not be placed at all', () => {
    const unplaced: Transcript = {
      ...base,
      aligned: false,
      words: base.words.map((w) => ({ ...w, take: null })),
    }
    render(<WordFeedback transcript={unplaced} take={take} scale={3.4} />)
    fireEvent.click(screen.getByRole('button', { name: 'klokka' }))
    expect((screen.getByText('▸ You') as HTMLButtonElement).title).toMatch(/could not be placed/)
  })
})
