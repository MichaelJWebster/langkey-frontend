// @vitest-environment jsdom
//
// Regression cover for listening practice firing playback twice. The autoplay
// effect used to depend on the `play` callback, whose identity changes with
// the chosen speed, so pressing a speed chip triggered playback from its own
// handler AND from the effect re-running. Two clips played over each other,
// which sounded louder rather than slower.

import { StrictMode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const speak = vi.fn(async (_text: string, _url?: string | null) => {})
const stopSpeech = vi.fn()

vi.mock('./speech', () => ({
  speak: (text: string, url?: string | null) => speak(text, url),
  stopSpeech: () => stopSpeech(),
  onAudioFailure: () => () => {},
  clearAudioFailure: () => {},
}))

const DICTATION = {
  kind: 'dictation' as const,
  item_id: 1,
  example_id: 1,
  target: 'Jeg bor i Oslo.',
  translation: 'I live in Oslo.',
  suggested_scale: 1.6,
  // The same five speeds as pronunciation (ADR-046).
  speeds: [
    { scale: 4, url: '/audio/4.0.wav' },
    { scale: 3.4, url: '/audio/3.4.wav' },
    { scale: 2.8, url: '/audio/2.8.wav' },
    { scale: 2.2, url: '/audio/2.2.wav' },
    { scale: 1.6, url: '/audio/1.6.wav' },
  ],
}

// Fresh objects per call, as parsing a JSON response gives: StrictMode runs
// the loading effect twice, so `current` changes identity and the autoplay
// effect fires again. That is the real mount behaviour and the reason the
// guarantee of one audible clip has to live in the speech layer.
vi.mock('./api', () => ({
  fetchListening: async () => ({
    exercises: [
      structuredClone(DICTATION),
      { ...structuredClone(DICTATION), example_id: 2, target: 'Hun bor i Bergen.' },
    ],
  }),
  postAttempt: async () => ({ status: 'ok' }),
}))

import ListeningSession from './ListeningSession'

beforeEach(() => {
  speak.mockClear()
  stopSpeech.mockClear()
})

afterEach(cleanup)

describe('listening autoplay', () => {
  it('autoplays the suggested speed when the exercise opens', async () => {
    render(
      <StrictMode>
        <ListeningSession onFinish={() => {}} />
      </StrictMode>,
    )

    await waitFor(() => expect(speak).toHaveBeenCalled())
    // Every request is for the suggested speed. The call may legitimately
    // happen twice here -- StrictMode loads the exercises twice, so `current`
    // changes identity -- and it is speech.ts that guarantees only one of them
    // becomes audible. See speech.test.ts.
    for (const call of speak.mock.calls) {
      expect(call).toEqual([DICTATION.target, '/audio/1.6.wav'])
    }
  })

  it('choosing a speed requests that clip exactly once', async () => {
    render(<ListeningSession onFinish={() => {}} />)
    await waitFor(() => expect(speak).toHaveBeenCalled())
    speak.mockClear()

    screen.getByText('very slow').click()

    await waitFor(() => expect(speak).toHaveBeenCalled())
    // Once, with the slow clip: twice is what stacked two clips on top of
    // each other and made it sound louder instead of slower.
    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledWith(DICTATION.target, '/audio/3.4.wav')
  })

  // Michael: "For the listening practice we only have 3 speeds. I'd like the
  // same speeds as for the speaking section - ie. 5 speeds."
  it('offers all five speeds, named as pronunciation names them', async () => {
    render(<ListeningSession onFinish={() => {}} />)
    await waitFor(() => expect(speak).toHaveBeenCalled())

    for (const label of ['slowest', 'very slow', 'slow', 'easier', 'natural']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    screen.getByText('slowest').click()
    await waitFor(() =>
      expect(speak).toHaveBeenLastCalledWith(DICTATION.target, '/audio/4.0.wav'),
    )
  })

  // Michael: "when I play the next phrase after selecting "slowest" the speed
  // switches back to natural. Could we keep the speed where I set it, until I
  // change it?"
  it('keeps the chosen speed for the next sentence', async () => {
    render(<ListeningSession onFinish={() => {}} />)
    await waitFor(() => expect(speak).toHaveBeenCalled())

    screen.getByText('slowest').click()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: DICTATION.target } })
    screen.getByText('Check').click()
    speak.mockClear()
    ;(await screen.findByText('Next')).click()

    await waitFor(() =>
      expect(speak).toHaveBeenCalledWith('Hun bor i Bergen.', '/audio/4.0.wav'),
    )
    expect(speak).not.toHaveBeenCalledWith('Hun bor i Bergen.', '/audio/1.6.wav')
    expect(screen.getByText('slowest').className).toContain('sky-400')
  })
})
