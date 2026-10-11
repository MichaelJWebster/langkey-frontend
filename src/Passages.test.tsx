// @vitest-environment jsdom
//
// The self-assessment flow. The things that matter here are what the learner
// can see when: the glossary from the start (it is the only way in to words
// the deck has not taught), the reference translation never before they have
// committed, and the mark they give themselves reaching the server with the
// answer they actually wrote.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Passage, PassageSession } from './api'

const ANNA: Passage = {
  slug: 'a1-001',
  kind: 'sentence',
  level: 'A1',
  no: 'Jeg heter Anna.',
  en: 'My name is Anna.',
  word_count: 3,
  topics: ['people'],
  glossary: [],
  last_mark: null,
  attempts: 0,
}

const HVERDAG: Passage = {
  slug: 'a1-024',
  kind: 'paragraph',
  level: 'A1',
  no: 'Hverdagen min er ganske travel.',
  en: 'My everyday life is quite busy.',
  word_count: 5,
  topics: ['home'],
  glossary: [
    { form: 'Hverdagen', lemma: 'en hverdag', en: 'the everyday life' },
    { form: 'min', lemma: 'min', en: 'my' },
  ],
  last_mark: 'missed',
  attempts: 2,
}

const SESSION: PassageSession = {
  total: 25,
  attempted: 1,
  got: 0,
  passages: [ANNA, HVERDAG],
}

const postPassageAttempt = vi.fn(async () => ({
  slug: 'a1-001',
  mark: 'got' as const,
  score: 2,
}))

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  fetchPassages: async () => structuredClone(SESSION),
  postPassageAttempt: (...args: unknown[]) =>
    (postPassageAttempt as unknown as (...a: unknown[]) => unknown)(...args),
}))

import Passages from './Passages'

beforeEach(() => postPassageAttempt.mockClear())
afterEach(cleanup)

async function open() {
  render(<Passages onBack={() => {}} />)
  await waitFor(() => expect(screen.getByText('Jeg heter Anna.')).toBeTruthy())
}

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText('Your translation'), { target: { value } })

describe('the translation exercise', () => {
  it('shows the Norwegian and asks for a translation', async () => {
    await open()
    expect(screen.getByLabelText('Your translation')).toBeTruthy()
    expect(screen.getByText('Check')).toBeTruthy()
  })

  it('holds the reference translation back until Check', async () => {
    await open()
    expect(screen.queryByText('My name is Anna.')).toBeNull()

    screen.getByText('Check').click()

    await waitFor(() => expect(screen.getByText('My name is Anna.')).toBeTruthy())
  })

  it('offers no mark before the answer is revealed', async () => {
    await open()
    expect(screen.queryByText('Got it')).toBeNull()
    expect(screen.queryByText('Missed it')).toBeNull()
  })

  it('counts the session', async () => {
    await open()
    expect(screen.getByText('1 of 2')).toBeTruthy()
    expect(screen.getByText('0 of 25 done')).toBeTruthy()
  })
})

describe('the glossary', () => {
  it('is visible from the start, in the form used in the Norwegian', async () => {
    await open()
    // Move to the passage that has one.
    screen.getByText('Check').click()
    await waitFor(() => expect(screen.getByText('Got it')).toBeTruthy())
    screen.getByText('Got it').click()

    await waitFor(() =>
      expect(screen.getByText('Hverdagen min er ganske travel.')).toBeTruthy(),
    )
    // The inflected form, not "en hverdag", is the entry word.
    expect(screen.getByText('Hverdagen')).toBeTruthy()
    expect(screen.getByText(/the everyday life/)).toBeTruthy()
    // The reference translation is still hidden on this new passage.
    expect(screen.queryByText('My everyday life is quite busy.')).toBeNull()
  })

  it('shows how a passage went last time', async () => {
    await open()
    screen.getByText('Check').click()
    await waitFor(() => expect(screen.getByText('Got it')).toBeTruthy())
    screen.getByText('Got it').click()

    await waitFor(() => expect(screen.getByText(/last time: missed/)).toBeTruthy())
  })
})

describe('marking your own answer', () => {
  it('sends the mark with the answer that was written', async () => {
    await open()
    type('My name is Anna')
    screen.getByText('Check').click()
    await waitFor(() => expect(screen.getByText('Got it')).toBeTruthy())

    screen.getByText('Got it').click()

    expect(postPassageAttempt).toHaveBeenCalledWith(
      'a1-001',
      'got',
      'My name is Anna',
      true,
    )
  })

  it('moves on to the next passage', async () => {
    await open()
    screen.getByText('Check').click()
    await waitFor(() => expect(screen.getByText('Partly')).toBeTruthy())

    screen.getByText('Partly').click()

    await waitFor(() =>
      expect(screen.getByText('Hverdagen min er ganske travel.')).toBeTruthy(),
    )
    expect(screen.getByText('2 of 2')).toBeTruthy()
    // A fresh passage starts unrevealed, with an empty box.
    expect(screen.getByText('Check')).toBeTruthy()
    expect((screen.getByLabelText('Your translation') as HTMLTextAreaElement).value).toBe('')
  })

  it('scores the session, counting a partial as a half', async () => {
    await open()
    screen.getByText('Check').click()
    await waitFor(() => expect(screen.getByText('Got it')).toBeTruthy())
    screen.getByText('Got it').click()

    await waitFor(() => expect(screen.getByText('Check')).toBeTruthy())
    screen.getByText('Check').click()
    await waitFor(() => expect(screen.getByText('Partly')).toBeTruthy())
    screen.getByText('Partly').click()

    // One got, one partly, out of two: 75%.
    await waitFor(() => expect(screen.getByText('75%')).toBeTruthy())
    expect(screen.getByText(/1 got it · 1 partly · 0 missed/)).toBeTruthy()
  })

  it('does not block the learner when recording the mark fails', async () => {
    postPassageAttempt.mockRejectedValueOnce(new Error('offline'))
    await open()
    screen.getByText('Check').click()
    await waitFor(() => expect(screen.getByText('Missed it')).toBeTruthy())

    screen.getByText('Missed it').click()

    await waitFor(() =>
      expect(screen.getByText('Hverdagen min er ganske travel.')).toBeTruthy(),
    )
  })
})
