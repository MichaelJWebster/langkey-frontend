// @vitest-environment jsdom
//
// The pronunciation screen is where recording lives now (ADR-037), so these
// cover what moved: the phrase and its translation, the speed chooser, the
// microphone, and the record of sounds that keep slipping.

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SpeakingSession from './SpeakingSession'
import type { SpeakingSession as Session } from './api'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  fetchSpeakingPractice: () => Promise.resolve(current),
  fetchRecordings: () => Promise.resolve([]),
}))
vi.mock('./speech', () => ({ speak: vi.fn(), stopSpeech: vi.fn() }))

const SPEEDS = [4, 3.4, 2.8, 2.2, 1.6].map((scale) => ({
  scale,
  url: `/api/v1/audio/nb/${scale}.wav`,
}))

const full: Session = {
  attempts_for_pattern: 4,
  phrases: [
    {
      item_id: 1,
      example_id: 7,
      text: 'Møtet slutter klokka åtte.',
      translation: 'The meeting ends at eight.',
      audio_url: '/api/v1/audio/nb/default.wav',
      speeds: SPEEDS,
      focus: ['klokka'],
    },
    {
      item_id: 2,
      example_id: null,
      text: 'takk',
      translation: 'thanks',
      audio_url: '/api/v1/audio/nb/takk.wav',
      speeds: SPEEDS,
      focus: [],
    },
  ],
  record: [
    { word: 'klokka', said: 2, attempts: 11, pattern: true },
    { word: 'takk', said: 9, attempts: 9, pattern: false },
  ],
}

let current: Session = full

beforeEach(() => {
  current = full
})
afterEach(cleanup)

describe('SpeakingSession', () => {
  it('shows the phrase and what it means', async () => {
    render(<SpeakingSession onFinish={() => {}} />)
    expect(await screen.findByText('Møtet slutter klokka åtte.')).toBeTruthy()
    expect(screen.getByText('The meeting ends at eight.')).toBeTruthy()
  })

  it('offers the speed chooser that moved out of the writing cards', async () => {
    render(<SpeakingSession onFinish={() => {}} />)
    await screen.findByText('Møtet slutter klokka åtte.')
    for (const label of ['slowest', 'very slow', 'slow', 'easier', 'natural']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('offers the microphone', async () => {
    render(<SpeakingSession onFinish={() => {}} />)
    await screen.findByText('Møtet slutter klokka åtte.')
    expect(screen.getByText('Now say it')).toBeTruthy()
  })

  it('names the sounds that keep slipping, with the evidence', async () => {
    render(<SpeakingSession onFinish={() => {}} />)
    await screen.findByText(/Sounds that keep slipping/)
    expect(screen.getAllByText('klokka').length).toBeGreaterThan(0)
    expect(screen.getByText('2/11')).toBeTruthy()
    // A word that lands is not listed, however often it has been said.
    expect(screen.queryByText('9/9')).toBeNull()
  })

  it('says why this phrase was chosen', async () => {
    render(<SpeakingSession onFinish={() => {}} />)
    expect(await screen.findByText(/watching: klokka/)).toBeTruthy()
  })

  it('draws no conclusions before there is a record', async () => {
    current = { ...full, record: [] }
    render(<SpeakingSession onFinish={() => {}} />)
    await screen.findByText('Møtet slutter klokka åtte.')
    expect(screen.queryByText(/Sounds that keep slipping/)).toBeNull()
  })

  it('points a learner with nothing met yet at vocabulary first', async () => {
    current = { ...full, phrases: [], record: [] }
    render(<SpeakingSession onFinish={() => {}} />)
    await waitFor(() => expect(screen.getByText(/review some vocabulary first/)).toBeTruthy())
  })
})
