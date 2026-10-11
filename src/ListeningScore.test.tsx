// @vitest-environment jsdom
//
// Two changes Michael asked for together (ADR-040): a missing æ ø å is a
// mistake rather than a free pass, and every exercise shows an explicit
// percentage so a session ends with a number.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./speech', () => ({
  speak: async () => {},
  stopSpeech: () => {},
  onAudioFailure: () => () => {},
  clearAudioFailure: () => {},
}))
vi.mock('./playback', () => ({ wrongTone: () => {} }))

const DICTATION = {
  kind: 'dictation' as const,
  item_id: 1,
  example_id: 1,
  target: 'Forstår du meg?',
  translation: 'Do you understand me?',
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

afterEach(cleanup)

async function answer(text: string) {
  render(<ListeningSession onFinish={() => {}} />)
  const input = (await waitFor(() =>
    screen.getByPlaceholderText(/Type the Norwegian/),
  )) as HTMLInputElement
  fireEvent.change(input, { target: { value: text } })
  fireEvent.click(screen.getByText(/^Check/))
  return input
}

const percent = () => Number(screen.getByText(/^\d+%$/).textContent!.replace('%', ''))

describe('a missing diacritic', () => {
  it('no longer counts as a correct answer', async () => {
    await answer('Forstar du meg')
    expect(screen.queryByText(/✅ Correct/)).toBeNull()
    expect(screen.getByText(/Only the special characters/)).toBeTruthy()
  })

  it('costs marks, but not the whole word', async () => {
    await answer('Forstar du meg')
    const pct = percent()
    expect(pct).toBeGreaterThan(80) // two words right, one letter wrong
    expect(pct).toBeLessThan(100) // but it is not free
  })

  it('still lets the right spelling score full marks', async () => {
    await answer('Forstår du meg')
    expect(screen.getByText(/✅ Correct/)).toBeTruthy()
    expect(percent()).toBe(100)
  })
})

describe('the explicit score', () => {
  it('shows a percentage on a perfect answer too', async () => {
    await answer('Forstår du meg')
    expect(percent()).toBe(100)
  })

  it('shows a percentage on a wrong answer', async () => {
    await answer('Snakker du norsk')
    expect(percent()).toBeLessThan(50)
  })

  it('gives zero for an answer with nothing in common', async () => {
    await answer('zzz qqq www')
    expect(percent()).toBe(0)
  })

  it('ends the session with the average of the marks', async () => {
    await answer('Forstår du meg')
    fireEvent.click(screen.getByText(/^Next/))
    // One exercise, scored 100%, so the session is 100%.
    await waitFor(() => expect(screen.getByText('100%')).toBeTruthy())
    expect(screen.getByText(/1 \/ 1 correct/)).toBeTruthy()
  })
})
