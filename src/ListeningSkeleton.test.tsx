// @vitest-environment jsdom
//
// The sentence skeleton in the listening exercise, and the two things Michael
// was specific about: nothing may happen while a word is being typed, and the
// wrong-answer cue sounds as a word is completed wrongly -- once, not once per
// keystroke for as long as the mistake stands.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const wrongTone = vi.fn()

vi.mock('./speech', () => ({
  speak: async () => {},
  stopSpeech: () => {},
  onAudioFailure: () => () => {},
  clearAudioFailure: () => {},
}))

vi.mock('./playback', () => ({
  wrongTone: () => wrongTone(),
}))

const DICTATION = {
  kind: 'dictation' as const,
  item_id: 1,
  example_id: 1,
  target: 'Hva heter du?',
  translation: 'What is your name?',
  suggested_scale: 1.6,
  speeds: [
    { scale: 2.8, url: '/audio/veryslow.wav' },
    { scale: 2.2, url: '/audio/slow.wav' },
    { scale: 1.6, url: '/audio/normal.wav' },
  ],
}

vi.mock('./api', () => ({
  fetchListening: async () => ({ exercises: [structuredClone(DICTATION)] }),
  postAttempt: async () => ({ status: 'ok' }),
}))

import ListeningSession from './ListeningSession'

beforeEach(() => wrongTone.mockClear())
afterEach(cleanup)

async function openSession() {
  render(<ListeningSession onFinish={() => {}} />)
  const input = await waitFor(() => screen.getByPlaceholderText(/Type the Norwegian/))
  return input as HTMLInputElement
}

const shape = () => screen.getByLabelText('The sentence so far').textContent

const type = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } })

describe('the sentence skeleton', () => {
  it('shows the shape of the sentence before anything is typed', async () => {
    await openSession()
    expect(shape()).toBe('___ _____ __?')
  })

  it('fills a word in once it is finished and right', async () => {
    const input = await openSession()
    type(input, 'Hva ')
    expect(shape()).toBe('Hva _____ __?')
  })

  it('shows nothing while a word is still being typed', async () => {
    const input = await openSession()
    for (const partial of ['H', 'Hv', 'Hva']) {
      type(input, partial)
      expect(shape()).toBe('___ _____ __?')
    }
  })
})

describe('the mistake light', () => {
  it('is off until a completed word is wrong', async () => {
    const input = await openSession()
    expect(screen.queryByText(/that word is not right/)).toBeNull()
    type(input, 'Hvem')
    // Still being typed — "Hvem" could yet become something else.
    expect(screen.queryByText(/that word is not right/)).toBeNull()
  })

  it('comes on when a word is completed wrongly', async () => {
    const input = await openSession()
    type(input, 'Hvem ')
    expect(screen.getByText(/that word is not right/)).toBeTruthy()
  })

  it('clears when the word is corrected', async () => {
    const input = await openSession()
    type(input, 'Hvem ')
    expect(screen.getByText(/that word is not right/)).toBeTruthy()
    type(input, 'Hva ')
    expect(screen.queryByText(/that word is not right/)).toBeNull()
  })

  it('clears when Hint fixes the answer', async () => {
    const input = await openSession()
    type(input, 'Hvem ')
    expect(screen.getByText(/that word is not right/)).toBeTruthy()
    fireEvent.click(screen.getByText('Hint'))
    expect(screen.queryByText(/that word is not right/)).toBeNull()
    // And the hinted word is one the learner has moved past, so it shows.
    expect(shape()).toBe('Hva _____ __?')
  })
})

describe('the wrong-answer cue', () => {
  it('does not sound while a word is being typed', async () => {
    const input = await openSession()
    type(input, 'H')
    type(input, 'Hv')
    type(input, 'Hvem')
    expect(wrongTone).not.toHaveBeenCalled()
  })

  it('sounds once as the word is completed wrongly', async () => {
    const input = await openSession()
    type(input, 'Hvem ')
    expect(wrongTone).toHaveBeenCalledTimes(1)
  })

  it('does not sound again while the same mistake stands', async () => {
    const input = await openSession()
    type(input, 'Hvem ')
    type(input, 'Hvem h')
    type(input, 'Hvem he')
    expect(wrongTone).toHaveBeenCalledTimes(1)
  })

  it('sounds again for a fresh mistake after the first is fixed', async () => {
    const input = await openSession()
    type(input, 'Hvem ')
    type(input, 'Hva ')
    expect(wrongTone).toHaveBeenCalledTimes(1)
    type(input, 'Hva kaller ')
    expect(wrongTone).toHaveBeenCalledTimes(2)
  })

  it('never sounds for a correct sentence', async () => {
    const input = await openSession()
    type(input, 'Hva ')
    type(input, 'Hva heter ')
    type(input, 'Hva heter du')
    expect(wrongTone).not.toHaveBeenCalled()
  })
})
