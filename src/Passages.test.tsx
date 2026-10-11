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
  lines: null,
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
  lines: null,
  word_count: 5,
  topics: ['home'],
  glossary: [
    { form: 'Hverdagen', lemma: 'en hverdag', en: 'the everyday life', source: 'new' },
    { form: 'min', lemma: 'min', en: 'my', source: 'new' },
    // In the A1 deck, but not met yet: a hint all the same.
    { form: 'travel', lemma: 'travel', en: 'busy', source: 'unseen' },
  ],
  last_mark: 'missed',
  attempts: 2,
}

// An exchange: authored as lines so it can be laid out as a question and its
// answer rather than run together.
const BANK: Passage = {
  slug: 'a1-007',
  kind: 'sentence',
  level: 'A1',
  no: 'Unnskyld, hvor er nærmeste bank? Den ligger rett over gata.',
  en: 'Excuse me, where is the nearest bank? It is right across the street.',
  lines: [
    {
      role: 'question',
      no: 'Unnskyld, hvor er nærmeste bank?',
      en: 'Excuse me, where is the nearest bank?',
    },
    {
      role: 'answer',
      no: 'Den ligger rett over gata.',
      en: 'It is right across the street.',
    },
  ],
  word_count: 10,
  topics: ['travel'],
  glossary: [],
  last_mark: null,
  attempts: 0,
}

const SESSION: PassageSession = {
  total: 25,
  attempted: 1,
  got: 0,
  passages: [ANNA, HVERDAG],
}

const EXCHANGE: PassageSession = { ...SESSION, passages: [BANK] }

const postPassageAttempt = vi.fn(async () => ({
  slug: 'a1-001',
  mark: 'got' as const,
  score: 2,
}))

let next: PassageSession = SESSION

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  fetchPassages: async () => structuredClone(next),
  postPassageAttempt: (...args: unknown[]) =>
    (postPassageAttempt as unknown as (...a: unknown[]) => unknown)(...args),
}))

import Passages from './Passages'

beforeEach(() => {
  postPassageAttempt.mockClear()
  next = SESSION
})
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

  it('glosses deck words the learner has not met, beside the ones outside it', async () => {
    await open()
    screen.getByText('Check').click()
    await waitFor(() => expect(screen.getByText('Got it')).toBeTruthy())
    screen.getByText('Got it').click()

    await waitFor(() => expect(screen.getByText('travel')).toBeTruthy())
    expect(screen.getByText('busy')).toBeTruthy()
    // And the key says which is which, without labelling every row.
    expect(screen.getByText(/from your deck you have not met yet/)).toBeTruthy()
    expect(screen.getByText(/from outside the course/)).toBeTruthy()
  })

  it('marks the two kinds differently', async () => {
    await open()
    screen.getByText('Check').click()
    await waitFor(() => expect(screen.getByText('Got it')).toBeTruthy())
    screen.getByText('Got it').click()

    await waitFor(() => expect(screen.getByText('travel')).toBeTruthy())
    expect(screen.getByText('travel').title).toMatch(/not met it yet/)
    expect(screen.getByText('Hverdagen').title).toMatch(/Not in the course/)
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


describe('a question and its answer', () => {
  // Michael: "It would be better if we formatted it like this: Question: ...
  // Answer: ..." -- run together, an exchange reads as one person talking to
  // themselves.
  async function openExchange() {
    next = EXCHANGE
    render(<Passages onBack={() => {}} />)
    await waitFor(() =>
      expect(screen.getByText('Unnskyld, hvor er nærmeste bank?')).toBeTruthy(),
    )
  }

  it('splits the exchange and labels each half', async () => {
    await openExchange()
    expect(screen.getByText('Question')).toBeTruthy()
    expect(screen.getByText('Answer')).toBeTruthy()
    expect(screen.getByText('Den ligger rett over gata.')).toBeTruthy()
    // Not the run-together version.
    expect(screen.queryByText(BANK.no)).toBeNull()
  })

  it('lays the reference translation out the same way', async () => {
    await openExchange()
    screen.getByText('Check').click()

    await waitFor(() =>
      expect(screen.getByText('Excuse me, where is the nearest bank?')).toBeTruthy(),
    )
    expect(screen.getByText('It is right across the street.')).toBeTruthy()
    expect(screen.queryByText(BANK.en)).toBeNull()
    // One label per line, in both the Norwegian and the English.
    expect(screen.getAllByText('Question')).toHaveLength(2)
    expect(screen.getAllByText('Answer')).toHaveLength(2)
  })

  it('still shows a plain passage as one paragraph', async () => {
    await open()
    expect(screen.getByText('Jeg heter Anna.')).toBeTruthy()
    expect(screen.queryByText('Question')).toBeNull()
  })
})
